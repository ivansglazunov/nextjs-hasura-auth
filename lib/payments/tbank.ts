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
import { TBankProcessorOptions, defaultTBankOptions, GenerateReceiptArgs, ReceiptOperationType } from './tbank/options';

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

// Exporting types needed by options.ts
export type { TBankReceipt, TBankReceiptItem };

export class TBankPaymentProcessor implements IPaymentProcessor {
  readonly providerName = 'tbank';
  private terminalKey: string;
  private secretKey: string;
  private useTestMode: boolean; // To potentially use different keys or slightly different logic if needed
  private appBaseUrl: string;
  private options: TBankProcessorOptions;

  constructor(config: {
    terminalKey: string;
    secretKey: string;
    useTestMode?: boolean;
    appBaseUrl?: string;
    options?: TBankProcessorOptions;
  }) {
    this.terminalKey = config.terminalKey;
    this.secretKey = config.secretKey;
    this.useTestMode = config.useTestMode || false;
    this.appBaseUrl = config.appBaseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    this.options = { ...defaultTBankOptions, ...config.options };

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
    const { paymentId, amount, currency, description, userId, objectHid, returnUrl, metadata } = args;

    if (currency !== 'RUB') {
      // TBank Amount is in kopecks (integer). Assuming currency is always RUB from provider perspective.
      // Or we need to convert, but API docs imply RUB.
      // For now, let's assume amount is passed in major units (rubles) and convert here.
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
      DATA: {
        userId: userId || '',
        objectHid: objectHid || '',
        ...(metadata?.isRecurrent && { Recurrent: 'Y' }), // If we plan to make it recurrent later
      },
      ...(metadata?.customerKey && { CustomerKey: metadata.customerKey }),
      ...(metadata?.isRecurrent && { Recurrent: 'Y' }), // For registering this payment as first recurrent
      ...(returnUrl && { ReturnUrl: returnUrl }), // For redirecting user after payment form
    };
    // Expect payType from metadata if provided e.g. metadata.tbankPayType = 'T' or 'O'
    if (metadata?.tbankPayType === 'T' || metadata?.tbankPayType === 'O') {
        requestPayload.PayType = metadata.tbankPayType;
    } else {
        requestPayload.PayType = 'O'; // Default to one-stage
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
        };
      } else if (response.Success && response.Status === 'NEW' && response.RebillId && metadata?.isRecurrent) {
        const statusCheck = await this.getPaymentStatus(paymentId, response.PaymentId);
         return {
            paymentId,
            externalPaymentId: response.PaymentId,
            status: statusCheck.status,
            providerResponse: response,
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
        providerResponse: payload,
        messageToProvider: 'OK',
        ...(payload.RebillId && { subscriptionId: payload.OrderId }),
        ...(payload.RebillId && tbankStatus === TBANK_STATUS_CONFIRMED && { newSubscriptionStatus: 'active' }),
        ...(payload.RebillId && (tbankStatus === TBANK_STATUS_REJECTED) && { newSubscriptionStatus: 'past_due' })
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
      return {
        internalPaymentId,
        status: PaymentStatus.UNKNOWN,
        error: 'External Payment ID (PaymentId) is required for TBank GetState.',
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
          status: currentStatus,
          providerStatus: response.Status,
          paidAt: currentStatus === PaymentStatus.SUCCEEDED ? new Date().toISOString() : undefined,
          providerResponse: response,
        };
      } else {
        return {
          internalPaymentId,
          status: PaymentStatus.UNKNOWN, // Or map ErrorCode to a status if possible
          providerStatus: response.Status, // May contain an error status
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
      requestPayload.Amount = Math.round(amount * 100); // Amount in kopecks
    }

    if (this.options.generateReceipt && receiptArgs) {
      const receipt = this.options.generateReceipt(receiptArgs, 'confirmation');
      if (receipt) {
        requestPayload.Receipt = receipt;
      }
    }
    // TODO: Ensure receiptArgs are correctly passed or constructed if fiscalization is needed here.
    // If amount for confirmation differs from initial, receipt might be mandatory.

    return this.makeRequest<TBankConfirmRequest, TBankCommonResponse>('Confirm', requestPayload);
  }

  async cancelPayment(externalPaymentId: string, amount?: number, receiptArgs?: GenerateReceiptArgs): Promise<TBankCommonResponse> {
    debug(`TBank: cancelPayment called for externalId: ${externalPaymentId}, amount: ${amount}`);
    const requestPayload: Omit<TBankCancelRequest, 'Token' | 'TerminalKey'> = {
      PaymentId: externalPaymentId,
    };
    if (typeof amount === 'number') {
      requestPayload.Amount = Math.round(amount * 100); // Amount in kopecks, for partial refund/cancel
    }

    // For refunds (Cancel after CONFIRMED), a receipt is often required by fiscal law.
    // For reversals (Cancel before CONFIRMED), a receipt might not be needed or allowed by TBank.
    // This logic assumes receiptArgs are provided when a fiscalized refund is intended.
    if (this.options.generateReceipt && receiptArgs) {
      const receipt = this.options.generateReceipt(receiptArgs, 'refund');
      if (receipt) {
        requestPayload.Receipt = receipt;
      }
    }
    // TODO: Determine if receipt is for reversal or refund based on payment status before calling this.
    // TBank documentation for Cancel: "Для возврата используется тот же метод Cancel, что и для отмены.
    // Отличие только в том, что для возврата необходимо передавать объект Receipt." 

    return this.makeRequest<TBankCancelRequest, TBankCommonResponse>('Cancel', requestPayload);
  }


  async createSubscription(args: SubscriptionDetailsArgs): Promise<CreateSubscriptionResult> {
    debug('TBank: createSubscription (initiating first recurrent payment) called with:', args);

    const { planId, userId, paymentMethodId, objectHid, metadata /*, trialDays, couponCode */ } = args;

    // Essential TBank params must now come from metadata
    const customerKey = metadata?.tbankCustomerKey as string | undefined;
    const initialAmount = metadata?.tbankInitialAmount as number | undefined;
    const currency = metadata?.tbankCurrency as string | undefined || 'RUB'; // Default to RUB
    const description = metadata?.tbankDescription as string | undefined;
    const returnUrl = metadata?.tbankReturnUrl as string | undefined;

    if (!customerKey) {
        // Correctly throw an error as the return type must be CreateSubscriptionResult
        throw new Error('tbankCustomerKey is required in metadata for TBank subscriptions.');
    }
    if (typeof initialAmount !== 'number') {
        throw new Error('tbankInitialAmount (number) is required in metadata for TBank subscriptions.');
    }

    // Unique OrderId for the initial payment, using a combination that should be unique.
    const initialPaymentId = `sub_init_${userId}_${planId}_${Date.now()}`;

    // The first payment will register the recurrent profile (RebillId)
    const initArgs: PaymentDetailsArgs = {
      paymentId: initialPaymentId,
      amount: initialAmount,
      currency,
      description: description || `Initial payment for plan ${planId}`,
      userId,
      objectHid,
      returnUrl: returnUrl || `${this.appBaseUrl}/subscriptions/tbank/callback`, // Callback for this initial payment
      metadata: {
        isRecurrent: true, // This signals Init to set Recurrent='Y'
        customerKey: customerKey, // Important for linking future payments
        ...(paymentMethodId && { tbankCardId: paymentMethodId }), // Assuming paymentMethodId IS the TBank CardId
        tbankPayType: 'O', // Usually initial recurrent payment is one-stage, ensure it is passed to initiatePayment
      },
      // paymentMethodId and customerId are also available in PaymentDetailsArgs if needed
      ...(paymentMethodId && { paymentMethodId }),
      customerId: customerKey, // TBank's CustomerKey can be considered the customerId here
    };

    const initResult = await this.initiatePayment(initArgs);

    if (initResult.status === PaymentStatus.PENDING_USER_ACTION || initResult.status === PaymentStatus.SUCCEEDED) {
      const tbankInitResponse = initResult.providerResponse as TBankInitResponse | undefined;
      const rebillId = tbankInitResponse?.RebillId;

      if (rebillId) {
        return {
          subscriptionId: initialPaymentId, // Using the initial payment ID as a temporary subscription ID placeholder
                                         // Or generate a new UUID here if this needs to be distinct before DB insertion.
                                         // This should ideally be the ID from *our* subscriptions table after creation.
          externalSubscriptionId: rebillId, // This is the RebillId
          status: initResult.redirectUrl ? 'pending_initial_payment' : 'active', // 'active' if no redirect and succeeded
          paymentRequired: !!initResult.redirectUrl,
          initialPaymentResult: initResult,
          // customerKey: customerKey, // Removed: Not in CreateSubscriptionResult base type
        };
      } else {
         throw new Error('Failed to obtain RebillId from TBank after initial payment. Provider response: ' + JSON.stringify(initResult.providerResponse));
      }
    } else {
      throw new Error(initResult.errorMessage || 'Failed to initiate first recurrent payment with TBank. Status: ' + initResult.status);
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
    
    // The externalSubscriptionId (RebillId) would typically be retrieved from your DB
    // using args.internalSubscriptionId if you needed to interact with TBank for cancellation.
    // Since TBank has no such direct API, this is a soft cancellation.

    return {
      subscriptionId: args.internalSubscriptionId, // This is our internal ID
      newStatus: 'canceled', // Soft cancel
      canceledAt: new Date().toISOString(),
      // errorMessage can be added if there was a failure updating internal state and it is part of CancelSubscriptionResult.
      // Checking base.ts, errorMessage IS part of CancelSubscriptionResult.
    };
  }

  async addPaymentMethod(args: AddPaymentMethodArgs): Promise<AddPaymentMethodResult> {
    debug('TBank: addPaymentMethod called with:', args);
    const { userId, providerName, type, details, setAsDefault } = args; // Standard args

    // TBank specific parameters must come from args.details
    const customerKey = details?.tbankCustomerKey as string | undefined;
    const returnUrlFromDetails = details?.tbankReturnUrl as string | undefined;
    const checkType = (details?.tbankCheckType as 'NO' | 'HOLD' | '3DS') || '3DS'; // Default to 3DS

    if (type !== 'card') {
      throw new Error('TBank provider currently only supports adding card payment methods.');
    }
    if (!customerKey) {
      throw new Error('tbankCustomerKey is required in details to add a payment method with TBank.');
    }

    const notificationUrl = `${this.appBaseUrl}/api/payments/tbank/card-webhook`; // Dedicated webhook
    const finalReturnUrl = returnUrlFromDetails || `${this.appBaseUrl}/payment-methods/tbank/callback?customerKey=${customerKey}`;

    const requestPayload: Omit<TBankAddCardInitRequest, 'Token' | 'TerminalKey'> = {
      CustomerKey: customerKey,
      CheckType: checkType,
      NotificationURL: notificationUrl,
      ReturnUrl: finalReturnUrl,
      DATA: { userId: userId || '' }
    };

    try {
      const response = await this.makeRequest<TBankAddCardInitRequest, TBankAddCardInitResponse & TBankCommonResponse>('AddCard', requestPayload);

      if (response.Success && response.PaymentURL && response.RequestKey) {
        debug(`TBank AddCard: User redirection needed to: ${response.PaymentURL}. RequestKey: ${response.RequestKey}`);
        return {
          paymentMethodId: '', 
          externalId: undefined, 
          status: PaymentMethodStatus.PENDING_USER_ACTION,
          isRecurrentReady: false, 
          detailsForUser: { message: 'Redirect to TBank page required.', requestKey: response.RequestKey },
          redirectUrl: response.PaymentURL, // Populate redirectUrl
        };
      } else if (response.Success && !response.PaymentURL && response.RequestKey) {
        debug(`TBank AddCard: Initiated, awaiting confirmation. RequestKey: ${response.RequestKey}`);
        return {
            paymentMethodId: '', 
            externalId: undefined,
            status: PaymentMethodStatus.PENDING_CONFIRMATION, 
            isRecurrentReady: false,
            detailsForUser: { message: 'Card addition initiated, awaiting confirmation.', requestKey: response.RequestKey },
            // redirectUrl is not available in this case
        };
      }
      else {
        const errorMessage = response.Message || response.Details || `TBank AddCard failed with ErrorCode: ${response.ErrorCode}`;
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      debug('TBank AddCard Error:', error);
      throw new Error(`TBank AddCard request failed: ${error.message}`);
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
    // Prepare payload for token generation (needs Password)
    // Note: generateToken expects scalar values. CustomerKey and TerminalKey are scalars.
    const payloadForToken: any = { CustomerKey: customerKey, Password: this.secretKey, TerminalKey: this.terminalKey };
    // Important: The generateToken function sorts keys. Ensure all keys for token are present.
    // Based on general TBank token logic: all request params + Password, sorted.
    // For GetCardList, the request params are TerminalKey, CustomerKey, Token.
    // So, for token generation, we need TerminalKey, CustomerKey, Password.
    
    const token = this.generateToken(payloadForToken);

    const requestPayload = {
        TerminalKey: this.terminalKey,
        CustomerKey: customerKey,
        Token: token,
    };

    try {
      // Using axios.post directly as GetCardList returns an array on success,
      // which is not handled well by the generic makeRequest expecting a TBankCommonResponse object structure.
      const response = await axios.post<TBankGetCardListResponse | TBankCommonResponse>(
        `${TBANK_API_URL_V2}/GetCardList`,
        requestPayload,
        { headers: { 'Content-Type': 'application/json' } }
      );
      debug('TBank Response from GetCardList:', response.data);

      if (Array.isArray(response.data)) {
        // Successfully received an array of cards
        return response.data as TBankGetCardListResponse;
      } else if (response.data && typeof response.data === 'object') {
        // Received an object, should be TBankCommonResponse (likely an error or specific non-array success)
        const objectResponse = response.data as TBankCommonResponse;
        if (objectResponse.Success === false && objectResponse.ErrorCode !== '0') {
          debug(`TBank GetCardList API Error: ${objectResponse.Message || objectResponse.Details}`);
          return null;
        }
        // If Success is true (or ErrorCode is '0') but it's not an array:
        // This implies an empty list might be represented as a success object,
        // or it's an unexpected format if the API strictly returns an array for success.
        // Assuming if not an array, but Success=true, it implies an empty list scenario.
        if (objectResponse.Success === true || (objectResponse.Success !== false && objectResponse.ErrorCode === '0')) {
            debug('TBank GetCardList: Success response was an object, not an array. Assuming empty list.');
            return [];
        }
        debug('TBank GetCardList: Unexpected object response structure.');
        return null;
      } else {
        debug('TBank GetCardList: Unexpected response type.');
        return null;
      }
    } catch (error: any) {
      const errorResponse = error.response?.data as TBankCommonResponse;
      const errorMessage = errorResponse?.Message || errorResponse?.Details || error.message;
      debug(`TBank GetCardList request failed: ${errorMessage}`, error.response?.data || error);
      // Propagate error or return null based on desired error handling strategy
      // For now, returning null as per original logic for some failures.
      // Consider throwing a more specific error if needed.
      // throw new Error(`TBank GetCardList request failed: ${errorMessage}`);
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
