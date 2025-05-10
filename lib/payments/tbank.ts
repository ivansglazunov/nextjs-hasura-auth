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
import Debug from '@/lib/debug';

const debug = Debug('payment:tbank');

const TBANK_API_URL_V2 = 'https://securepay.tbank.ru/v2';

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
  ReturnUrl?: string; // Не используется в API напрямую, но мы его можем использовать для нашего RedirectURL
  NotificationURL?: string; // URL для HTTP уведомлений
  PayType?: 'O' | 'T'; // O - одна стадия, T - две стадии
  Recurrent?: 'Y'; // Для регистрации рекуррентного платежа
  CustomerKey?: string; // ID покупателя для сохранения карты
  Language?: 'ru' | 'en';
  RedirectDueDate?: string; // YYYY-MM-DDTHH:MM:SS+GMT e.g. 2016-08-05T14:30:00+03:00. Срок жизни ссылки на оплату.
}

interface TBankInitResponse {
  Success: boolean;
  ErrorCode: string;
  Message?: string;
  Details?: string;
  TerminalKey: string;
  Status: string; // e.g. NEW
  PaymentId: string; // ID платежа в системе Банка (externalPaymentId)
  OrderId: string; // Наш paymentId
  Amount: number;
  PaymentURL?: string; // Ссылка на страницу оплаты
  CardId?: string; // ID карты, если использовался рекуррентный платеж или была привязана карта
  RebillId?: string; // ID рекуррентного платежа в системе банка, если Recurrent=Y
}

interface TBankConfirmRequest extends TBankBaseRequest {
  PaymentId: string; // ID платежа в системе Банка
  Amount?: number; // В копейках, если отличается от инициализированной
  Receipt?: TBankReceipt;
}

// TBankChargeRequest is similar to Init but uses RebillId
interface TBankChargeRequest extends TBankBaseRequest {
    RebillId: string;
    Amount: number;
    OrderId: string;
    Description?: string;
    DATA?: { [key: string]: string };
    Receipt?: TBankReceipt;
    NotificationURL?: string;
    CustomerKey?: string; // For recurrent payments by user
}


interface TBankGetStateRequest extends TBankBaseRequest {
  PaymentId: string; // ID платежа в системе Банка
}

interface TBankGetStateResponse {
  Success: boolean;
  ErrorCode: string;
  Message?: string;
  TerminalKey: string;
  Status: string; // AUTHORIZED, CONFIRMED, REJECTED, etc.
  PaymentId: string;
  OrderId: string;
  Amount: number;
  CardId?: string;
  Pan?: string; // Masked card number
  ExpDate?: string; // MMYY
}

interface TBankCancelRequest extends TBankBaseRequest {
  PaymentId: string;
  Amount?: number; // Для частичной отмены/возврата
  Receipt?: TBankReceipt; // Для возврата с чеком
}

// AddCard specific requests
interface TBankAddCardInitRequest extends TBankBaseRequest {
    CustomerKey: string;
    CheckType?: 'NO' | 'HOLD' | '3DS'; // NO - без проверки, HOLD - с холированием (1р), 3DS - с 3DS
    DATA?: { [key: string]: string };
    NotificationURL?: string; // URL для HTTP уведомлений
    ReturnUrl?: string;
}

interface TBankAddCardInitResponse {
    Success: boolean;
    ErrorCode: string;
    Message?: string;
    TerminalKey: string;
    CustomerKey: string;
    RequestKey: string; // Идентификатор запроса на привязку карты
    PaymentURL?: string; // Ссылка на страницу 3DS или страницу ввода данных карты
}

interface TBankSubmitAddCardRequest extends TBankBaseRequest { // This is not a direct API call, but represents the data submitted from the PaymentURL form
    MD: string; // Transaction ID from ACS
    PaRes: string; // Результат проверки 3DS
    RequestKey: string; // From AddCardInitResponse if CheckType=3DS
    CardData?: string; // Encrypted card data if CheckType=NO (not recommended)
}

interface TBankGetCardListRequest extends TBankBaseRequest {
    CustomerKey: string;
}

interface TBankCardInfo {
    CardId: string;
    Pan: string; // Masked card number like 444444******4444
    ExpDate: string; // MMYY
    CardType?: string; // 0 - Visa, 1 - Mastercard, 2 - Maestro etc.
    Status: 'A' | 'I' | 'E'; // Active, Inactive, Expired
    RebillId?: string; // Если карта может быть использована для рекуррентных платежей
    IsDefault?: boolean;
}

interface TBankGetCardListResponse extends Array<TBankCardInfo> {}


interface TBankRemoveCardRequest extends TBankBaseRequest {
    CardId: string;
    CustomerKey: string;
}

// General TBank response type
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


interface TBankReceipt {
  Email?: string;
  Phone?: string;
  EmailCompany?: string;
  Taxation: 'osn' | 'usn_income' | 'usn_income_outcome' | 'envd' | 'esn' | 'patent';
  Items: TBankReceiptItem[];
}

interface TBankReceiptItem {
  Name: string;
  Price: number; // В копейках
  Quantity: number;
  Amount: number; // В копейках (Price * Quantity)
  PaymentMethod?: 'full_prepayment' | 'prepayment' | 'advance' | 'full_payment' | 'partial_payment' | 'credit' | 'credit_payment';
  PaymentObject?: 'commodity' | 'excise' | 'job' | 'service' | 'gambling_bet' | 'gambling_prize' | 'lottery' | 'lottery_prize' | 'intellectual_activity' | 'payment' | 'agent_commission' | 'composite' | 'another';
  Tax: 'none' | 'vat0' | 'vat10' | 'vat20' | 'vat110' | 'vat120';
  Ean13?: string;
  ShopCode?: string;
  AgentData?: any; // AgentData object
  SupplierInfo?: any; // SupplierInfo object
}


export class TBankPaymentProcessor implements IPaymentProcessor {
  readonly providerName = 'tbank';
  private terminalKey: string;
  private secretKey: string;
  private useTestMode: boolean; // To potentially use different keys or slightly different logic if needed
  private appBaseUrl: string;

  constructor(config: {
    terminalKey: string;
    secretKey: string;
    useTestMode?: boolean;
    appBaseUrl?: string;
  }) {
    this.terminalKey = config.terminalKey;
    this.secretKey = config.secretKey;
    this.useTestMode = config.useTestMode || false;
    this.appBaseUrl = config.appBaseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (!this.terminalKey || !this.secretKey) {
      throw new Error('TBank terminalKey or secretKey is missing.');
    }
  }

  private generateToken(requestParams: Omit<TBankBaseRequest, 'Token' | 'TerminalKey'> & { Password?: string, TerminalKey?: string }): string {
    const params = { TerminalKey: this.terminalKey, ...requestParams };
    if (!params.Password && this.secretKey) {
      params.Password = this.secretKey;
    }

    const sortedKeys = Object.keys(params).sort();
    let strToHash = '';
    for (const key of sortedKeys) {
      // @ts-ignore
      const value = params[key];
      if (key !== 'Token' && typeof value !== 'object' && typeof value !== 'undefined' && value !== null) {
        strToHash += value;
      }
    }
    // debug('String to hash for token:', strToHash);
    const hash = createHash('sha256').update(strToHash).digest('hex');
    // debug('Generated token:', hash);
    return hash;
  }

  private async makeRequest<TRequest extends TBankBaseRequest, TResponse extends TBankCommonResponse>(
    endpoint: string,
    payload: Omit<TRequest, 'Token' | 'TerminalKey'>
  ): Promise<TResponse> {
    const requestPayload: any = { ...payload, TerminalKey: this.terminalKey };

    // Add Password to payload for token generation, but remove it before sending the request
    const payloadForToken = { ...requestPayload, Password: this.secretKey };
    delete payloadForToken.Receipt; // Receipt object is not part of token calculation

    // Special handling for DATA and Receipt objects if they exist, they should be part of token calculation
    // but not as [object Object]. The API docs suggest that complex objects like Receipt and DATA are not directly part of the token.
    // However, the example for Init token includes Receipt fields. This area is tricky.
    // For now, following the general rule: sort keys, concat values.
    // If specific fields from Receipt/DATA are needed, they must be flattened into payloadForToken.
    // The TBank example shows Receipt being stringified and then included in the signature.
    // This is not standard. Assuming simple scalar values for token for now.

    // The TBank documentation example for token generation for Init includes sorted scalar values
    // and specifically Password, which is not sent in the request itself.
    // Example: Amount + OrderId + Password + TerminalKey (sorted alphabetically)
    // So we create a temporary object for token generation.

    const tokenGenObj: any = { TerminalKey: this.terminalKey, Password: this.secretKey };
    for (const key in payload) {
        if (Object.prototype.hasOwnProperty.call(payload, key)) {
            // @ts-ignore
            const value = payload[key];
            if (typeof value !== 'object' && typeof value !== 'undefined' && value !== null) {
                // @ts-ignore
                tokenGenObj[key] = value;
            }
        }
    }
    requestPayload.Token = this.generateToken(tokenGenObj);


    debug(`TBank Request to ${TBANK_API_URL_V2}/${endpoint}:`, requestPayload);
    try {
      const response = await axios.post<TResponse>(`${TBANK_API_URL_V2}/${endpoint}`, requestPayload, {
        headers: { 'Content-Type': 'application/json' },
      });
      debug(`TBank Response from ${endpoint}:`, response.data);
      if (!response.data.Success && response.data.ErrorCode !== '0') {
        // ErrorCode '0' means success, but Success might be false with ErrorCode '0' if Message is present (e.g. warnings)
        // For actual errors, ErrorCode will be non-zero.
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
      case TBANK_STATUS_AUTHORIZED: // Деньги захолдированы, ожидаем подтверждения (если 2-стадийная) или списания
      case 'NEW': // Начальный статус платежа
      case 'PREAUTHORIZING': // Идет преавторизация Gesundheitswesen
      case 'AUTHORIZING': // Идет авторизация
      case '3DS_CHECKING': // Клиент перенаправлен на страницу 3DS
      case '3DS_CHECKED': // Проверка 3DS завершена
        return PaymentStatus.PENDING_CONFIRMATION; // Or PENDING_USER_ACTION if 3DS involved and URL given

      case TBANK_STATUS_CONFIRMED: // Платёж подтверждён (списан)
      case TBANK_STATUS_COMPLETED: // (из GetState, считаем успешным)
        return PaymentStatus.SUCCEEDED;

      case TBANK_STATUS_REJECTED:
      case 'DEADLINE_EXPIRED': // Истек срок оплаты
        return PaymentStatus.FAILED;

      case TBANK_STATUS_CANCELED: // Отменен после списания (возврат)
      case TBANK_STATUS_REFUNDED:
      case TBANK_STATUS_PARTIAL_REFUNDED:
        return PaymentStatus.REFUNDED; // Or CANCELED if that's more appropriate

      case TBANK_STATUS_REVERSED: // Отменен до списания (до Confirm)
        return PaymentStatus.CANCELED;
      
      default:
        debug(`Unknown TBank status: ${tbankStatus}`);
        return PaymentStatus.UNKNOWN;
    }
  }


  async initiatePayment(args: PaymentDetailsArgs): Promise<InitiatePaymentResult> {
    debug('TBank: initiatePayment called with:', args);
    const { paymentId, amount, currency, description, userId, objectHid, returnUrl, metadata, payType } = args;

    if (currency !== 'RUB') {
      // TBank Amount is in kopecks (integer). Assuming currency is always RUB from provider perspective.
      // Or we need to convert, but API docs imply RUB.
      // For now, let's assume amount is passed in major units (rubles) and convert here.
      // throw new Error('TBank only supports RUB currency.');
      debug('Warning: TBank currency is usually RUB. Amount is expected in kopecks.');
    }
    const amountInKopecks = Math.round(amount * 100);

    const notificationUrl = `${this.appBaseUrl}/api/payments/tbank/webhook`; // Consistent webhook URL

    const requestPayload: Omit<TBankInitRequest, 'Token' | 'TerminalKey'> = {
      Amount: amountInKopecks,
      OrderId: paymentId,
      Description: description,
      NotificationURL: notificationUrl,
      Language: 'ru',
      // PayType: payType === 'two_stage' ? 'T' : 'O', // Default to 'O' (one-stage) if not specified
      DATA: {
        userId: userId || '',
        objectHid: objectHid || '',
        ...(metadata?.isRecurrent && { Recurrent: 'Y' }), // If we plan to make it recurrent later
      },
      ...(metadata?.customerKey && { CustomerKey: metadata.customerKey }),
      ...(metadata?.isRecurrent && { Recurrent: 'Y' }), // For registering this payment as first recurrent
      ...(returnUrl && { ReturnUrl: returnUrl }), // For redirecting user after payment form
    };
     if (payType) {
        requestPayload.PayType = payType === 'two_stage' ? 'T' : 'O';
    }


    try {
      const response = await this.makeRequest<TBankInitRequest, TBankInitResponse>('Init', requestPayload);

      if (response.Success && response.PaymentURL) {
        return {
          paymentId,
          externalPaymentId: response.PaymentId,
          status: PaymentStatus.PENDING_USER_ACTION, // User needs to go to PaymentURL
          redirectUrl: response.PaymentURL,
          providerResponse: response,
          rebillId: response.RebillId, // If recurrent was requested
          cardId: response.CardId, // If card was bound or used
        };
      } else if (response.Success && response.Status === 'NEW' && response.RebillId && metadata?.isRecurrent) {
         // This case might be for "Init" with "Recurrent=Y" for an existing card (CustomerKey + CardId in DATA?)
         // or if the card is automatically charged via RebillId specified in Init (unlikely for Init).
         // More likely, if Init is used with Recurrent=Y, and an existing card is NOT specified,
         // PaymentURL is provided to bind a new card and make the first payment.
         // If payment is made via RebillId directly, that's a 'Charge' operation, not 'Init'.
         // For now, if PaymentURL is not present, it's an issue unless it's a successful direct charge (unlikely for Init).
         // Let's assume for Init with Recurrent=Y and no PaymentURL implies a direct charge attempt that we need to check
         // This might happen if a card was already linked to the customerKey
        const statusCheck = await this.getPaymentStatus(paymentId, response.PaymentId);
         return {
            paymentId,
            externalPaymentId: response.PaymentId,
            status: statusCheck.status,
            providerResponse: response,
            rebillId: response.RebillId,
        };

      } else {
        return {
          paymentId,
          externalPaymentId: response.PaymentId, // May still be present on failure
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
    debug('TBank: handleWebhook called.');
    let payload: any;
    try {
      // TBank sends webhook as x-www-form-urlencoded, not JSON
      // For Next.js, rawBody might be a Buffer or already parsed by body-parser if middleware is used.
      // Let's assume rawBody is the urlencoded string or an object if pre-parsed.
      if (typeof rawBody === 'string') {
        payload = Object.fromEntries(new URLSearchParams(rawBody));
      } else if (Buffer.isBuffer(rawBody)) {
         payload = Object.fromEntries(new URLSearchParams(rawBody.toString()));
      } else if (typeof rawBody === 'object' && rawBody !== null) {
        payload = rawBody; // Already parsed
      } else {
        throw new Error('Invalid rawBody type for TBank webhook');
      }
      debug('TBank webhook payload:', payload);

      // Verify token if present and matches our calculation
      const receivedToken = payload.Token;
      // Create a copy of payload without 'Token' for generating our own token
      const payloadForTokenCalculation = { ...payload };
      delete payloadForTokenCalculation.Token;
      
      // The Password (secretKey) should be added to this object for token generation
      // @ts-ignore
      payloadForTokenCalculation.Password = this.secretKey;


      const expectedToken = this.generateToken(payloadForTokenCalculation);

      if (receivedToken !== expectedToken) {
        debug('TBank webhook token mismatch. Received:', receivedToken, 'Expected:', expectedToken);
        debug('Payload for token calc:', payloadForTokenCalculation);
        return {
          providerName: this.providerName,
          processed: false,
          error: 'Webhook token mismatch',
          paymentId: payload.OrderId,
          messageToProvider: 'ERROR', // TBank expects "OK" or "ERROR"
        };
      }

      const internalPaymentId = payload.OrderId;
      const externalPaymentId = payload.PaymentId;
      const tbankStatus = payload.Status;
      const amount = payload.Amount ? parseFloat(payload.Amount) / 100 : undefined; // Amount is in kopecks

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
        amount, // Send converted amount if available
        providerStatus: tbankStatus,
        providerResponse: payload,
        messageToProvider: 'OK', // Tell TBank we got it
        rebillId: payload.RebillId, // If it's a recurrent payment notification or first payment with recurrent
        cardId: payload.CardId, // If a card was involved
      };

    } catch (e: any) {
      debug('TBank: Error processing webhook:', e.message, e.stack);
      return {
        providerName: this.providerName,
        processed: false,
        paymentId: payload?.OrderId, // Try to get OrderId even on error
        error: e.message || 'Failed to process TBank webhook.',
        messageToProvider: 'ERROR',
      };
    }
  }

  async getPaymentStatus(internalPaymentId: string, externalPaymentId?: string): Promise<PaymentStatusResult> {
    debug(`TBank: getPaymentStatus called for internalId: ${internalPaymentId}, externalId: ${externalPaymentId}`);
    if (!externalPaymentId) {
      // In TBank, PaymentId (external) is crucial for GetState. OrderId (internal) might not be enough.
      // If only internalPaymentId is available, we might need to look it up in our DB first.
      // For now, we assume externalPaymentId is usually known or passed.
      return {
        internalPaymentId,
        status: PaymentStatus.UNKNOWN,
        errorMessage: 'External Payment ID (PaymentId) is required for TBank GetState.',
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
          internalPaymentId: response.OrderId || internalPaymentId,
          externalPaymentId: response.PaymentId,
          status: currentStatus,
          providerStatus: response.Status,
          amount: response.Amount ? response.Amount / 100 : undefined,
          providerResponse: response,
        };
      } else {
        return {
          internalPaymentId,
          externalPaymentId,
          status: PaymentStatus.UNKNOWN, // Or map ErrorCode to a status if possible
          providerStatus: response.Status, // May contain an error status
          errorMessage: response.Message || `TBank GetState failed with ErrorCode: ${response.ErrorCode}`,
          providerResponse: response,
        };
      }
    } catch (error: any) {
      return {
        internalPaymentId,
        externalPaymentId,
        status: PaymentStatus.ERROR,
        errorMessage: error.message,
        providerResponse: error,
      };
    }
  }
  
  // Placeholder for Confirm (for two-stage payments)
  async confirmPayment(externalPaymentId: string, amount?: number): Promise<TBankCommonResponse> {
    debug(`TBank: confirmPayment called for externalId: ${externalPaymentId}, amount: ${amount}`);
    const requestPayload: Omit<TBankConfirmRequest, 'Token' | 'TerminalKey'> = {
      PaymentId: externalPaymentId,
    };
    if (amount) {
      requestPayload.Amount = Math.round(amount * 100);
    }
    // TODO: Add Receipt if needed for confirmation with fiscalization
    return this.makeRequest<TBankConfirmRequest, TBankCommonResponse>('Confirm', requestPayload);
  }

  // Placeholder for Cancel (can be reversal or refund)
  async cancelPayment(externalPaymentId: string, amount?: number): Promise<TBankCommonResponse> {
    debug(`TBank: cancelPayment called for externalId: ${externalPaymentId}, amount: ${amount}`);
    const requestPayload: Omit<TBankCancelRequest, 'Token' | 'TerminalKey'> = {
      PaymentId: externalPaymentId,
    };
    if (amount) {
      requestPayload.Amount = Math.round(amount * 100);
    }
    // TODO: Add Receipt if needed for refund with fiscalization
    return this.makeRequest<TBankCancelRequest, TBankCommonResponse>('Cancel', requestPayload);
  }


  async createSubscription(args: SubscriptionDetailsArgs): Promise<CreateSubscriptionResult> {
    debug('TBank: createSubscription (initiating first recurrent payment) called with:', args);
    // For TBank, creating a "subscription" means making the first payment with Recurrent='Y'
    // and getting a RebillId. Or, if a card is already linked to CustomerKey,
    // using Init with Recurrent='Y' and the CustomerKey might directly create the RebillId
    // without a new payment page, if the linked card is used.

    const { planId, userId, paymentMethodId, objectHid, initialAmount, currency, description, customerKey, returnUrl } = args;

    if (!customerKey) {
        return {
            errorMessage: 'customerKey is required for TBank subscriptions.',
            status: 'failed',
        };
    }

    // The first payment will register the recurrent profile (RebillId)
    const initResult = await this.initiatePayment({
      paymentId: `sub_init_${userId}_${Date.now()}`, // Unique OrderId for the initial payment
      amount: initialAmount, // Amount for the first payment
      currency,
      description: description || `Initial payment for plan ${planId}`,
      userId,
      objectHid,
      returnUrl: returnUrl || `${this.appBaseUrl}/subscriptions/tbank/callback`, // Callback for this initial payment
      metadata: {
        isRecurrent: true, // This signals Init to set Recurrent='Y'
        customerKey: customerKey, // Important for linking future payments
        // If paymentMethodId corresponds to an existing TBank CardId, it should be passed in DATA
        ...(paymentMethodId && { tbankCardId: paymentMethodId } ) // Assuming paymentMethodId IS the TBank CardId
      },
      payType: 'O', // Usually initial recurrent payment is one-stage
    });

    if (initResult.status === PaymentStatus.PENDING_USER_ACTION || initResult.status === PaymentStatus.SUCCEEDED) {
      // If SUCCEEDED directly, it means a previously linked card was charged.
      // If PENDING_USER_ACTION, user needs to complete payment on TBank page.
      // The RebillId should be in initResult.providerResponse.RebillId or initResult.rebillId
      const rebillId = initResult.rebillId || (initResult.providerResponse as TBankInitResponse)?.RebillId;

      if (rebillId) {
        return {
          externalSubscriptionId: rebillId, // This is the RebillId
          status: initResult.redirectUrl ? 'pending_initial_payment' : 'active', // 'active' if no redirect and succeeded
          paymentRequired: !!initResult.redirectUrl, // If redirect, payment is still pending
          initialPaymentResult: initResult,
          customerKey: customerKey,
        };
      } else {
        return {
          status: 'failed',
          errorMessage: 'Failed to obtain RebillId from TBank after initial payment.',
          initialPaymentResult: initResult,
        };
      }
    } else {
      return {
        status: 'failed',
        errorMessage: initResult.errorMessage || 'Failed to initiate first recurrent payment with TBank.',
        initialPaymentResult: initResult,
      };
    }
  }
  
  // Charge a recurrent payment using RebillId (this is not part of IPaymentProcessor directly)
  async chargeRecurrent(args: {
    rebillId: string,
    orderId: string, // Our internal new payment ID for this charge
    amount: number,
    description?: string,
    customerKey?: string // Optional, if associated with a customer
  }): Promise<TBankInitResponse> { // Uses TBankInitResponse as it's similar to Init output (PaymentId, Status, etc.)
    debug('TBank: chargeRecurrent called with:', args);
    const amountInKopecks = Math.round(args.amount * 100);
    const notificationUrl = `${this.appBaseUrl}/api/payments/tbank/webhook`;

    const requestPayload: Omit<TBankChargeRequest, 'Token' | 'TerminalKey'> = {
        RebillId: args.rebillId,
        Amount: amountInKopecks,
        OrderId: args.orderId,
        NotificationURL: notificationUrl,
        Description: args.description,
        ...(args.customerKey && { CustomerKey: args.customerKey }),
    };
    // Note: Charge uses a slightly different token calculation base than Init if Receipt is involved.
    // For now, assuming simple scalar values.
    return this.makeRequest<TBankChargeRequest, TBankInitResponse>('Charge', requestPayload);
  }


  async cancelSubscription(args: CancelSubscriptionArgs): Promise<CancelSubscriptionResult> {
    debug('TBank: cancelSubscription called with:', args);
    // TBank doesn't have a direct "cancel subscription (RebillId)" API.
    // Cancellation means not making future 'Charge' calls with the RebillId.
    // We might want to "deactivate" the associated card or RebillId if an API exists,
    // but typically it's managed by the merchant's system.
    // The RebillId is usually linked to a specific card (CardId).
    // If we want to prevent future charges, we might remove the card if it's only for this sub.
    
    // For now, this will be a soft cancellation in our system.
    // If an actual "deactivate rebill" API is found, implement it here.
    // The documentation does not explicitly state an API to deactivate a RebillId.
    // It seems RebillIds are active as long as the card is active.
    // One could call `RemoveCard` if the CardId associated with the RebillId is known.

    return {
      subscriptionId: args.internalSubscriptionId, // This is our internal ID
      externalSubscriptionId: args.externalSubscriptionId, // This is the RebillId
      newStatus: 'canceled', // Soft cancel
      message: 'Subscription marked as canceled in our system. TBank RebillId remains active until card expires or is removed.',
      canceledAt: new Date().toISOString(),
    };
  }

  async addPaymentMethod(args: AddPaymentMethodArgs): Promise<AddPaymentMethodResult> {
    debug('TBank: addPaymentMethod called with:', args);
    const { userId, customerKey, returnUrl, type } = args; // type is 'card'

    if (!customerKey) {
      return { status: PaymentMethodStatus.FAILED, errorMessage: 'customerKey is required to add a payment method with TBank.' };
    }

    const notificationUrl = `${this.appBaseUrl}/api/payments/tbank/card-webhook`; // Dedicated webhook for card operations

    const requestPayload: Omit<TBankAddCardInitRequest, 'Token' | 'TerminalKey'> = {
      CustomerKey: customerKey,
      CheckType: '3DS', // Recommended for security. 'HOLD' is also an option. 'NO' is not safe.
      NotificationURL: notificationUrl,
      ReturnUrl: returnUrl || `${this.appBaseUrl}/payment-methods/tbank/callback?customerKey=${customerKey}`,
      DATA: { userId: userId || '' }
    };

    try {
      const response = await this.makeRequest<TBankAddCardInitRequest, TBankAddCardInitResponse>('AddCard', requestPayload);

      if (response.Success && response.PaymentURL && response.RequestKey) {
        // User needs to be redirected to PaymentURL to complete card addition (e.g., 3DS)
        return {
          status: PaymentMethodStatus.PENDING_USER_ACTION,
          redirectUrl: response.PaymentURL,
          providerData: { requestKey: response.RequestKey, customerKey }, // Store RequestKey for webhook/callback
        };
      } else if (response.Success && !response.PaymentURL && response.RequestKey) {
         // This might happen if CheckType=NO (not used here) or if some other flow occurs.
         // For CheckType=3DS or HOLD, PaymentURL is expected.
         // If AddCard directly returns success without PaymentURL, it implies the card was added without user action,
         // which is unusual for a new card unless it's an import or special scenario.
         // The webhook or GetCardList should confirm.
         // For now, assume PENDING_CONFIRMATION by webhook.
        return {
            status: PaymentMethodStatus.PENDING_CONFIRMATION, // Awaiting webhook
            providerData: { requestKey: response.RequestKey, customerKey },
            message: "Card addition initiated, awaiting confirmation."
        }
      }
      else {
        return {
          status: PaymentMethodStatus.FAILED,
          errorMessage: response.Message || `TBank AddCard failed with ErrorCode: ${response.ErrorCode}`,
          providerResponse: response,
        };
      }
    } catch (error: any) {
      return {
        status: PaymentMethodStatus.ERROR,
        errorMessage: error.message,
        providerResponse: error,
      };
    }
  }

  // This would be called by the callback/webhook for AddCard
  // TBank's AddCard webhook is not explicitly detailed like payment webhooks.
  // It might send a standard notification with a specific status or require GetCardList.
  // Assuming a webhook similar to payment for now, or relying on polling GetCardList.
  // The `FinishAuthorize` endpoint (not directly part of IPaymentProcessor) is used after 3DS
  // if not using Payment Chislo. The PaymentURL from AddCard should handle the 3DS flow.
  // After the user returns via ReturnUrl, we should call GetCardList or check a webhook.

  // Helper to get card list for a customer
  async getCardList(customerKey: string): Promise<TBankGetCardListResponse | null> {
    debug('TBank: getCardList called for customerKey:', customerKey);
    const requestPayload: Omit<TBankGetCardListRequest, 'Token' | 'TerminalKey'> = {
        CustomerKey: customerKey,
    };
    try {
        // The response is directly an array or an object with ErrorCode if failed.
        // Adjusting makeRequest or handling response type here.
        // For simplicity, assuming makeRequest can handle non-standard success responses.
        const response = await this.makeRequest<TBankGetCardListRequest, TBankCommonResponse & TBankGetCardListResponse>('GetCardList', requestPayload);
        if (response.Success === false && response.ErrorCode !== '0') { // Explicit check for failure
             debug(`TBank GetCardList failed: ${response.Message}`);
             return null; // Or throw error
        }
        // If Success is true, or ErrorCode is '0' but Success might be missing (docs unclear for array response)
        // the actual card list is the response itself if it's an array.
        if (Array.isArray(response)) {
            return response as TBankGetCardListResponse;
        }
        // If it's an object with Success:true, it implies an empty list or an error that wasn't a typical API error.
        // For now, if it's not an array and Success is true, assume empty list or handle based on actual API behavior.
        // The provided OpenAPI spec for GetCardList shows it returns an array directly for success.
        // Or an error object if it fails.
        // The wrapper TBankCommonResponse might not apply directly here.

        // Re-evaluating: If the response is an array, it's the list. If it's an object with ErrorCode, it's an error.
        // The makeRequest will throw on network/HTTP errors. Here we handle API-level errors.
        // Let's assume the response from makeRequest is always TBankCommonResponse structure,
        // and the actual card list is embedded if successful. This needs verification against actual API.
        // The OpenAPI spec at the provided URL shows GetCardList directly returns an array of CardInfo.
        // This means our makeRequest might need adjustment or a different wrapper for such endpoints.

        // Let's assume for now that if response.Success is true and it's an array, it's the list.
        // Or if it's an object and success, it might be an empty list or a success wrapper.
        // This part is tricky without live testing the GetCardList endpoint.
        // For now, if it's an array, cast it.
        if (Array.isArray(response)) return response as TBankGetCardListResponse;
        if (response.Success && response.ErrorCode === '0') return []; // Empty list

        return null;


    } catch (error: any) {
        debug('Error in getCardList:', error.message);
        return null;
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
