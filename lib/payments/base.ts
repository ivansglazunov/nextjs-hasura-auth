export interface PaymentDetailsArgs {
  amount: number;
  currency: string;
  description?: string;
  objectHid: string; // HID of the object being paid for (e.g., product, service, order)
  userId: string;
  paymentId: string; // our internal payment ID, created before initiation
  paymentMethodId?: string;
  customerId?: string; // External customer ID from the payment provider
  returnUrl?: string;
  metadata?: Record<string, any>;
}

export interface InitiatePaymentResult {
  paymentId: string;
  externalPaymentId?: string;
  status: string;
  redirectUrl?: string;
  sdkData?: any;
  providerResponse?: any;
  errorMessage?: string;
}

export interface WebhookPayload {
  eventType: string; // e.g., 'payment_succeeded', 'payment_failed', 'subscription_updated'
  externalPaymentId?: string;
  externalSubscriptionId?: string;
  amount?: number;
  currency?: string;
  status?: string;
  data?: any; // Raw data from provider
}

export interface WebhookHandlingResult {
  providerName: string;
  paymentId?: string; // our internal ID
  externalPaymentId?: string;
  subscriptionId?: string;
  newPaymentStatus?: string; // New status for our payment
  newSubscriptionStatus?: string; // New status for our subscription
  processed: boolean; // Whether the webhook was successfully processed by the handler
  error?: string; // Error message if processing failed
  messageToProvider?: string; // What to respond to the provider (e.g., 'OK' or JSON)
}

export interface PaymentStatusResult {
  internalPaymentId: string;
  status: string;
  providerStatus?: string;
  paidAt?: Date | string;
  error?: string;
  providerResponse?: any;
}

export interface SubscriptionDetailsArgs {
  objectHid: string; // HID of the object/service being subscribed to
  userId: string;
  planId: string; // Our internal plan ID
  paymentMethodId?: string; // If payment method already exists
  trialDays?: number;
  couponCode?: string;
  metadata?: Record<string, any>;
}

export interface CreateSubscriptionResult {
  subscriptionId: string; // Our internal subscription ID
  externalSubscriptionId?: string;
  status: string; // Our internal subscription status (e.g., 'trialing', 'active', 'pending_payment')
  paymentRequired?: boolean; // Is initial payment required
  initialPaymentResult?: InitiatePaymentResult; // If initial payment is required
  errorMessage?: string;
}

export interface CancelSubscriptionArgs {
  internalSubscriptionId: string;
  cancelAtPeriodEnd?: boolean;
  reason?: string;
}

export interface CancelSubscriptionResult {
  subscriptionId: string;
  newStatus: string;
  canceledAt?: Date | string;
  errorMessage?: string;
}

export interface AddPaymentMethodArgs {
  userId: string;
  providerName: string; // "dummy", "tbank" etc.
  type: string; // "card", "wallet"
  details: Record<string, any>; // e.g. card token from client-side SDK
  setAsDefault?: boolean;
}

export interface AddPaymentMethodResult {
  paymentMethodId: string; // Our ID for the saved method
  externalId?: string; // ID from the provider
  status: string; // "active", "pending_verification"
  detailsForUser?: Record<string, any>; // e.g. last4, brand
  isRecurrentReady: boolean;
  errorMessage?: string;
  /**
   * Adds a new payment method for a user (e.g., tokenizing a card).
   */
  addPaymentMethod?(args: AddPaymentMethodArgs): Promise<AddPaymentMethodResult>;
  // Other methods can be added, for example, for refunds, getting a list of methods, etc.
}

export interface IPaymentProcessor {
  providerName: string;
  initiatePayment(args: PaymentDetailsArgs): Promise<InitiatePaymentResult>;
  handleWebhook(request: Request, rawBody: string | Buffer): Promise<WebhookHandlingResult>;
  getPaymentStatus(internalPaymentId: string, externalPaymentId?: string): Promise<PaymentStatusResult>;
  createSubscription?(args: SubscriptionDetailsArgs): Promise<CreateSubscriptionResult>;
  cancelSubscription?(args: CancelSubscriptionArgs): Promise<CancelSubscriptionResult>;
  addPaymentMethod?(args: AddPaymentMethodArgs): Promise<AddPaymentMethodResult>;
  // Other methods can be added, for example, for refunds, getting a list of methods, etc.
} 