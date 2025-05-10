import { v4 as uuidv4 } from 'uuid';
import {
  IPaymentProcessor,
  PaymentDetailsArgs,
  InitiatePaymentResult,
  WebhookPayload, // Not used directly in dummy, but may be for reference
  WebhookHandlingResult,
  PaymentStatusResult,
  SubscriptionDetailsArgs,
  CreateSubscriptionResult,
  CancelSubscriptionArgs,
  CancelSubscriptionResult,
  AddPaymentMethodArgs,
  AddPaymentMethodResult
} from './base';
import Debug from '@/lib/debug';

const debug = Debug('payment:dummy');

// Statuses we can expect in the webhook URL parameters from initiatePayment
const DUMMY_URL_STATUS_SUCCESS = 'succeeded'; // Successful operation (even amount)
const DUMMY_URL_STATUS_FAILURE = 'failed';   // Unsuccessful operation (odd amount)

// Internal interface for details extracted from the webhook
interface DecodedWebhookDetails {
  paymentId: string | null;
  externalPaymentId: string | null;
  amount: number | null;
  currency: string | null;
  webhookStatus: string; // Status from webhook URL
  description?: string;
  // any other fields we might parse from the dummy webhook URL
  objectHid?: string;
  isErrorCondition: boolean; // Determines if the payment should be considered erroneous
  errorMessage?: string;
}

export class DummyPaymentProcessor implements IPaymentProcessor {
  readonly providerName = 'dummy';
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  }

  async initiatePayment(args: PaymentDetailsArgs): Promise<InitiatePaymentResult> {
    debug('Dummy: initiatePayment called with:', args);
    const webhookUrl = new URL(args.returnUrl || process.env.NEXT_PUBLIC_DUMMY_PAYMENT_RETURN_URL || `${this.baseUrl}/payment-callback/dummy`);

    const providerSidePaymentId = args.paymentId;
    const isEvenAmount = args.amount % 2 === 0;
    const simulatedOutcomeStatus = isEvenAmount ? DUMMY_URL_STATUS_SUCCESS : DUMMY_URL_STATUS_FAILURE;

    webhookUrl.searchParams.set('paymentId', args.paymentId);
    webhookUrl.searchParams.set('externalPaymentId', providerSidePaymentId);
    webhookUrl.searchParams.set('status', simulatedOutcomeStatus);
    webhookUrl.searchParams.set('amount', args.amount.toString());
    if (args.currency) webhookUrl.searchParams.set('currency', args.currency);
    if (args.description) webhookUrl.searchParams.set('description', args.description);
    if (args.objectHid) webhookUrl.searchParams.set('objectHid', args.objectHid);

    return {
      paymentId: args.paymentId,
      externalPaymentId: providerSidePaymentId,
      status: 'pending_user_action',
      redirectUrl: webhookUrl.toString(),
      providerResponse: { simulatedOutcomeStatus, isEvenAmount } // Corrected field name
    };
  }

  private getPaymentDetailsFromWebhook(request: Request): DecodedWebhookDetails {
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    const paymentId = queryParams.paymentId;
    const externalPaymentId = queryParams.externalPaymentId;
    const queryAmount = queryParams.amount;
    const webhookStatus = queryParams.status; // Status from URL, set by initiatePayment
    const description = queryParams.description;
    const userId = queryParams.userId;
    const objectHid = queryParams.objectHid;
    const currency = queryParams.currency || null;

    if (!paymentId) {
      debug('Dummy: Invalid webhook payload - missing paymentId');
      throw new Error('Missing paymentId in webhook query');
    }
    if (!webhookStatus) {
      debug('Dummy: Invalid webhook payload - missing status');
      throw new Error('Missing status in webhook query');
    }

    let parsedAmount: number;
    if (typeof queryAmount !== 'string' || isNaN(parseFloat(queryAmount))) {
      debug('Dummy: Invalid webhook payload - missing or invalid amount');
      throw new Error('Missing or invalid amount in webhook query');
    }
    parsedAmount = parseFloat(queryAmount);

    // Logic for determining success/error is now solely based on the status from the URL
    const isErrorCondition = webhookStatus === DUMMY_URL_STATUS_FAILURE;
    let errorMessage: string | undefined;
    if (isErrorCondition) {
      errorMessage = 'Dummy payment failed (simulated due to odd amount or explicit failure status).';
    }

    const details: DecodedWebhookDetails = {
      paymentId,
      externalPaymentId,
      amount: parsedAmount,
      currency,
      webhookStatus,
      description,
      objectHid,
      isErrorCondition,
      errorMessage,
    };
    debug('Dummy: Parsed webhook details:', details);
    return details;
  }

  async handleWebhook(request: Request, rawBody: string | Buffer): Promise<WebhookHandlingResult> {
    debug('Dummy: handleWebhook called.');
    try {
      const url = new URL(request.url);
      const queryParams = Object.fromEntries(url.searchParams.entries());
      debug('Dummy: handleWebhook received query:', queryParams);

      const paymentId = queryParams.paymentId || null; // Ensure it can be null
      const externalPaymentId = queryParams.externalPaymentId || null; // Ensure it can be null
      const queryAmount = queryParams.amount;
      const webhookStatus = queryParams.status;
      const description = queryParams.description;
      const objectHid = queryParams.objectHid;

      if (!paymentId || !webhookStatus) {
        debug('Dummy: Missing paymentId or status in webhook query.');
        return { providerName: this.providerName, processed: false, error: 'Missing paymentId or status in webhook' };
      }

      let parsedAmount: number | null = null;
      if (queryAmount) {
        parsedAmount = parseFloat(queryAmount);
        if (isNaN(parsedAmount)) {
          debug('Dummy: Invalid amount in webhook query:', queryAmount);
          return { providerName: this.providerName, processed: false, paymentId, error: 'Invalid amount in webhook' };
        }
      }

      const isErrorCondition = webhookStatus === DUMMY_URL_STATUS_FAILURE;
      let errorMessage: string | undefined = undefined;
      if (isErrorCondition) {
        errorMessage = `Payment failed as per dummy webhook status: ${webhookStatus}`;
      }

      const decodedDetails: DecodedWebhookDetails = {
        paymentId,
        externalPaymentId,
        amount: parsedAmount,
        currency: queryParams.currency || null,
        webhookStatus,
        description: description || undefined,
        objectHid: objectHid || undefined,
        isErrorCondition,
        errorMessage,
      };
      debug('Dummy: Decoded webhook details:', decodedDetails);

      const newPaymentStatus = isErrorCondition ? 'failed' : 'succeeded';

      return {
        providerName: this.providerName,
        processed: true,
        paymentId: decodedDetails.paymentId || undefined, // Ensure it can be undefined if null
        externalPaymentId: decodedDetails.externalPaymentId || undefined,
        newPaymentStatus,
        error: decodedDetails.errorMessage,
        messageToProvider: 'OK',
      };

    } catch (e: any) {
      debug('Dummy: Error processing webhook:', e.message);
      let paymentIdFromUrlOnError: string | undefined;
      try {
        const url = new URL(request.url);
        paymentIdFromUrlOnError = url.searchParams.get('paymentId') || undefined;
      } catch (_) {
        // Ignore
      }

      return {
        providerName: this.providerName, // Added providerName
        processed: false,
        paymentId: paymentIdFromUrlOnError,
        error: e.message || 'Failed to process webhook due to invalid data.',
        messageToProvider: 'ERROR',
      };
    }
  }

  async getPaymentStatus(internalPaymentId: string, externalPaymentId?: string): Promise<PaymentStatusResult> {
    debug('Dummy: getPaymentStatus called for internalId:', internalPaymentId, ', externalId:', externalPaymentId);
    return {
      internalPaymentId, // Corrected field name
      status: 'unknown',
      providerStatus: 'dummy_unknown',
      error: 'Status can only be determined via webhook for DummyProvider'
    };
  }

  // Methods for subscriptions and adding payment methods are not yet implemented in detail for dummy
  async createSubscription(args: SubscriptionDetailsArgs): Promise<CreateSubscriptionResult> {
    debug('Dummy: createSubscription called with:', args);
    const externalSubscriptionId = `dummy_sub_${uuidv4()}`;
    const needsPayment = args.planId !== 'free_plan';

    if (needsPayment) {
      const paymentResult = await this.initiatePayment({
        amount: 1000,
        currency: 'USD',
        objectHid: args.objectHid,
        userId: args.userId,
        paymentId: `dummy_init_pay_${uuidv4()}`,
        description: `Initial payment for subscription to ${args.planId}`,
        returnUrl: `${this.baseUrl}/subscriptions/callback?sub_id=${externalSubscriptionId}`
      });
      return {
        subscriptionId: `dummy_local_sub_${uuidv4()}`,
        externalSubscriptionId,
        status: paymentResult.redirectUrl ? 'pending_payment' : 'failed',
        paymentRequired: true,
        initialPaymentResult: paymentResult,
        errorMessage: paymentResult.errorMessage,
      };
    } else {
      return {
        subscriptionId: `dummy_local_sub_${uuidv4()}`,
        externalSubscriptionId,
        status: 'active',
        paymentRequired: false,
      };
    }
  }

  async cancelSubscription(args: CancelSubscriptionArgs): Promise<CancelSubscriptionResult> {
    debug('Dummy: cancelSubscription called with:', args);
    return {
      subscriptionId: args.internalSubscriptionId,
      newStatus: 'canceled',
      canceledAt: new Date().toISOString(),
    };
  }

  async addPaymentMethod(args: AddPaymentMethodArgs): Promise<AddPaymentMethodResult> {
    debug('Dummy: addPaymentMethod called with:', args);
    // Simulate adding a payment method
    return {
      paymentMethodId: `dummy_pm_${uuidv4()}`,
      externalId: `dummy_ext_pm_${uuidv4()}`,
      status: 'active',
      detailsForUser: { info: 'Dummy payment method', type: args.type },
      isRecurrentReady: true, // Always ready for dummy
    };
  }
} 