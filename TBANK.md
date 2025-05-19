# Документация по адаптеру TBankPaymentProcessor (lib/payments/tbank.ts)

Этот документ описывает методы, реализованные в `TBankPaymentProcessor`, их назначение, сигнатуры аргументов и возвращаемых значений, а также структуры данных, используемые при взаимодействии с API TBank.

> **Важно:** Актуальная информация о базовом API Tinkoff доступна в файле [TINKOFF_API.md](./TINKOFF_API.md).
> Актуальный URL API для интеграции: `https://securepay.tinkoff.ru/v2`

## Хранение конфигурации

Начиная с версии 1.0.0, конфигурация TBank хранится в базе данных в таблице `payments_providers` со структурой:

```
{
  "id": "uuid",
  "name": "text",
  "type": "tbank",
  "config": {
    "terminal_key": "ваш_ключ_терминала",
    "secret_key": "ваш_секретный_ключ",
    "is_test_mode": boolean
  },
  "is_test_mode": boolean,
  "default_return_url": "url_для_возврата_после_платежа",
  "default_webhook_url": "url_для_уведомлений_об_операциях",
  "default_card_webhook_url": "url_для_уведомлений_о_картах",
  "is_active": boolean
}
```

Это позволяет:
- Хранить множество терминалов разных юридических лиц
- Разделять тестовые и продуктовые терминалы
- Динамически управлять конфигурацией каждого терминала

## Реализованные методы адаптера

### 1. `initiatePayment`
   - **Назначение:** Инициирует платеж (разовый или первый рекуррентный). Может потребовать от пользователя перехода по URL для завершения оплаты.
   - **Сигнатура:**
     ```typescript
     async initiatePayment(args: PaymentDetailsArgs): Promise<InitiatePaymentResult>
     ```
   - **`PaymentDetailsArgs` (входные, из `base.ts`):**
     - `amount: number`
     - `currency: string`
     - `description?: string`
     - `objectHid: string`
     - `userId: string`
     - `paymentId: string` (внутренний ID платежа)
     - `paymentMethodId?: string`
     - `customerId?: string` (для TBank это `CustomerKey`)
     - `returnUrl?: string`
     - `metadata?: Record<string, any>` (ожидаются специфичные для TBank поля: `tbankPayType: 'O' | 'T'`, `isRecurrent: boolean`, `customerKey: string`)
   - **`InitiatePaymentResult` (выходные, из `base.ts`):**
     - `paymentId: string`
     - `externalPaymentId?: string` (TBank `PaymentId`)
     - `status: string` (`PaymentStatus`)
     - `redirectUrl?: string` (TBank `PaymentURL` для перехода пользователя)
     - `sdkData?: any` (не используется TBank)
     - `providerResponse?: any` (ответ от TBank `TBankInitResponse`)
     - `errorMessage?: string`
   - **Взаимодействие с TBank:**
     - **Отправляет:** Запрос на `/v2/Init` (структура `TBankInitRequest`).
     - **Принимает:** Ответ от `/v2/Init` (структура `TBankInitResponse`).
   - **Статус реализации:** ✅ Реализован

### 2. `handleWebhook`
   - **Назначение:** Обрабатывает входящие HTTP POST уведомления от TBank о статусе платежей или других операциях.
   - **Сигнатура:**
     ```typescript
     async handleWebhook(request: Request, rawBody: string | Buffer): Promise<WebhookHandlingResult>
     ```
   - **Входные данные:**
     - `request: Request` (объект HTTP запроса)
     - `rawBody: string | Buffer` (тело запроса, ожидается `x-www-form-urlencoded`)
   - **`WebhookHandlingResult` (выходные, из `base.ts`):**
     - `providerName: string`
     - `paymentId?: string` (внутренний ID платежа, TBank `OrderId`)
     - `externalPaymentId?: string` (TBank `PaymentId`)
     - `subscriptionId?: string` (внутренний ID подписки, если применимо)
     - `newPaymentStatus?: string` (`PaymentStatus`)
     - `newSubscriptionStatus?: string`
     - `processed: boolean`
     - `error?: string`
     - `messageToProvider?: string` (ожидается "OK" или "ERROR")
   - **Взаимодействие с TBank:**
     - **Принимает:** Уведомление от TBank (формат `x-www-form-urlencoded`, поля соответствуют различным нотификациям, например, `OrderId`, `PaymentId`, `Status`, `Token`, `RebillId`, `CardId` и др.). Специфической структуры "TBankWebhookPayload" в коде не определено, парсится "на лету".
   - **Статус реализации:** ✅ Реализован (базовая обработка, валидация токена, маппинг статусов).

### 3. `getPaymentStatus`
   - **Назначение:** Запрашивает актуальный статус платежа у TBank.
   - **Сигнатура:**
     ```typescript
     async getPaymentStatus(internalPaymentId: string, externalPaymentId?: string): Promise<PaymentStatusResult>
     ```
   - **Входные данные:**
     - `internalPaymentId: string` (ваш внутренний ID, хотя для TBank важнее `externalPaymentId`)
     - `externalPaymentId?: string` (TBank `PaymentId`, обязателен для запроса)
   - **`PaymentStatusResult` (выходные, из `base.ts`):**
     - `internalPaymentId: string`
     - `status: string` (`PaymentStatus`)
     - `providerStatus?: string` (статус от TBank)
     - `paidAt?: Date | string`
     - `error?: string`
     - `providerResponse?: any` (ответ от TBank `TBankGetStateResponse`)
   - **Взаимодействие с TBank:**
     - **Отправляет:** Запрос на `/v2/GetState` (структура `TBankGetStateRequest`).
     - **Принимает:** Ответ от `/v2/GetState` (структура `TBankGetStateResponse`).
   - **Статус реализации:** ✅ Реализован

### 4. `createSubscription`
   - **Назначение:** Инициирует создание подписки, что для TBank обычно означает проведение первого платежа с флагом рекуррентности для получения `RebillId`.
   - **Сигнатура:**
     ```typescript
     async createSubscription(args: SubscriptionDetailsArgs): Promise<CreateSubscriptionResult>
     ```
   - **`SubscriptionDetailsArgs` (входные, из `base.ts`):**
     - `objectHid: string`
     - `userId: string`
     - `planId: string`
     - `paymentMethodId?: string`
     - `trialDays?: number` (не используется TBank напрямую)
     - `couponCode?: string` (не используется TBank напрямую)
     - `metadata?: Record<string, any>` (ожидаются специфичные для TBank поля: `tbankCustomerKey: string`, `tbankInitialAmount: number`, `tbankCurrency: string`, `tbankDescription?: string`, `tbankReturnUrl?: string`)
   - **`CreateSubscriptionResult` (выходные, из `base.ts`):**
     - `subscriptionId: string` (внутренний ID подписки, текущая реализация использует ID первого платежа)
     - `externalSubscriptionId?: string` (TBank `RebillId`)
     - `status: string` (статус подписки, например, 'pending_initial_payment' или 'active')
     - `paymentRequired?: boolean`
     - `initialPaymentResult?: InitiatePaymentResult` (результат вызова `initiatePayment` для первого платежа)
     - `errorMessage?: string`
   - **Взаимодействие с TBank:**
     - Непрямое, через вызов `initiatePayment` с `metadata.isRecurrent = true`.
   - **Статус реализации:** ✅ Реализован (логика первого платежа для получения `RebillId`).

### 5. `cancelSubscription`
   - **Назначение:** Отменяет подписку в вашей системе (мягкая отмена). TBank не имеет прямого API для отмены `RebillId`.
   - **Сигнатура:**
     ```typescript
     async cancelSubscription(args: CancelSubscriptionArgs): Promise<CancelSubscriptionResult>
     ```
   - **`CancelSubscriptionArgs` (входные, из `base.ts`):**
     - `internalSubscriptionId: string`
     - `cancelAtPeriodEnd?: boolean`
     - `reason?: string`
   - **`CancelSubscriptionResult` (выходные, из `base.ts`):**
     - `subscriptionId: string`
     - `newStatus: string` (обычно 'canceled')
     - `canceledAt?: Date | string`
     - `errorMessage?: string`
   - **Взаимодействие с TBank:** Нет прямого взаимодействия.
   - **Статус реализации:** ✅ Реализован (как мягкая отмена).

### 6. `addPaymentMethod`
   - **Назначение:** Инициирует процесс привязки карты клиента к `CustomerKey` в системе TBank. Может потребовать от пользователя перехода по URL для верификации карты.
   - **Сигнатура:**
     ```typescript
     async addPaymentMethod(args: AddPaymentMethodArgs): Promise<AddPaymentMethodResult>
     ```
   - **`AddPaymentMethodArgs` (входные, из `base.ts`):**
     - `userId: string`
     - `providerName: string` (ожидается 'tbank')
     - `type: string` (ожидается 'card')
     - `details: Record<string, any>` (ожидаются специфичные для TBank поля: `tbankCustomerKey: string`, `tbankReturnUrl?: string`, `tbankCheckType?: 'NO' | 'HOLD' | '3DS'`)
     - `setAsDefault?: boolean`
   - **`AddPaymentMethodResult` (выходные, из `base.ts`):**
     - `paymentMethodId: string` (внутренний ID; в текущей реализации возвращается пустым, т.к. карта сохраняется после вебхука)
     - `externalId?: string` (TBank `CardId`; в текущей реализации `undefined`, см. выше)
     - `status: PaymentMethodStatus` (например, `PENDING_USER_ACTION` или `PENDING_CONFIRMATION`)
     - `detailsForUser?: Record<string, any>` (может содержать `requestKey` от TBank)
     - `isRecurrentReady: boolean` (в текущей реализации `false`, обновляется после вебхука)
     - `errorMessage?: string`
     - **Примечание:** Базовый тип `AddPaymentMethodResult` не содержит `redirectUrl`. Эта ссылка (TBank `PaymentURL` для верификации карты) жизненно важна, но не может быть возвращена стандартным образом.
   - **Взаимодействие с TBank:**
     - **Отправляет:** Запрос на `/v2/AddCard` (структура `TBankAddCardInitRequest`).
     - **Принимает:** Ответ от `/v2/AddCard` (структура `TBankAddCardInitResponse`).
   - **Статус реализации:** ✅ Реализован (инициация привязки, но с ограничением по возврату `redirectUrl`).

### Вспомогательные/внутренние методы

#### `chargeRecurrent`
   - **Назначение:** Выполняет рекуррентное списание по сохраненному `RebillId`.
   - **Сигнатура:**
     ```typescript
     async chargeRecurrent(args: { rebillId: string, orderId: string, amount: number, description?: string, customerKey?: string }): Promise<TBankInitResponse>
     ```
   - **Взаимодействие с TBank:**
     - **Отправляет:** Запрос на `/v2/Charge` (структура `TBankChargeRequest`).
     - **Принимает:** Ответ от `/v2/Charge` (структура `TBankInitResponse`).
   - **Статус реализации:** ✅ Реализован

#### `getCardList`
   - **Назначение:** Получает список привязанных карт клиента.
   - **Сигнатура:**
     ```typescript
     async getCardList(customerKey: string): Promise<TBankGetCardListResponse | null>
     ```
   - **Взаимодействие с TBank:**
     - **Отправляет:** Запрос на `/v2/GetCardList` (структура `TBankGetCardListRequest`).
     - **Принимает:** Ответ от `/v2/GetCardList` (массив `TBankCardInfo`, т.е. `TBankGetCardListResponse`).
   - **Статус реализации:** ✅ Реализован

#### `removeCard`
   - **Назначение:** Удаляет привязанную карту клиента.
   - **Сигнатура:**
     ```typescript
     async removeCard(customerKey: string, cardId: string): Promise<TBankCommonResponse>
     ```
   - **Взаимодействие с TBank:**
     - **Отправляет:** Запрос на `/v2/RemoveCard` (структура `TBankRemoveCardRequest`).
     - **Принимает:** Ответ от `/v2/RemoveCard` (структура `TBankCommonResponse`).
   - **Статус реализации:** ✅ Реализован

#### `confirmPayment` и `cancelPayment`
   - Подтверждает двухстадийный платеж и отменяет (до авторизации) или возвращает (после авторизации/списания) платеж.
   - **Взаимодействие с TBank:**
     - **Отправляет:** Запросы на `/v2/Confirm` и `/v2/Cancel`.
   - **Статус реализации:** ✅ Реализованы с поддержкой генерации чеков.

## Структуры данных TBank (используемые адаптером)

На основе документации TBank API ([https://www.tinkoff.ru/kassa/dev/payments/](https://www.tinkoff.ru/kassa/dev/payments/)) и кода адаптера:

**Запросы к TBank (отправляются адаптером):**

*   `TBankInitRequest` (для `/v2/Init`)
    *   `TerminalKey: string`
    *   `Amount: number` (в копейках)
    *   `OrderId: string`
    *   `Description?: string`
    *   `DATA?: { [key: string]: string }`
    *   `Receipt?: TBankReceipt`
    *   `ReturnUrl?: string`
    *   `NotificationURL?: string`
    *   `PayType?: 'O' | 'T'`
    *   `Recurrent?: 'Y'`
    *   `CustomerKey?: string`
    *   `Language?: 'ru' | 'en'`
    *   `RedirectDueDate?: string`
    *   `Token?: string` (генерируется адаптером)
*   `TBankGetStateRequest` (для `/v2/GetState`)
    *   `TerminalKey: string`
    *   `PaymentId: string`
    *   `Token?: string`
*   `TBankConfirmRequest` (для `/v2/Confirm`)
    *   `TerminalKey: string`
    *   `PaymentId: string`
    *   `Amount?: number`
    *   `Receipt?: TBankReceipt`
    *   `Token?: string`
*   `TBankCancelRequest` (для `/v2/Cancel`)
    *   `TerminalKey: string`
    *   `PaymentId: string`
    *   `Amount?: number`
    *   `Receipt?: TBankReceipt`
    *   `Token?: string`
*   `TBankAddCardInitRequest` (для `/v2/AddCard`)
    *   `TerminalKey: string`
    *   `CustomerKey: string`
    *   `CheckType?: 'NO' | 'HOLD' | '3DS'`
    *   `DATA?: { [key: string]: string }`
    *   `NotificationURL?: string`
    *   `ReturnUrl?: string`
    *   `Token?: string`
*   `TBankGetCardListRequest` (для `/v2/GetCardList`)
    *   `TerminalKey: string`
    *   `CustomerKey: string`
    *   `Token?: string`
*   `TBankRemoveCardRequest` (для `/v2/RemoveCard`)
    *   `TerminalKey: string`
    *   `CardId: string`
    *   `CustomerKey: string`
    *   `Token?: string`
*   `TBankChargeRequest` (для `/v2/Charge`)
    *   `TerminalKey: string`
    *   `RebillId: string`
    *   `Amount: number`
    *   `OrderId: string`
    *   `Description?: string`
    *   `DATA?: { [key: string]: string }`
    *   `Receipt?: TBankReceipt`
    *   `NotificationURL?: string`
    *   `CustomerKey?: string`
    *   `Token?: string`

**Ответы от TBank (принимаются адаптером):**

*   `TBankInitResponse` (от `/v2/Init` и `/v2/Charge`)
    *   `Success: boolean`
    *   `ErrorCode: string`
    *   `Message?: string`
    *   `Details?: string`
    *   `TerminalKey: string`
    *   `Status: string`
    *   `PaymentId: string` (ID платежа в системе Банка)
    *   `OrderId: string`
    *   `Amount: number`
    *   `PaymentURL?: string`
    *   `CardId?: string`
    *   `RebillId?: string`
*   `TBankGetStateResponse` (от `/v2/GetState`)
    *   `Success: boolean`
    *   `ErrorCode: string`
    *   `Message?: string`
    *   `TerminalKey: string`
    *   `Status: string`
    *   `PaymentId: string`
    *   `OrderId: string`
    *   `Amount: number`
    *   `CardId?: string`
    *   `Pan?: string`
    *   `ExpDate?: string`
*   `TBankAddCardInitResponse` (от `/v2/AddCard`)
    *   `Success: boolean`
    *   `ErrorCode: string`
    *   `Message?: string`
    *   `TerminalKey: string`
    *   `CustomerKey: string`
    *   `RequestKey: string`
    *   `PaymentURL?: string`
*   `TBankGetCardListResponse` (от `/v2/GetCardList` - это массив `TBankCardInfo[]`)
    *   `TBankCardInfo` (элемент массива):
        *   `CardId: string`
        *   `Pan: string`
        *   `ExpDate: string`
        *   `CardType?: string`
        *   `Status: 'A' | 'I' | 'E'`
        *   `RebillId?: string`
        *   `IsDefault?: boolean`
*   `TBankCommonResponse` (общий тип для многих ответов, особенно при ошибках или для простых операций типа `RemoveCard`, `Confirm`, `Cancel`)
    *   `Success: boolean`
    *   `ErrorCode: string`
    *   `Message?: string`
    *   `Details?: string`
    *   `TerminalKey?: string`
    *   `Status?: string`
    *   `PaymentId?: string`
    *   `OrderId?: string`
    *   `Amount?: number`
    *   `CardId?: string`
    *   `RebillId?: string`

**Объекты для чеков (фискализация):**

*   `TBankReceipt`
*   `TBankReceiptItem`

## Полный список методов для поддержки сценариев

1.  **Одноразовый платеж:**
    *   `initiatePayment(args)` с `metadata.tbankPayType = 'O'` (или без него, т.к. 'O' по умолчанию) и без `metadata.isRecurrent = true`.
    *   `handleWebhook(payload)` для получения результата.
    *   `getPaymentStatus(paymentId, externalPaymentId)` для проверки статуса.
    *   **Состояние:** ✅ В основном реализовано.

2.  **Платеж с активацией рекуррентности (первый платеж для подписки или сохранения карты):**
    *   `initiatePayment(args)` с `metadata.isRecurrent = true` и `metadata.customerKey = '...'`. (В `createSubscription` это делается автоматически).
    *   `handleWebhook(payload)` для получения результата и `RebillId`/`CardId` из `payload.RebillId`, `payload.CardId`.
    *   `getPaymentStatus(...)`.
    *   **Состояние:** ✅ В основном реализовано (в рамках `initiatePayment` и `createSubscription`). `RebillId` и `CardId` доступны в `providerResponse` или вебхуке.

3.  **Привязка карты без немедленного платежа:**
    *   `addPaymentMethod(args)` с `details.tbankCustomerKey = '...'`.
    *   Обработка редиректа пользователя на `PaymentURL` (если вернулся, сейчас это проблема из-за `base.ts`).
    *   `handleWebhook(payload)` или отдельный обработчик для `/api/payments/tbank/card-webhook` для получения `CardId` и `RebillId`.
    *   `getCardList(customerKey)` для подтверждения и получения деталей карты.
    *   **Состояние:** 🟡 Частично реализовано. Инициация есть, но проблема с возвратом `redirectUrl` и требует полной реализации обработчика вебхука для карт.

4.  **Рекуррентный платеж после привязки (автоплатеж):**
    *   `chargeRecurrent({ rebillId, orderId, amount, ... })`.
    *   `handleWebhook(payload)` для получения результата.
    *   `getPaymentStatus(...)`.
    *   **Состояние:** ✅ Реализовано.

5.  **Отвязка (удаление) привязанной карты:**
    *   `removeCard(customerKey, cardId)`.
    *   **Состояние:** ✅ Реализовано.

6.  **Прочие возможные методы и сценарии:**
    *   **Двухстадийные платежи:**
        *   `initiatePayment(args)` с `metadata.tbankPayType = 'T'`. (✅ для Init)
        *   `confirmPayment(externalPaymentId, amount?)` для списания захолдированных средств. (🟡 Заглушка)
        *   `cancelPayment(externalPaymentId, amount?)` для отмены холда (до Confirm). (🟡 Заглушка)
    *   **Возвраты платежей:**
        *   `cancelPayment(externalPaymentId, amount?)` для полного или частичного возврата после списания. (🟡 Заглушка)
    *   **Получение списка привязанных карт клиента:**
        *   `getCardList(customerKey)`. (✅ Реализовано)
    *   **Работа с клиентами TBank (если требуется отдельно от платежей/карт):**
        *   API TBank имеет методы `/v2/AddCustomer`, `/v2/GetCustomer`, `/v2/RemoveCustomer`. В текущем адаптере они не реализованы как отдельные публичные методы, но `CustomerKey` используется.
        *   **Состояние:** ❌ Не реализовано как отдельные методы.
    *   **Фискализация (отправка чеков):**
        *   Требует формирования объекта `Receipt` и передачи его в `Init`, `Confirm`, `Cancel`. Интерфейсы есть, но практическая интеграция не завершена.
        *   **Состояние:** 🟡 Частично (интерфейсы есть, логика формирования и передачи чеков не завершена).

**Иконки состояния:**
*   ✅ - Реализовано и функционально (с учетом текущих ограничений `base.ts`).
*   🟡 - Частично реализовано / Заглушка / Требует доработки или решения зависимых проблем (например, с `base.ts`).
*   ❌ - Не реализовано.
