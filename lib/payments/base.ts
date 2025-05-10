export interface PaymentDetailsArgs {
  amount: number;
  currency: string;
  description?: string;
  objectHid: string;
  userId: string;
  paymentId: string; // наш внутренний ID платежа, который создается до инициации
  paymentMethodId?: string; 
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
  paymentId?: string; 
  subscriptionId?: string; 
  newPaymentStatus?: string; // Новый статус для нашего платежа
  newSubscriptionStatus?: string; // Новый статус для нашей подписки
  processed: boolean; 
  error?: string; 
  messageToProvider?: string; // Что ответить провайдеру (например, 'OK' или JSON)
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
  userId: string;
  planId: string; // Наш внутренний ID плана
  paymentMethodId?: string; // Если метод оплаты уже есть
  trialDays?: number;
  objectHid: string;
  metadata?: Record<string, any>;
}

export interface CreateSubscriptionResult {
  subscriptionId: string; // Наш внутренний ID подписки
  externalSubscriptionId?: string;
  status: string; // Наш внутренний статус подписки
  paymentRequired?: boolean; // Нужен ли первичный платеж
  initialPaymentResult?: InitiatePaymentResult; // Если нужен первичный платеж
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
  paymentMethodId: string; // Наш ID сохраненного метода
  externalId?: string; // ID от провайдера
  status: string; // "active", "pending_verification"
  detailsForUser?: Record<string, any>; // e.g. last4, brand
  isRecurrentReady?: boolean;
  errorMessage?: string;
}

export interface IPaymentProcessor {
  providerName: string;
  initiatePayment(args: PaymentDetailsArgs): Promise<InitiatePaymentResult>;
  handleWebhook(request: Request, rawBody: string | Buffer): Promise<WebhookHandlingResult>;
  getPaymentStatus(internalPaymentId: string, externalPaymentId?: string): Promise<PaymentStatusResult>;
  createSubscription?(args: SubscriptionDetailsArgs): Promise<CreateSubscriptionResult>;
  cancelSubscription?(args: CancelSubscriptionArgs): Promise<CancelSubscriptionResult>;
  addPaymentMethod?(args: AddPaymentMethodArgs): Promise<AddPaymentMethodResult>;
  // Можно добавить и другие методы, например, для возвратов, получения списка методов и т.д.
} 