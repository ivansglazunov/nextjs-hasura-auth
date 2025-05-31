import dotenv from 'dotenv';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TBankPaymentProcessor, TBankProviderDBConfig } from './tbank';
import { PaymentDetailsArgs, InitiatePaymentResult, PaymentStatusResult } from './base';
import { isTBankTestAvailable, getTBankTestConfig } from '../assist-tbank-test';
import { AI } from '../ai';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
dotenv.config();

// Skip tests if T-Bank test environment is not available
const skipIfNoTBankTest = isTBankTestAvailable() ? describe : describe.skip;

skipIfNoTBankTest('T-Bank Payment Integration Tests', () => {
  let testConfig: ReturnType<typeof getTBankTestConfig>;
  let processor: TBankPaymentProcessor;
  let providerConfig: TBankProviderDBConfig;
  let ai: AI;
  
  // Test data
  const testUserId = 'test-user-' + uuidv4();
  const testCustomerKey = 'test-customer-' + uuidv4();
  
  // Webhook tracking
  let webhookData: any = null;
  let webhookPromise: Promise<any>;
  let webhookResolve: (value: any) => void;

  beforeEach(() => {
    // Get test configuration
    testConfig = getTBankTestConfig();
    
    // Create test provider config
    providerConfig = {
      terminal_key: testConfig.terminalKey,
      secret_key: testConfig.secretKey,
      is_test_mode: true,
      default_return_url: 'http://localhost:3000/payment/return',
      default_webhook_url: 'https://your-test-server.com/api/payments/tbank/webhook'
    };

    // Create processor
    processor = new TBankPaymentProcessor({
      providerDBConfig: providerConfig,
      appBaseUrl: 'http://localhost:3000',
      options: {}
    });

    // Initialize AI
    ai = new AI(testConfig.openRouterApiKey, {}, {
      model: 'google/gemini-2.5-flash-preview',
      temperature: 0.1,
      max_tokens: 4096
    });

    // Setup AI with execution capabilities
    ai._do = async (doItem) => {
      const { execDo } = await import('../exec');
      const { execTsDo } = await import('../exec-tsx');
      
      if (doItem.operation.startsWith('do/exec/js')) {
        const result = await execDo.exec(doItem.request);
        return {
          ...doItem,
          response: result?.toString() || 'undefined'
        };
      } else if (doItem.operation.startsWith('do/exec/tsx')) {
        const result = await execTsDo.exec(doItem.request);
        return {
          ...doItem,
          response: result?.toString() || 'undefined'
        };
      }
      
      return {
        ...doItem,
        response: 'Unsupported operation'
      };
    };

    // Setup webhook tracking
    webhookData = null;
    webhookPromise = new Promise((resolve) => {
      webhookResolve = resolve;
    });

    // Mock webhook endpoint (in real test, this would be handled by your server)
    // You'll need to implement actual webhook endpoint on your test server
  });

  afterEach(() => {
    // Cleanup if needed
  });

  it('should complete full payment cycle with AI automation', async () => {
    console.log('🚀 Starting full T-Bank payment integration test');
    
    // Step 1: Create payment
    const paymentId = uuidv4();
    const amount = 1; // 1 ruble
    
    console.log('💳 Creating payment...');
    const paymentArgs: PaymentDetailsArgs = {
      paymentId,
      amount,
      currency: 'RUB',
      description: 'Test payment for integration test',
      objectHid: 'test-object-' + uuidv4(),
      userId: testUserId,
      returnUrl: `http://localhost:3000/payment/return/${paymentId}`,
      metadata: {
        customerKey: testCustomerKey
      }
    };

    const paymentResult = await processor.initiatePayment(paymentArgs);

    expect(paymentResult.status).toBe('pending_user_action');
    expect(paymentResult.redirectUrl).toBeTruthy();
    expect(paymentResult.externalPaymentId).toBeTruthy();

    console.log('✅ Payment created successfully');
    console.log('🔗 Payment URL:', paymentResult.redirectUrl);

    // Step 2: Use AI to automate payment process
    console.log('🤖 Using AI to complete payment form...');
    
    const automationPrompt = `
You need to automate a T-Bank payment process using Puppeteer. Here's what you need to do:

1. Open the payment URL: ${paymentResult.redirectUrl}
2. Wait for the page to load completely
3. Fill in the card details:
   - Card Number: ${testConfig.successCard.number}
   - Expiry Date: ${testConfig.successCard.exp}
   - CVC: ${testConfig.successCard.cvc}
4. Submit the payment form
5. Wait for payment to complete
6. Return the final page URL and any success/error messages

Use Puppeteer with proper waits and error handling. Make sure to:
- Use headless: false for debugging if needed
- Set proper timeouts
- Handle any 3DS redirects if they appear
- Take screenshots on errors
- Close the browser when done

The payment should succeed with the provided test card.
`;

    // Execute AI automation
    const automationResult = await ai.ask(automationPrompt);
    
    expect(automationResult).toBeTruthy();
    expect(typeof automationResult).toBe('string');
    
    console.log('🤖 AI automation completed');
    console.log('📄 Automation result:', automationResult);

    // Step 3: Wait for webhook (with timeout)
    console.log('⏱️ Waiting for webhook notification...');
    
    const webhookTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Webhook timeout')), 60000); // 60 second timeout
    });

    try {
      // In a real test, you would wait for the actual webhook from T-Bank
      // For now, we'll simulate webhook verification by checking payment status
      console.log('🔄 Checking payment status...');
      
      // Wait a bit for T-Bank to process
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check payment status via GetState
      const statusResult = await processor.getPaymentStatus(paymentId, paymentResult.externalPaymentId);
      
      console.log('📊 Payment status:', statusResult);
      
      // For successful payment test
      expect(['pending_confirmation', 'succeeded']).toContain(statusResult.status);
      
      console.log('✅ Payment completed successfully');
      
    } catch (error) {
      console.error('❌ Webhook or status check failed:', error);
      throw error;
    }

    // Step 4: Verify final state
    console.log('🔍 Verifying final payment state...');
    
    // Additional verification can be added here
    // - Check database state if applicable
    // - Verify transaction logs
    // - Check that funds were processed correctly
    
    console.log('🎉 Full payment cycle test completed successfully');
    
  }, 180000); // 3 minute timeout for full test

  it('should handle failed payment with error card', async () => {
    console.log('🚀 Starting failed payment test');
    
    // Step 1: Create payment
    const paymentId = uuidv4();
    const amount = 1;
    
    const paymentArgs: PaymentDetailsArgs = {
      paymentId,
      amount,
      currency: 'RUB',
      description: 'Test failed payment',
      objectHid: 'test-object-' + uuidv4(),
      userId: testUserId,
      returnUrl: `http://localhost:3000/payment/return/${paymentId}`,
      metadata: {
        customerKey: testCustomerKey + '-fail'
      }
    };

    const paymentResult = await processor.initiatePayment(paymentArgs);

    expect(paymentResult.status).toBe('pending_user_action');
    expect(paymentResult.redirectUrl).toBeTruthy();

    // Step 2: Use AI with fail card
    const failAutomationPrompt = `
You need to automate a T-Bank payment that should FAIL using Puppeteer:

1. Open the payment URL: ${paymentResult.redirectUrl}
2. Fill in the FAIL card details:
   - Card Number: ${testConfig.failCard.number}
   - Expiry Date: ${testConfig.failCard.exp}
   - CVC: ${testConfig.failCard.cvc}
3. Submit the payment form
4. Wait for the error/rejection message
5. Return the error details and final status

This payment should fail with the provided test card. Capture any error messages.
`;

    const failResult = await ai.ask(failAutomationPrompt);
    
    expect(failResult).toBeTruthy();
    console.log('🤖 Fail automation result:', failResult);

    // Step 3: Verify failed status
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const statusResult = await processor.getPaymentStatus(paymentId, paymentResult.externalPaymentId);
    
    expect(['failed', 'error']).toContain(statusResult.status);
    
    console.log('✅ Failed payment test completed successfully');
    
  }, 180000);

  it('should handle payment cancellation', async () => {
    console.log('🚀 Starting payment cancellation test');
    
    // Step 1: Create payment
    const paymentId = uuidv4();
    const amount = 1;
    
    const paymentArgs: PaymentDetailsArgs = {
      paymentId,
      amount,
      currency: 'RUB',
      description: 'Test cancellation',
      objectHid: 'test-object-' + uuidv4(),
      userId: testUserId,
      returnUrl: `http://localhost:3000/payment/return/${paymentId}`,
      metadata: {
        customerKey: testCustomerKey + '-cancel'
      }
    };

    const paymentResult = await processor.initiatePayment(paymentArgs);

    expect(paymentResult.status).toBe('pending_user_action');

    // Step 2: Cancel payment before completion
    const cancelResult = await processor.cancelPayment(paymentResult.externalPaymentId!);
    
    expect(cancelResult.Success).toBe(true);
    
    // Step 3: Verify cancelled status
    const statusResult = await processor.getPaymentStatus(paymentId, paymentResult.externalPaymentId);
    expect(['canceled', 'refunded']).toContain(statusResult.status);
    
    console.log('✅ Payment cancellation test completed successfully');
    
  }, 60000);

  // Helper test to verify test environment
  it('should verify test environment configuration', () => {
    expect(testConfig.terminalKey).toBeTruthy();
    expect(testConfig.secretKey).toBeTruthy();
    expect(testConfig.successCard.number).toBeTruthy();
    expect(testConfig.failCard.number).toBeTruthy();
    expect(testConfig.openRouterApiKey).toBeTruthy();
    
    expect(processor).toBeInstanceOf(TBankPaymentProcessor);
    expect(ai).toBeInstanceOf(AI);
    
    console.log('✅ Test environment verified');
  });
}); 