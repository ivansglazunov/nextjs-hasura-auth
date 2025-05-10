import readline from 'readline';
import fs from 'fs-extra';
import path from 'path';
import Debug from './debug';
import { TBankPaymentProcessor } from './payments/tbank'; // Assuming path
import { createRlInterface, askYesNo, askForInput, parseEnvFile, writeEnvFile } from './assist-common'; // Added missing imports

const debug = Debug('assist:tbank');

// Helper functions (similar to those in assist.ts)
// createRlInterface, askYesNo, askForInput, parseEnvFile, writeEnvFile are now imported from assist-common

async function configureTBank(rl: readline.Interface, envPath: string) {
  console.log('\n🏦 Configuring TBank Payment Processor...');
  let envVars = parseEnvFile(envPath);
  let updated = false;

  const setupTBank = await askYesNo(rl, 'Do you want to configure TBank payment gateway settings?', true);
  if (!setupTBank) {
    console.log('Skipping TBank configuration.');
    return;
  }

  console.log('\n--- Production Keys ---');
  const prodTerminalKeyCurrent = envVars.TBANK_PROD_TERMINAL_KEY || '';
  const prodTerminalKey = await askForInput(rl, 'Enter your PRODUCTION TBank TerminalKey', prodTerminalKeyCurrent);
  const prodSecretKeyCurrent = envVars.TBANK_PROD_SECRET_KEY || '';
  const prodSecretKey = await askForInput(rl, 'Enter your PRODUCTION TBank SecretKey', prodSecretKeyCurrent);
  if (prodTerminalKey && prodSecretKey) {
    if (prodTerminalKey !== prodTerminalKeyCurrent || prodSecretKey !== prodSecretKeyCurrent) {
        envVars.TBANK_PROD_TERMINAL_KEY = prodTerminalKey;
        envVars.TBANK_PROD_SECRET_KEY = prodSecretKey;
        updated = true;
    }
  }

  console.log('\n--- Test Keys ---');
  const testTerminalKeyCurrent = envVars.TBANK_TEST_TERMINAL_KEY || '';
  const testTerminalKey = await askForInput(rl, 'Enter your TEST TBank TerminalKey', testTerminalKeyCurrent);
  const testSecretKeyCurrent = envVars.TBANK_TEST_SECRET_KEY || '';
  const testSecretKey = await askForInput(rl, 'Enter your TEST TBank SecretKey', testSecretKeyCurrent);
  if (testTerminalKey && testSecretKey) {
     if (testTerminalKey !== testTerminalKeyCurrent || testSecretKey !== testSecretKeyCurrent) {
        envVars.TBANK_TEST_TERMINAL_KEY = testTerminalKey;
        envVars.TBANK_TEST_SECRET_KEY = testSecretKey;
        updated = true;
     }
  }

  if ( (envVars.TBANK_PROD_TERMINAL_KEY && envVars.TBANK_PROD_SECRET_KEY) || (envVars.TBANK_TEST_TERMINAL_KEY && envVars.TBANK_TEST_SECRET_KEY) ) {
      const useTestCurrent = envVars.TBANK_USE_TEST_MODE === '1';
      const useTest = await askYesNo(rl, 'Do you want to use TEST keys by default for development?', useTestCurrent);
    if (useTest !== useTestCurrent) {
        envVars.TBANK_USE_TEST_MODE = useTest ? '1' : '0';
        updated = true;
    }
    console.log(`TBank will use ${envVars.TBANK_USE_TEST_MODE === '1' ? 'TEST' : 'PRODUCTION'} keys based on TBANK_USE_TEST_MODE=${envVars.TBANK_USE_TEST_MODE}`);
  } else {
    console.log('⚠️ No TBank keys were provided. Skipping mode selection.');
  }
  
  // Determine base URL for defaults
  const defaultBaseUrl = envVars.NEXT_PUBLIC_MAIN_URL || envVars.VERCEL_URL || 'http://localhost:3000';

  const defaultReturnUrl = `${defaultBaseUrl}/payments/callback/tbank`;
  const currentTbankReturnUrl = envVars.TBANK_DEFAULT_RETURN_URL || '';
  const tbankReturnUrl = await askForInput(rl, 'Enter TBank default Return URL for payments', currentTbankReturnUrl || defaultReturnUrl);
  if (tbankReturnUrl && tbankReturnUrl !== currentTbankReturnUrl) {
    envVars.TBANK_DEFAULT_RETURN_URL = tbankReturnUrl;
    updated = true;
  }

  const defaultWebhookUrl = `${defaultBaseUrl}/api/payments/tbank/webhook`;
  const currentTbankWebhookUrl = envVars.TBANK_DEFAULT_WEBHOOK_URL || '';
  const tbankWebhookUrl = await askForInput(rl, 'Enter TBank default Webhook URL', currentTbankWebhookUrl || defaultWebhookUrl);
  if (tbankWebhookUrl && tbankWebhookUrl !== currentTbankWebhookUrl) {
    envVars.TBANK_DEFAULT_WEBHOOK_URL = tbankWebhookUrl;
    updated = true;
  }
  
  const defaultCardWebhookUrl = `${defaultBaseUrl}/api/payments/tbank/card-webhook`;
  const currentTbankCardWebhookUrl = envVars.TBANK_DEFAULT_CARD_WEBHOOK_URL || '';
  const tbankCardWebhookUrl = await askForInput(rl, 'Enter TBank default Card Webhook URL', currentTbankCardWebhookUrl || defaultCardWebhookUrl);
  if (tbankCardWebhookUrl && tbankCardWebhookUrl !== currentTbankCardWebhookUrl) {
    envVars.TBANK_DEFAULT_CARD_WEBHOOK_URL = tbankCardWebhookUrl;
    updated = true;
  }


  if (updated) {
    writeEnvFile(envPath, envVars);
    console.log('✅ TBank configuration saved to .env file.');
  } else {
    console.log('No changes made to TBank configuration.');
  }
}

async function calibrateTBank(rl: readline.Interface, envPath: string) {
  console.log('\n⚙️ Calibrating TBank Integration...');
  const envVars = parseEnvFile(envPath);
  const useTestMode = envVars.TBANK_USE_TEST_MODE === '1';

  const terminalKey = useTestMode ? envVars.TBANK_TEST_TERMINAL_KEY : envVars.TBANK_PROD_TERMINAL_KEY;
  const secretKey = useTestMode ? envVars.TBANK_TEST_SECRET_KEY : envVars.TBANK_PROD_SECRET_KEY;
  const appBaseUrl = envVars.NEXT_PUBLIC_MAIN_URL || envVars.VERCEL_URL || envVars.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  if (!terminalKey || !secretKey) {
    console.error('❌ TBank TerminalKey or SecretKey not configured for the selected mode. Skipping calibration.');
    return;
  }

  // Ensure TBankPaymentProcessor is correctly initialized
  // It might require NEXT_PUBLIC_MAIN_URL or similar to be explicitly passed or set in env for its own constructor if it uses it internally.
  // For now, assuming its constructor takes what's provided here.
  const tbankProcessor = new TBankPaymentProcessor({
    terminalKey,
    secretKey,
    useTestMode, // This should inform the processor which endpoint (test/prod) to use
    // appBaseUrl, // Pass if TBankPaymentProcessor needs it, or if it constructs callback URLs itself
  });

  const runCalibration = await askYesNo(rl, 'Do you want to run a test payment initiation to calibrate TBank?', true);
  if (!runCalibration) {
    console.log('Skipping TBank calibration test.');
    return;
  }

  const testAmount = parseFloat(await askForInput(rl, 'Enter a small amount for the test payment (e.g., 1.00 RUB)', '1.00'));
  const testOrderId = `test_cal_${Date.now()}`;
  const defaultReturnUrlForTest = envVars.TBANK_DEFAULT_RETURN_URL || `${appBaseUrl}/payment-callback/tbank-calibration`;

  console.log(`Attempting to initiate a test payment of ${testAmount} RUB with OrderID ${testOrderId}...`);
  console.log(`Using Return URL for test: ${defaultReturnUrlForTest}`);
  try {
    const result = await tbankProcessor.initiatePayment({
      paymentId: testOrderId,
      amount: testAmount,
      currency: 'RUB',
      description: 'Test payment from assist-tbank',
      userId: 'calibration-user',
      returnUrl: defaultReturnUrlForTest, // Use the determined or configured return URL
      // notificationUrl: envVars.TBANK_DEFAULT_WEBHOOK_URL, // Pass if your initiatePayment supports it directly
      objectHid: 'test/payments/assist-tbank' // Example HID
    });

    if (result.redirectUrl) {
      console.log('✅ Test payment initiated successfully!');
      console.log(`🔗 Redirect URL: ${result.redirectUrl}`);
      console.log(`🆔 External Payment ID (TBank PaymentId): ${result.externalPaymentId}`);
      console.log('Please open the Redirect URL in your browser to complete the test payment on TBank page.');
      console.log('After completing or canceling the payment, check your TBank merchant dashboard and webhook logs.');
      console.log(`Ensure your webhook at ${envVars.TBANK_DEFAULT_WEBHOOK_URL || (appBaseUrl + '/api/payments/tbank/webhook')} is active if you expect notifications.`);
    } else {
      console.error('❌ Failed to initiate test payment.');
      if (result.errorMessage) console.error(`   Error: ${result.errorMessage}`);
      if (result.providerResponse) console.error('   Provider Response:', result.providerResponse);
    }
  } catch (error: any) {
    console.error('❌ Error during TBank calibration test payment:', error.message);
    debug('TBank calibration initiatePayment error stack:', error.stack);
  }
}

export async function assistTbank() {
  const rl = createRlInterface();
  const projectRoot = process.cwd(); // Assuming script is run from project root
  const envPath = path.join(projectRoot, '.env');

  try {
    await configureTBank(rl, envPath);
    await calibrateTBank(rl, envPath);
    console.log('\n✨ TBank assistance finished.');
  } catch (error) {
    console.error('❌ Error during TBank assistance:', error);
    debug('Error in assistTbank:', error);
  } finally {
    rl.close();
  }
}

// Allow direct execution for testing this module
if (require.main === module) {
  assistTbank();
} 