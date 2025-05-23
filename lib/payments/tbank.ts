import axios from 'axios';
import { createHash } from 'crypto';
import {
  IPaymentProcessor,
  PaymentDetailsArgs,
  InitiatePaymentResult,
  WebhookPayload,
  WebhookHandlingResult,
  PaymentStatus,
  PaymentStatusResult,
  SubscriptionDetailsArgs,
  CreateSubscriptionResult,
  CancelSubscriptionArgs,
  CancelSubscriptionResult,
  AddPaymentMethodArgs,
  AddPaymentMethodResult,
  PaymentMethodStatus,
} from './base';
import Debug from '../debug';

const debug = Debug('payment:tbank');

const TBANK_API_URL_V2 = 'https://securepay.tinkoff.ru/v2';

// TBank response statuses
const TBANK_STATUS_AUTHORIZED = 'AUTHORIZED'; // Деньги захолдированы
const TBANK_STATUS_CONFIRMED = 'CONFIRMED';   // Платёж подтверждён (для двухстадийной оплаты)
const TBANK_STATUS_REVERSED = 'REVERSED';     // Платёж отменен до подтверждения
const TBANK_STATUS_REFUNDED = 'REFUNDED';     // Платёж возвращен
const TBANK_STATUS_PARTIAL_REFUNDED = 'PARTIAL_REFUNDED'; // Частично возвращен
const TBANK_STATUS_REJECTED = 'REJECTED';     // Платёж отклонен
const TBANK_STATUS_CANCELED = 'CANCELED';     // Платёж отменен после списания (аналог REFUNDED для некоторых сценариев)
const TBANK_STATUS_COMPLETED = 'COMPLETED';   // (Нестандартный, для GetState, означает успешное завершение) - по докам GetState возвращает AUTHORIZED или CONFIRMED

// TBank card statuses for AddCard
const TBANK_CARD_STATUS_ACTIVE = 'A';
const TBANK_CARD_STATUS_INACTIVE = 'I'; // Not directly used by AddCard response, but good to know
const TBANK_CARD_STATUS_EXPIRED = 'E';  // Not directly used by AddCard response

interface TBankBaseRequest {
  TerminalKey: string;
  Token?: string; // Required for all requests except Init
}

interface TBankInitRequest extends TBankBaseRequest {
  Amount: number; // В копейках
  OrderId: string; // Наш paymentId
  Description?: string;
  DATA?: { [key: string]: string };
  Receipt?: TBankReceipt;
  ReturnUrl?: string; 
  NotificationURL?: string; 
  PayType?: 'O' | 'T'; 
  Recurrent?: 'Y'; 
  CustomerKey?: string; 
  Language?: 'ru' | 'en';
  RedirectDueDate?: string; 
}

interface TBankInitResponse {
  Success: boolean;
  ErrorCode: string;
  Message?: string;
  Details?: string;
  TerminalKey: string;
  Status: string; 
  PaymentId: string; 
  OrderId: string; 
  Amount: number;
  PaymentURL?: string; 
  CardId?: string; 
  RebillId?: string; 
}

interface TBankConfirmRequest extends TBankBaseRequest {
  PaymentId: string; 
  Amount?: number; 
  Receipt?: TBankReceipt;
}

interface TBankChargeRequest extends TBankBaseRequest {
    RebillId: string;
    Amount: number;
    OrderId: string;
    Description?: string;
    DATA?: { [key: string]: string };
    Receipt?: TBankReceipt;
    NotificationURL?: string;
    CustomerKey?: string; 
}

interface TBankGetStateRequest extends TBankBaseRequest {
  PaymentId: string; 
}

interface TBankGetStateResponse {
  Success: boolean;
  ErrorCode: string;
  Message?: string;
  TerminalKey: string;
  Status: string; 
  PaymentId: string;
  OrderId: string;
  Amount: number;
  CardId?: string;
  Pan?: string; 
  ExpDate?: string; 
}

interface TBankCancelRequest extends TBankBaseRequest {
  PaymentId: string;
  Amount?: number; 
  Receipt?: TBankReceipt; 
}

interface TBankAddCardInitRequest extends TBankBaseRequest {
    CustomerKey: string;
    CheckType?: 'NO' | 'HOLD' | '3DS'; 
    DATA?: { [key: string]: string };
    NotificationURL?: string; 
    ReturnUrl?: string;
}

interface TBankAddCardInitResponse {
    Success: boolean;
    ErrorCode: string;
    Message?: string;
    TerminalKey: string;
    CustomerKey: string;
    RequestKey: string; 
    PaymentURL?: string; 
}

interface TBankSubmitAddCardRequest extends TBankBaseRequest { 
    MD: string; 
    PaRes: string; 
    RequestKey: string; 
    CardData?: string; 
}

interface TBankGetCardListRequest extends TBankBaseRequest {
    CustomerKey: string;
}

export interface TBankCardInfo { // Kept export for card-webhook
    CardId: string;
    Pan: string; 
    ExpDate: string; 
    CardType?: string; 
    Status: 'A' | 'I' | 'E'; 
    RebillId?: string; 
    IsDefault?: boolean;
}

interface TBankGetCardListResponse extends Array<TBankCardInfo> {}

interface TBankRemoveCardRequest extends TBankBaseRequest {
    CardId: string;
    CustomerKey: string;
}

interface TBankCommonResponse {
  Success: boolean;
  ErrorCode: string;
  Message?: string;
  Details?: string;
  TerminalKey?: string;
  Status?: string;
  PaymentId?: string;
  OrderId?: string;
  Amount?: number;
  CardId?: string;
  RebillId?: string;
}

export interface TBankReceipt { // Kept export
  Email?: string;
  Phone?: string;
  EmailCompany?: string;
  Taxation: 'osn' | 'usn_income' | 'usn_income_outcome' | 'envd' | 'esn' | 'patent';
  Items: TBankReceiptItem[];
}

export interface TBankReceiptItem { // Kept export
  Name: string;
  Price: number; 
  Quantity: number;
  Amount: number; 
  PaymentMethod?: 'full_prepayment' | 'prepayment' | 'advance' | 'full_payment' | 'partial_payment' | 'credit' | 'credit_payment';
  PaymentObject?: 'commodity' | 'excise' | 'job' | 'service' | 'gambling_bet' | 'gambling_prize' | 'lottery' | 'lottery_prize' | 'intellectual_activity' | 'payment' | 'agent_commission' | 'composite' | 'another';
  Tax: 'none' | 'vat0' | 'vat10' | 'vat20' | 'vat110' | 'vat120';
  Ean13?: string;
  ShopCode?: string;
  AgentData?: any; 
  SupplierInfo?: any; 
}

export interface GenerateReceiptArgs {
  items: Array<Omit<TBankReceiptItem, 'Amount' | 'Quantity'> & { quantity: number }>;
  totalAmount: number; 
  customerEmail?: string;
  customerPhone?: string;
  paymentId: string; 
  taxationSystem: TBankReceipt['Taxation'];
}

export type ReceiptOperationType = 'payment' | 'refund' | 'confirmation';

export interface TBankProcessorOptions {
  generateReceipt?: (args: GenerateReceiptArgs, operationType: ReceiptOperationType) => TBankReceipt | null | undefined;
}

// New type for TBank provider configuration stored in DB
export interface TBankProviderDBConfig {
    terminal_key: string;
    secret_key: string;
    is_test_mode?: boolean; // This corresponds to useTestMode
    default_return_url?: string;
    default_webhook_url?: string;
    default_card_webhook_url?: string;
}

export class TBankPaymentProcessor implements IPaymentProcessor {
  readonly providerName = 'tbank';
  private terminalKey: string;
  private secretKey: string;
  private useTestMode: boolean;
  private appBaseUrl: string; // General base URL for constructing URLs if not overridden by provider config
  private providerConfig: TBankProviderDBConfig; // Store the loaded provider config
  private options: TBankProcessorOptions;

  constructor(config: {
    providerDBConfig: TBankProviderDBConfig; // Loaded from payments.providers.config
    appBaseUrl: string; // Fallback or general application base URL
    options?: TBankProcessorOptions; // Operational options like receipt generation
  }) {
    this.providerConfig = config.providerDBConfig;
    this.terminalKey = this.providerConfig.terminal_key;
    this.secretKey = this.providerConfig.secret_key;
    this.useTestMode = this.providerConfig.is_test_mode || false;
    this.appBaseUrl = config.appBaseUrl; // This is the system's default base URL
    this.options = config.options || {};

    if (!this.terminalKey || !this.secretKey) {
      throw new Error('TBank terminalKey or secretKey is missing in providerDBConfig.');
    }
    debug('TBankPaymentProcessor initialized with TerminalKey:', this.terminalKey, 'UseTestMode:', this.useTestMode);
  }

  private generateToken(requestParams: Record<string, any>): string {
    const paramsForToken = { ...requestParams };
    
    if (!paramsForToken.TerminalKey) {
        paramsForToken.TerminalKey = this.terminalKey;
    }
    if (!paramsForToken.Password) {
        paramsForToken.Password = this.secretKey;
    }

    const sortedKeys = Object.keys(paramsForToken).sort();
    let strToHash = '';
    for (const key of sortedKeys) {
      const value = paramsForToken[key];
      if (key !== 'Token' && key !== 'DATA' && key !== 'Receipt' && 
          typeof value !== 'object' && typeof value !== 'undefined' && value !== null) {
        strToHash += value;
      }
    }
    const hash = createHash('sha256').update(strToHash).digest('hex');
    return hash;
  }

  private async makeRequest<TRequest extends TBankBaseRequest, TResponse extends TBankCommonResponse>(
    endpoint: string,
    payload: Omit<TRequest, 'Token' | 'TerminalKey'>
  ): Promise<TResponse> {
    const requestPayload: any = { ...payload, TerminalKey: this.terminalKey };

    const tokenGenObj: Record<string, any> = {};
    for (const key in payload) {
      if (Object.prototype.hasOwnProperty.call(payload, key) && 
          key !== 'ReturnUrl' && 
          key !== 'Receipt' &&
          key !== 'DATA') {
        const value = (payload as any)[key];
        if (typeof value !== 'object' && typeof value !== 'undefined' && value !== null) {
          tokenGenObj[key] = value;
        }
      }
    }
    tokenGenObj.Password = this.secretKey;
    tokenGenObj.TerminalKey = this.terminalKey;
    
    requestPayload.Token = this.generateToken(tokenGenObj);

    debug(`TBank Request to ${TBANK_API_URL_V2}/${endpoint}:`, requestPayload);
    try {
      const response = await axios.post<TResponse>(`${TBANK_API_URL_V2}/${endpoint}`, requestPayload, {
        headers: { 'Content-Type': 'application/json' },
      });
      debug(`TBank Response from ${endpoint}:`, response.data);
      if (!response.data.Success && response.data.ErrorCode !== '0') {
        debug(`TBank API Error: ${response.data.Message || response.data.Details}`);
      }
      return response.data;
    } catch (error: any) {
      debug('TBank API request error:', error.response?.data || error.message);
      const errorData = error.response?.data;
      throw new Error(
        `TBank API request failed: ${errorData?.Message || errorData?.Details || error.message}`
      );
    }
  }

  private mapTBankStatusToInternal(tbankStatus: string): PaymentStatus {
    switch (tbankStatus) {
      case TBANK_STATUS_AUTHORIZED:
      case 'NEW': 
      case 'PREAUTHORIZING': 
      case 'AUTHORIZING': 
      case '3DS_CHECKING': 
      case '3DS_CHECKED': 
        return PaymentStatus.PENDING_CONFIRMATION;

      case TBANK_STATUS_CONFIRMED: 
      case TBANK_STATUS_COMPLETED: 
        return PaymentStatus.SUCCEEDED;

      case TBANK_STATUS_REJECTED:
      case 'DEADLINE_EXPIRED': 
        return PaymentStatus.FAILED;

      case TBANK_STATUS_CANCELED: 
      case TBANK_STATUS_REFUNDED:
      case TBANK_STATUS_PARTIAL_REFUNDED:
        return PaymentStatus.REFUNDED; 

      case TBANK_STATUS_REVERSED: 
        return PaymentStatus.CANCELED;
      
      default:
        debug(`Unknown TBank status: ${tbankStatus}`);
        return PaymentStatus.UNKNOWN;
    }
  }

  async initiatePayment(args: PaymentDetailsArgs): Promise<InitiatePaymentResult> {
    debug('TBank: initiatePayment called with:', args);
    const { paymentId, amount, currency, description, userId, objectHid, returnUrl, metadata } = args;

    if (currency !== 'RUB') {
      debug('Warning: TBank currency is usually RUB. Amount is expected in kopecks.');
    }
    const amountInKopecks = Math.round(amount * 100);

    const finalReturnUrl = returnUrl || this.providerConfig.default_return_url || `${this.appBaseUrl}/payments/callback/tbank/${paymentId}`;
    const notificationUrl = this.providerConfig.default_webhook_url || `${this.appBaseUrl}/api/payments/tbank/webhook`;

    const requestPayload: Omit<TBankInitRequest, 'Token' | 'TerminalKey'> = {
      Amount: amountInKopecks,
      OrderId: paymentId,
      Description: description,
      NotificationURL: notificationUrl,
      Language: 'ru',
      DATA: {
        userId: userId || '',
        objectHid: objectHid || '',
        ...(metadata?.isRecurrent && { Recurrent: 'Y' }), 
      },
      ...(metadata?.customerKey && { CustomerKey: metadata.customerKey }),
      ...(metadata?.isRecurrent && { Recurrent: 'Y' }), 
      ReturnUrl: finalReturnUrl, 
    };
    
    if (metadata?.tbankPayType === 'T' || metadata?.tbankPayType === 'O') {
        requestPayload.PayType = metadata.tbankPayType;
    } else {
        requestPayload.PayType = 'O'; 
    }

    try {
      const response = await this.makeRequest<TBankInitRequest, TBankInitResponse>('Init', requestPayload);

      if (response.Success && response.PaymentURL) {
        return {
          paymentId,
          externalPaymentId: response.PaymentId,
          status: PaymentStatus.PENDING_USER_ACTION, 
          redirectUrl: response.PaymentURL,
          providerResponse: response,
        };
      } else if (response.Success && response.Status === 'NEW' && response.RebillId && metadata?.isRecurrent) {
        // This case seems specific for immediate recurrent setup without user redirection (e.g. using a saved card implicitly)
        // We should check the status via GetState or rely on webhook. For now, let's assume GetState.
        const statusCheck = await this.getPaymentStatus(paymentId, response.PaymentId);
         return {
            paymentId,
            externalPaymentId: response.PaymentId,
            status: statusCheck.status, // Get the actual status
            providerResponse: response, // Contains RebillId etc.
        };
      } else {
        return {
          paymentId,
          externalPaymentId: response.PaymentId, 
          status: PaymentStatus.FAILED,
          errorMessage: response.Message || response.Details || `TBank Init failed with ErrorCode: ${response.ErrorCode}`,
          providerResponse: response,
        };
      }
    } catch (error: any) {
      return {
        paymentId,
        status: PaymentStatus.ERROR,
        errorMessage: error.message,
        providerResponse: error,
      };
    }
  }

  async handleWebhook(request: Request, rawBody: string | Buffer): Promise<WebhookHandlingResult> {
    // Note: The 'request' object is not used by TBank's webhook logic internally as TBank sends x-www-form-urlencoded.
    // The actual validation of webhook origin should ideally happen at a higher level (e.g., firewall, specific IP checks if TBank provides fixed IPs).
    debug('TBank: handleWebhook called.');
    let payload: any;
    try {
      if (typeof rawBody === 'string') {
        payload = Object.fromEntries(new URLSearchParams(rawBody));
      } else if (Buffer.isBuffer(rawBody)) {
         payload = Object.fromEntries(new URLSearchParams(rawBody.toString()));
      } else if (typeof rawBody === 'object' && rawBody !== null) {
        payload = rawBody; 
      } else {
        throw new Error('Invalid rawBody type for TBank webhook');
      }
      debug('TBank webhook payload:', payload);

      // Token validation is crucial.
      // The received payload includes 'TerminalKey'. We need to ensure it matches THIS processor instance's terminalKey.
      // This is important if multiple TBank providers are configured with different webhook endpoints pointing to the same handler.
      // However, if a single webhook endpoint handles ALL TBank providers, then we need to fetch the correct secretKey based on payload.TerminalKey.
      // For now, assuming this instance IS the correct one for the given TerminalKey in payload.
      if (payload.TerminalKey && payload.TerminalKey !== this.terminalKey) {
        debug('TBank webhook TerminalKey mismatch. Received:', payload.TerminalKey, 'Expected for this processor instance:', this.terminalKey);
        // This scenario implies the webhook was routed to the wrong processor instance or requires dynamic secret key lookup.
        // For now, we'll treat it as a configuration error for this instance.
        return {
          providerName: this.providerName,
          processed: false,
          error: 'Webhook TerminalKey mismatch with processor instance.',
          paymentId: payload.OrderId,
          messageToProvider: 'ERROR',
        };
      }
      
      const receivedToken = payload.Token;
      const payloadForTokenCalculation = { ...payload };
      delete payloadForTokenCalculation.Token;
      
      // @ts-ignore - generateToken expects specific structure, ensure all primitive fields from payload are here.
      // Password (this.secretKey) is added by generateToken.
      // TerminalKey should be part of payloadForTokenCalculation for generateToken if it's signed by TBank.
      // The current generateToken adds this.terminalKey. If TBank signs with the TerminalKey in the payload,
      // we should pass payload.TerminalKey to generateToken or ensure consistency.
      // For now, assuming generateToken uses this.terminalKey which should match payload.TerminalKey after the check above.
      const expectedToken = this.generateToken(payloadForTokenCalculation);


      if (receivedToken !== expectedToken) {
        debug('TBank webhook token mismatch. Received:', receivedToken, 'Expected:', expectedToken);
        debug('Payload for token calc (before adding Password by generateToken):', payloadForTokenCalculation);
        return {
          providerName: this.providerName,
          processed: false,
          error: 'Webhook token mismatch',
          paymentId: payload.OrderId,
          messageToProvider: 'ERROR', 
        };
      }

      const internalPaymentId = payload.OrderId;
      const externalPaymentId = payload.PaymentId;
      const tbankStatus = payload.Status;
      const amount = payload.Amount ? parseFloat(payload.Amount) / 100 : undefined; 

      if (!internalPaymentId || !tbankStatus) {
        return { providerName: this.providerName, processed: false, error: 'Missing OrderId or Status in TBank webhook', messageToProvider: 'ERROR' };
      }

      const newPaymentStatus = this.mapTBankStatusToInternal(tbankStatus);

      return {
        providerName: this.providerName,
        processed: true,
        paymentId: internalPaymentId,
        externalPaymentId,
        newPaymentStatus,
        providerResponse: payload,
        messageToProvider: 'OK',
        ...(payload.RebillId && { subscriptionId: payload.OrderId }), // Assuming OrderId can serve as subscriptionId placeholder
        ...(payload.RebillId && tbankStatus === TBANK_STATUS_CONFIRMED && { newSubscriptionStatus: 'active' }),
        ...(payload.RebillId && (tbankStatus === TBANK_STATUS_REJECTED) && { newSubscriptionStatus: 'past_due' })
      };

    } catch (e: any) {
      debug('TBank: Error processing webhook:', e.message, e.stack);
      return {
        providerName: this.providerName,
        processed: false,
        paymentId: payload?.OrderId, 
        error: e.message || 'Failed to process TBank webhook.',
        messageToProvider: 'ERROR',
      };
    }
  }

  async getPaymentStatus(internalPaymentId: string, externalPaymentId?: string): Promise<PaymentStatusResult> {
    debug(`TBank: getPaymentStatus called for internalId: ${internalPaymentId}, externalId: ${externalPaymentId}`);
    if (!externalPaymentId) {
      // Attempt to find externalPaymentId from internalPaymentId in DB if not provided (not implemented here)
      // For now, require externalPaymentId for GetState.
      return {
        internalPaymentId,
        status: PaymentStatus.UNKNOWN,
        error: 'External Payment ID (PaymentId from TBank) is required for TBank GetState.',
      };
    }

    const requestPayload: Omit<TBankGetStateRequest, 'Token' | 'TerminalKey'> = {
      PaymentId: externalPaymentId,
    };

    try {
      const response = await this.makeRequest<TBankGetStateRequest, TBankGetStateResponse>('GetState', requestPayload);

      if (response.Success) {
        const currentStatus = this.mapTBankStatusToInternal(response.Status);
        return {
          internalPaymentId: response.OrderId || internalPaymentId, // TBank returns OrderId (our internal ID)
          status: currentStatus,
          providerStatus: response.Status,
          paidAt: currentStatus === PaymentStatus.SUCCEEDED ? new Date().valueOf() : undefined, // Set paidAt if succeeded
          providerResponse: response,
        };
      } else {
        return {
          internalPaymentId,
          status: PaymentStatus.UNKNOWN, 
          providerStatus: response.Status, 
          error: response.Message || `TBank GetState failed with ErrorCode: ${response.ErrorCode}`,
          providerResponse: response,
        };
      }
    } catch (error: any) {
      return {
        internalPaymentId,
        status: PaymentStatus.ERROR,
        error: error.message,
        providerResponse: error,
      };
    }
  }
  
  async confirmPayment(externalPaymentId: string, amount?: number, receiptArgs?: GenerateReceiptArgs): Promise<TBankCommonResponse> {
    debug(`TBank: confirmPayment called for externalId: ${externalPaymentId}, amount: ${amount}`);
    const requestPayload: Omit<TBankConfirmRequest, 'Token' | 'TerminalKey'> = {
      PaymentId: externalPaymentId,
    };
    if (typeof amount === 'number') {
      requestPayload.Amount = Math.round(amount * 100); 
    }

    if (this.options.generateReceipt && receiptArgs) {
      const receipt = this.options.generateReceipt(receiptArgs, 'confirmation');
      if (receipt) {
        requestPayload.Receipt = receipt;
      }
    }
    return this.makeRequest<TBankConfirmRequest, TBankCommonResponse>('Confirm', requestPayload);
  }

  async cancelPayment(externalPaymentId: string, amount?: number, receiptArgs?: GenerateReceiptArgs): Promise<TBankCommonResponse> {
    debug(`TBank: cancelPayment called for externalId: ${externalPaymentId}, amount: ${amount}`);
    const requestPayload: Omit<TBankCancelRequest, 'Token' | 'TerminalKey'> = {
      PaymentId: externalPaymentId,
    };
    if (typeof amount === 'number') {
      requestPayload.Amount = Math.round(amount * 100); 
    }

    if (this.options.generateReceipt && receiptArgs) {
      const receipt = this.options.generateReceipt(receiptArgs, 'refund'); // or 'cancellation' if fiscal laws differ
      if (receipt) {
        requestPayload.Receipt = receipt;
      }
    }
    return this.makeRequest<TBankCancelRequest, TBankCommonResponse>('Cancel', requestPayload);
  }

  async createSubscription(args: SubscriptionDetailsArgs): Promise<CreateSubscriptionResult> {
    debug('TBank: createSubscription (initiating first recurrent payment) called with:', args);

    const { planId, userId, paymentMethodId, objectHid, metadata } = args;

    const customerKey = metadata?.tbankCustomerKey as string | undefined;
    const initialAmount = metadata?.tbankInitialAmount as number | undefined; // in major units (rubles)
    const currency = metadata?.tbankCurrency as string | undefined || 'RUB'; 
    const description = metadata?.tbankDescription as string | undefined;
    
    // Use return URL from provider config if available, else construct from appBaseUrl
    const defaultInitialPaymentReturnUrl = this.providerConfig.default_return_url 
        ? `${this.providerConfig.default_return_url}${this.providerConfig.default_return_url.includes('?') ? '&' : '?'}subscription_id_placeholder=${planId}` // append placeholder
        : `${this.appBaseUrl}/subscriptions/callback/tbank?subscription_id_placeholder=${planId}`;
    const returnUrl = metadata?.tbankReturnUrl as string | undefined || defaultInitialPaymentReturnUrl;


    if (!customerKey) {
        throw new Error('tbankCustomerKey is required in metadata for TBank subscriptions.');
    }
    if (typeof initialAmount !== 'number') {
        throw new Error('tbankInitialAmount (number in major units) is required in metadata for TBank subscriptions.');
    }

    const initialPaymentId = `sub_init_${userId}_${planId}_${Date.now()}`;

    const initArgs: PaymentDetailsArgs = {
      paymentId: initialPaymentId,
      amount: initialAmount, // Amount in major units (rubles) for initiatePayment
      currency,
      description: description || `Initial payment for plan ${planId}`,
      userId,
      objectHid,
      returnUrl: returnUrl, 
      metadata: {
        isRecurrent: true, 
        customerKey: customerKey, 
        ...(paymentMethodId && { tbankCardId: paymentMethodId }), 
        tbankPayType: metadata?.tbankPayType || 'O', // Default to one-stage for initial recurrent
      },
      ...(paymentMethodId && { paymentMethodId }), // Pass our internal PM ID if available
      customerId: customerKey, // TBank's CustomerKey
    };

    const initResult = await this.initiatePayment(initArgs);

    if (initResult.status === PaymentStatus.PENDING_USER_ACTION || initResult.status === PaymentStatus.SUCCEEDED || initResult.status === PaymentStatus.PENDING_CONFIRMATION) {
      const tbankInitResponse = initResult.providerResponse as TBankInitResponse | undefined;
      const rebillId = tbankInitResponse?.RebillId;

      if (rebillId) {
        return {
          subscriptionId: initialPaymentId, // Placeholder, actual ID from DB after insertion
          externalSubscriptionId: rebillId, 
          status: initResult.redirectUrl ? 'pending_initial_payment' : (initResult.status === PaymentStatus.SUCCEEDED ? 'active' : 'pending_confirmation'),
          paymentRequired: !!initResult.redirectUrl,
          initialPaymentResult: initResult,
        };
      } else {
         // If RebillId is not present but payment was successful (e.g. with saved card but recurrent not set up yet), this is an issue.
         // Or if it's pending user action (redirect) but no RebillId, this means recurrent setup itself might have issues in Init response.
         throw new Error('Failed to obtain RebillId from TBank after initial payment attempt. Provider response: ' + JSON.stringify(initResult.providerResponse));
      }
    } else {
      throw new Error(initResult.errorMessage || 'Failed to initiate first recurrent payment with TBank. Status: ' + initResult.status);
    }
  }
  
  async chargeRecurrent(args: {
    rebillId: string,
    orderId: string, 
    amount: number, // Major units (rubles)
    description?: string,
    customerKey?: string 
  }): Promise<TBankInitResponse> { 
    debug('TBank: chargeRecurrent called with:', args);
    const amountInKopecks = Math.round(args.amount * 100);
    const notificationUrl = this.providerConfig.default_webhook_url || `${this.appBaseUrl}/api/payments/tbank/webhook`;

    const requestPayload: Omit<TBankChargeRequest, 'Token' | 'TerminalKey'> = {
        RebillId: args.rebillId,
        Amount: amountInKopecks,
        OrderId: args.orderId,
        NotificationURL: notificationUrl,
        Description: args.description,
        ...(args.customerKey && { CustomerKey: args.customerKey }),
    };
    return this.makeRequest<TBankChargeRequest, TBankInitResponse>('Charge', requestPayload);
  }

  async cancelSubscription(args: CancelSubscriptionArgs): Promise<CancelSubscriptionResult> {
    debug('TBank: cancelSubscription called with:', args);
    // TBank does not have a direct API to "cancel" a RebillId.
    // Cancellation is managed by not making future `Charge` calls.
    // If there's a need to deactivate the card associated with RebillId, use `removeCard`.
    return {
      subscriptionId: args.internalSubscriptionId, 
      newStatus: 'canceled', 
      canceledAt: new Date().valueOf(),
    };
  }

  async addPaymentMethod(args: AddPaymentMethodArgs): Promise<AddPaymentMethodResult> {
    debug('TBank: addPaymentMethod called with:', args);
    const { userId, type, details } = args; 

    const customerKey = details?.tbankCustomerKey as string | undefined;
    const checkType = (details?.tbankCheckType as 'NO' | 'HOLD' | '3DS') || '3DS'; 

    if (type !== 'card') {
      throw new Error('TBank provider currently only supports adding card payment methods.');
    }
    if (!customerKey) {
      throw new Error('tbankCustomerKey is required in details to add a payment method with TBank.');
    }

    // Use card-specific webhook and return URLs from provider config if available
    const notificationUrl = this.providerConfig.default_card_webhook_url || `${this.appBaseUrl}/api/payments/tbank/card-webhook`;
    const defaultCardReturnUrl = this.providerConfig.default_return_url // Could be same as payment return url or specific
        ? `${this.providerConfig.default_return_url}${this.providerConfig.default_return_url.includes('?') ? '&' : '?'}customerKey=${customerKey}&userId=${userId}`
        : `${this.appBaseUrl}/payment-methods/callback/tbank?customerKey=${customerKey}&userId=${userId}`; // General callback
    const finalReturnUrl = details?.tbankReturnUrl as string | undefined || defaultCardReturnUrl;


    const requestPayload: Omit<TBankAddCardInitRequest, 'Token' | 'TerminalKey'> = {
      CustomerKey: customerKey,
      CheckType: checkType,
      NotificationURL: notificationUrl,
      ReturnUrl: finalReturnUrl,
      DATA: { userId: userId || '', ...(details?.DATA || {}) } // Merge any other DATA passed in details
    };

    try {
      const response = await this.makeRequest<TBankAddCardInitRequest, TBankAddCardInitResponse & TBankCommonResponse>('AddCard', requestPayload);

      if (response.Success && response.PaymentURL && response.RequestKey) {
        debug(`TBank AddCard: User redirection needed to: ${response.PaymentURL}. RequestKey: ${response.RequestKey}`);
        return {
          paymentMethodId: '', // Will be set after webhook confirmation
          externalId: undefined, // Will be CardId after webhook
          status: PaymentMethodStatus.PENDING_USER_ACTION,
          isRecurrentReady: false, 
          detailsForUser: { message: 'Redirect to TBank page required for card verification.', requestKey: response.RequestKey, customerKey },
          redirectUrl: response.PaymentURL, 
        };
      } else if (response.Success && !response.PaymentURL && response.RequestKey) {
        // This case usually means CheckType='NO' was used and card added directly (not recommended)
        // or some other flow where immediate confirmation happened.
        // We should still probably wait for webhook or poll GetCardList to confirm and get RebillId.
        debug(`TBank AddCard: Initiated, awaiting confirmation (no redirect URL). RequestKey: ${response.RequestKey}`);
        return {
            paymentMethodId: '', 
            externalId: undefined,
            status: PaymentMethodStatus.PENDING_CONFIRMATION, // Or ACTIVE if card added directly and we can confirm
            isRecurrentReady: false, // Update after confirmation
            detailsForUser: { message: 'Card addition initiated, awaiting confirmation.', requestKey: response.RequestKey, customerKey },
        };
      }
      else {
        const errorMessage = response.Message || response.Details || `TBank AddCard failed with ErrorCode: ${response.ErrorCode}`;
        debug('TBank AddCard failure response:', response);
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      debug('TBank AddCard Error:', error);
      // If error object has provider response, include it
      const providerErrorResponse = error.providerResponse || error.response?.data;
      const errorMessage = providerErrorResponse?.Message || providerErrorResponse?.Details || error.message;
      throw new Error(`TBank AddCard request failed: ${errorMessage}`);
    }
  }

  async getCardList(customerKey: string): Promise<TBankGetCardListResponse | null> {
    debug('TBank: getCardList called for customerKey:', customerKey);
    
    const tokenPayload = { CustomerKey: customerKey }; // Fields to be signed for GetCardList token
                                                     // TerminalKey and Password will be added by generateToken

    const fullRequestPayloadForGetCardList: TBankGetCardListRequest = {
        TerminalKey: this.terminalKey,
        CustomerKey: customerKey,
        Token: this.generateToken(tokenPayload) 
    };

    try {
      debug('TBank Request to GetCardList:', fullRequestPayloadForGetCardList);
      const response = await axios.post<TBankGetCardListResponse | TBankCommonResponse>( // Success is Array, Error is Object
        `${TBANK_API_URL_V2}/GetCardList`,
        fullRequestPayloadForGetCardList,
        { headers: { 'Content-Type': 'application/json' } }
      );
      debug('TBank Response from GetCardList:', response.data);

      if (Array.isArray(response.data)) {
        return response.data as TBankGetCardListResponse;
      } else if (response.data && typeof response.data === 'object') {
        const objectResponse = response.data as TBankCommonResponse;
        if (objectResponse.Success === false && objectResponse.ErrorCode !== '0') {
          debug(`TBank GetCardList API Error: ${objectResponse.Message || objectResponse.Details}`);
          // Consider throwing error or returning null based on how caller handles it
          throw new Error(`TBank GetCardList failed: ${objectResponse.Message || objectResponse.Details}`);
        }
        // If Success is true or ErrorCode '0' but not an array, it might mean an empty list for some TBank versions.
        if (objectResponse.Success === true || (objectResponse.Success !== false && objectResponse.ErrorCode === '0')) {
            debug('TBank GetCardList: Success response was an object, assuming empty list or no cards.');
            return []; // Return empty array for consistency
        }
        debug('TBank GetCardList: Unexpected object response structure for success.');
        throw new Error('TBank GetCardList returned unexpected object response for success.');
      } else {
        debug('TBank GetCardList: Unexpected response type.');
        throw new Error('TBank GetCardList returned unexpected response type.');
      }
    } catch (error: any) {
      const errorResponse = error.response?.data as TBankCommonResponse;
      const errorMessage = errorResponse?.Message || errorResponse?.Details || error.message;
      debug(`TBank GetCardList request failed: ${errorMessage}`, error.response?.data || error);
      throw new Error(`TBank GetCardList request failed: ${errorMessage}`);
    }
  }

  async removeCard(customerKey: string, cardId: string): Promise<TBankCommonResponse> {
    debug('TBank: removeCard called for customerKey:', customerKey, 'cardId:', cardId);
    const requestPayload: Omit<TBankRemoveCardRequest, 'Token' | 'TerminalKey'> = {
        CustomerKey: customerKey,
        CardId: cardId,
    };
    return this.makeRequest<TBankRemoveCardRequest, TBankCommonResponse>('RemoveCard', requestPayload);
  }
}
