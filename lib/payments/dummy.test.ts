import { DummyPaymentProcessor } from './dummy';
import { IPaymentProcessor, PaymentDetailsArgs, WebhookHandlingResult, InitiatePaymentResult } from './base';

// Define PaymentStatus string literals as they are used in the code
const PaymentStatus = {
  PENDING_USER_ACTION: 'pending_user_action',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  ERROR: 'error',
  // PENDING_INITIATION: 'pending_initiation', // Not used directly in processor logic for status, but for DB state
};

describe('DummyPaymentProcessor', () => {
  let processor: IPaymentProcessor;
  const MOCK_BASE_URL = 'http://localhost:3000';

  beforeEach(() => {
    processor = new DummyPaymentProcessor({ baseUrl: MOCK_BASE_URL });
  });

  // Mock DB interactions if necessary, or test processor in isolation
  // For this example, we'll assume processor methods don't directly interact with a DB
  // but rely on API routes to do so.

  describe('initiatePayment', () => {
    it('should generate a redirect URL for an even amount (successful scenario)', async () => {
      const request: PaymentDetailsArgs = {
        paymentId: 'dummy-payment-id-even',
        amount: 1000, // even amount
        currency: 'RUB',
        description: 'Test Even Payment',
        objectHid: 'orders/test_orders/order-123',
        userId: 'user-abc',
        returnUrl: 'http://localhost:3000/payment/return',
        metadata: { customKey: 'customValue' },
      };
      const result: InitiatePaymentResult = await processor.initiatePayment(request);

      expect(result.redirectUrl).toBeDefined();
      const url = new URL(result.redirectUrl as string);
      expect(url.origin).toBe(MOCK_BASE_URL);
      expect(url.pathname).toBe('/api/payments/dummy/webhook');
      expect(url.searchParams.get('paymentId')).toBe('dummy-payment-id-even');
      expect(url.searchParams.get('externalPaymentId')).toBe('dummy-payment-id-even');
      expect(url.searchParams.get('amount')).toBe('1000');
      expect(url.searchParams.get('status')).toBe(PaymentStatus.SUCCEEDED); // Changed from pending_confirmation
      expect(result.externalPaymentId).toBe('dummy-payment-id-even');
      expect(result.status).toBe(PaymentStatus.PENDING_USER_ACTION);
    });

    it('should generate a redirect URL for an odd amount (failure scenario)', async () => {
      const request: PaymentDetailsArgs = {
        paymentId: 'dummy-payment-id-odd',
        amount: 1001, // odd amount
        currency: 'RUB',
        description: 'Test Odd Payment',
        objectHid: 'orders/test_orders/order-124',
        userId: 'user-xyz',
        returnUrl: 'http://localhost:3000/payment/return',
      };
      const result: InitiatePaymentResult = await processor.initiatePayment(request);

      expect(result.redirectUrl).toBeDefined();
      const url = new URL(result.redirectUrl as string);
      expect(url.origin).toBe(MOCK_BASE_URL);
      expect(url.pathname).toBe('/api/payments/dummy/webhook');
      expect(url.searchParams.get('paymentId')).toBe('dummy-payment-id-odd');
      expect(url.searchParams.get('externalPaymentId')).toBe('dummy-payment-id-odd');
      expect(url.searchParams.get('amount')).toBe('1001');
      expect(url.searchParams.get('status')).toBe(PaymentStatus.FAILED); // Changed from pending_failure
      expect(result.externalPaymentId).toBe('dummy-payment-id-odd');
      expect(result.status).toBe(PaymentStatus.PENDING_USER_ACTION);
    });

    it('should throw an error for zero or negative amount', async () => {
      const request: PaymentDetailsArgs = {
        paymentId: 'dummy-payment-id-zero',
        amount: 0,
        currency: 'RUB',
        description: 'Test Zero Payment',
        objectHid: 'orders/test_orders/order-000',
        userId: 'user-err',
        returnUrl: 'http://localhost:3000/payment/return',
      };
      await expect(processor.initiatePayment(request)).rejects.toThrow('Amount must be positive.');

      request.amount = -100;
      request.paymentId = 'dummy-payment-id-neg';
      await expect(processor.initiatePayment(request)).rejects.toThrow('Amount must be positive.');
    });
  });

  describe('handleWebhook', () => {
    it('should process a successful payment webhook (status=succeeded from URL)', async () => {
      const queryParams: Record<string, string> = {
        paymentId: 'dummy-payment-id-even-webhook',
        externalPaymentId: 'dummy-payment-id-even-webhook',
        amount: '1200',
        status: PaymentStatus.SUCCEEDED, // Simulating URL from a successful initiatePayment
        currency: 'RUB',
        description: 'Webhook test even'
      };
      const mockRequest = { json: async () => ({}), url: `${MOCK_BASE_URL}/api/payments/dummy/webhook?${new URLSearchParams(queryParams).toString()}` } as any;

      const result: WebhookHandlingResult = await processor.handleWebhook(mockRequest, '');

      expect(result.newPaymentStatus).toBe(PaymentStatus.SUCCEEDED);
      expect(result.paymentId).toBe('dummy-payment-id-even-webhook');
      expect(result.messageToProvider).toBe('OK');
      expect(result.processed).toBe(true);
    });

    it('should process a failed payment webhook (status=failed from URL)', async () => {
      const queryParams: Record<string, string> = {
        paymentId: 'dummy-payment-id-odd-webhook',
        externalPaymentId: 'dummy-payment-id-odd-webhook',
        amount: '1201',
        status: PaymentStatus.FAILED, // Simulating URL from a failed initiatePayment
        currency: 'RUB',
        description: 'Webhook test odd'
      };
      const mockRequest = { json: async () => ({}), url: `${MOCK_BASE_URL}/api/payments/dummy/webhook?${new URLSearchParams(queryParams).toString()}` } as any;

      const result: WebhookHandlingResult = await processor.handleWebhook(mockRequest, '');

      expect(result.newPaymentStatus).toBe(PaymentStatus.FAILED);
      expect(result.paymentId).toBe('dummy-payment-id-odd-webhook');
      expect(result.messageToProvider).toBe('OK');
      expect(result.processed).toBe(true);
      expect(result.error).toContain('Dummy payment failed');
    });

    it('should return error if paymentId is missing in webhook', async () => {
      const queryParams = { amount: '100', status: PaymentStatus.SUCCEEDED, currency: 'RUB' }; // Missing paymentId
      const mockRequest = { json: async () => ({}), url: `${MOCK_BASE_URL}/api/payments/dummy/webhook?${new URLSearchParams(queryParams).toString()}` } as any;
      const result = await processor.handleWebhook(mockRequest, '');
      expect(result.newPaymentStatus).toBe(PaymentStatus.ERROR);
      expect(result.error).toBe('Missing paymentId in webhook query');
      expect(result.processed).toBe(false);
      expect(result.messageToProvider).toBe('ERROR');
    });

    it('should return error if amount is missing or invalid in webhook', async () => {
      let queryParams: Record<string, string | undefined> = { paymentId: 'test-id', status: PaymentStatus.SUCCEEDED, currency: 'RUB' }; // Missing amount
      let mockRequest = { json: async () => ({}), url: `${MOCK_BASE_URL}/api/payments/dummy/webhook?${new URLSearchParams(queryParams as Record<string,string>).toString()}` } as any;
      let result = await processor.handleWebhook(mockRequest, '');
      expect(result.newPaymentStatus).toBe(PaymentStatus.ERROR);
      expect(result.error).toBe('Missing or invalid amount in webhook query');
      expect(result.processed).toBe(false);

      queryParams = { paymentId: 'test-id', amount: 'not-a-number', status: PaymentStatus.SUCCEEDED, currency: 'RUB' };
      mockRequest = { json: async () => ({}), url: `${MOCK_BASE_URL}/api/payments/dummy/webhook?${new URLSearchParams(queryParams as Record<string,string>).toString()}` } as any;
      result = await processor.handleWebhook(mockRequest, '');
      expect(result.newPaymentStatus).toBe(PaymentStatus.ERROR);
      expect(result.error).toBe('Missing or invalid amount in webhook query');
      expect(result.processed).toBe(false);
    });

     it('should return error if status is missing in webhook', async () => {
      const queryParams = { paymentId: 'test-id', amount: '100', currency: 'RUB' }; // Missing status
      const mockRequest = { json: async () => ({}), url: `${MOCK_BASE_URL}/api/payments/dummy/webhook?${new URLSearchParams(queryParams).toString()}` } as any;
      const result = await processor.handleWebhook(mockRequest, '');
      expect(result.newPaymentStatus).toBe(PaymentStatus.ERROR);
      expect(result.error).toBe('Missing status in webhook query');
      expect(result.processed).toBe(false);
    });
  });

  describe('getPaymentStatus', () => {
    it('should return an unknown status for DummyProvider', async () => {
      const result = await processor.getPaymentStatus('some-payment-id');
      expect(result.internalPaymentId).toBe('some-payment-id');
      expect(result.status).toBe('unknown');
      expect(result.providerStatus).toBe('dummy_unknown');
      expect(result.providerResponse).toBeDefined();
    });
  });
}); 