import { v4 as uuidv4 } from 'uuid';
import {
  IPaymentProcessor,
  PaymentDetailsArgs,
  InitiatePaymentResult,
  WebhookPayload, // Не используется напрямую в dummy, но может быть для справки
  WebhookHandlingResult,
  PaymentStatusResult,
  SubscriptionDetailsArgs,
  CreateSubscriptionResult,
  CancelSubscriptionArgs,
  CancelSubscriptionResult,
  AddPaymentMethodArgs,
  AddPaymentMethodResult
} from './base';
import Debug from '../debug';

const debug = Debug('payments:dummy');

// Статусы, которые мы можем ожидать в параметрах URL вебхука от initiatePayment
const DUMMY_URL_STATUS_SUCCESS = 'succeeded'; // Успешная операция (четная сумма)
const DUMMY_URL_STATUS_FAILURE = 'failed';   // Неуспешная операция (нечетная сумма)

// Внутренний интерфейс для деталей, извлеченных из вебхука
interface DecodedWebhookDetails {
  paymentId: string;
  externalPaymentId: string | null;
  amount: number;
  currency: string | null;
  webhookStatus: string; // Статус из URL вебхука
  description?: string;
  userId?: string;
  objectHid?: string;
  isErrorCondition: boolean; // Определяет, должен ли платеж считаться ошибочным
  errorMessage?: string;
}

export class DummyPaymentProcessor implements IPaymentProcessor {
  providerName = 'dummy';
  private baseUrl: string;

  constructor(config: { baseUrl: string }) {
    this.baseUrl = config.baseUrl;
    debug('DummyPaymentProcessor initialized with config:', config);
  }

  async initiatePayment(args: PaymentDetailsArgs): Promise<InitiatePaymentResult> {
    debug('Dummy: initiatePayment called with:', args);

    if (args.amount <= 0) {
      debug('Dummy: Amount must be positive. Amount received:', args.amount);
      throw new Error('Amount must be positive.');
    }

    const isEvenAmount = args.amount % 2 === 0;
    const simulatedOutcomeStatus = isEvenAmount ? DUMMY_URL_STATUS_SUCCESS : DUMMY_URL_STATUS_FAILURE;
    
    // Внутренний ID платежа провайдера - может быть тем же, что и наш, или с префиксом
    const providerSidePaymentId = args.paymentId; // Используем наш paymentId как основу

    debug(`Dummy: Amount ${args.amount} is ${isEvenAmount ? 'even' : 'odd'}. Simulating ${simulatedOutcomeStatus} outcome.`);

    const webhookUrl = new URL(`${this.baseUrl}/api/payments/dummy/webhook`);
    webhookUrl.searchParams.set('paymentId', args.paymentId);
    webhookUrl.searchParams.set('externalPaymentId', providerSidePaymentId); // Добавляем его в URL для вебхука
    webhookUrl.searchParams.set('status', simulatedOutcomeStatus);
    webhookUrl.searchParams.set('amount', args.amount.toString());
    webhookUrl.searchParams.set('currency', args.currency);
    if (args.description) webhookUrl.searchParams.set('description', args.description);
    if (args.userId) webhookUrl.searchParams.set('userId', args.userId);
    if (args.objectHid) webhookUrl.searchParams.set('objectHid', args.objectHid);
    
    return {
      paymentId: args.paymentId,
      externalPaymentId: providerSidePaymentId,
      status: 'pending_user_action', // Наш внутренний статус платежа до перехода по URL
      redirectUrl: webhookUrl.toString(),
      providerResponse: {
        message: 'Payment initiated with dummy provider.',
        willSucceed: isEvenAmount,
      },
    };
  }

  private getPaymentDetailsFromWebhook(request: Request): DecodedWebhookDetails {
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    const paymentId = queryParams.paymentId;
    const externalPaymentId = queryParams.externalPaymentId || null;
    const queryAmount = queryParams.amount;
    const webhookStatus = queryParams.status; // Статус из URL, поставленный initiatePayment
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

    // Логика определения успешности/ошибки теперь только на основе статуса из URL
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
      userId,
      objectHid,
      isErrorCondition,
      errorMessage,
    };
    debug('Dummy: Parsed webhook details:', details);
    return details;
  }

  async handleWebhook(request: Request, rawBody: string | Buffer): Promise<WebhookHandlingResult> {
    debug('Dummy: handleWebhook called');
    try {
      const details = this.getPaymentDetailsFromWebhook(request);

      if (details.isErrorCondition) {
        debug(`Dummy: Webhook indicates payment ${details.paymentId} failed. Reason: ${details.errorMessage}`);
        return {
          processed: true,
          paymentId: details.paymentId,
          newPaymentStatus: 'failed',
          error: details.errorMessage,
          messageToProvider: 'OK',
        };
      } else {
        debug(`Dummy: Webhook indicates payment ${details.paymentId} succeeded.`);
        return {
          processed: true,
          paymentId: details.paymentId,
          newPaymentStatus: 'succeeded',
          messageToProvider: 'OK',
        };
      }
    } catch (e: any) {
      debug('Dummy: Error processing webhook:', e.message);
      // Если ошибка возникла при парсинге (например, нет paymentId), paymentId может быть undefined
      // Попытаемся извлечь paymentId из URL, если это возможно, для логгирования
      let paymentIdFromUrlOnError: string | undefined;
      try {
        const url = new URL(request.url);
        paymentIdFromUrlOnError = url.searchParams.get('paymentId') || undefined;
      } catch (_) {
        // Игнорируем ошибку парсинга URL, если сам URL некорректен
      }
      return {
        processed: false,
        paymentId: paymentIdFromUrlOnError, // Может быть undefined
        newPaymentStatus: 'error',
        error: e.message || 'Failed to process webhook due to invalid data.',
        messageToProvider: 'ERROR', // Сообщаем провайдеру (в данном случае, нашему же редиректу) об ошибке
      };
    }
  }

  async getPaymentStatus(internalPaymentId: string, externalPaymentId?: string): Promise<PaymentStatusResult> {
    debug('Dummy: getPaymentStatus called for internalId:', internalPaymentId, ', externalId:', externalPaymentId);
    // Dummy provider не хранит состояние, статус определяется вебхуком.
    // Этот метод здесь для соответствия интерфейсу.
    return {
      internalPaymentId,
      status: 'unknown', // Не можем знать статус без вебхука
      providerStatus: 'dummy_unknown',
      providerResponse: {
        message: 'Dummy status check; actual status determined by webhook or initial amount.',
      },
    };
  }

  // Методы для подписок и добавления методов оплаты пока не реализуем подробно для dummy
  async createSubscription(args: SubscriptionDetailsArgs): Promise<CreateSubscriptionResult> {
    debug('Dummy: createSubscription called with:', args);
    // Имитируем создание подписки
    const externalSubscriptionId = `dummy_sub_${uuidv4()}`;
    const needsPayment = args.planId !== 'free_plan'; // Предположим, есть такой план

    if (needsPayment) {
      // Если нужен платеж, инициируем его
      const paymentResult = await this.initiatePayment({
        amount: 10, // Пример суммы
        currency: 'USD',
        objectHid: args.objectHid,
        userId: args.userId,
        paymentId: `dummy_init_pay_${uuidv4()}`,
        description: `Initial payment for subscription to ${args.planId}`,
        returnUrl: `/subscriptions/success?sub_id=${externalSubscriptionId}` // Пример URL
      });
      return {
        subscriptionId: `dummy_local_sub_${uuidv4()}`,
        externalSubscriptionId,
        status: paymentResult.status === 'succeeded' ? 'active' : 'pending_payment',
        paymentRequired: true,
        initialPaymentResult: paymentResult,
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
    const externalId = `dummy_pm_${uuidv4()}`;
    return {
      paymentMethodId: `dummy_local_pm_${uuidv4()}`,
      externalId,
      status: 'active',
      detailsForUser: { info: 'Dummy payment method', type: args.type },
      isRecurrentReady: true, // Для dummy всегда готов
    };
  }
} 