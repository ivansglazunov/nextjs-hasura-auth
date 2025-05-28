# TBank Payment Testing Guide

## 🎯 Полная Система Готова к Тестированию

Система рекуррентных платежей TBank полностью реализована и включает:
- ✅ Автоматический планировщик подписок (каждые 10 минут)
- ✅ Полный UI для управления платежами
- ✅ API endpoints для всех операций
- ✅ Детальное логирование в hasyx.debug
- ✅ Обработка ошибок и retry логика

## 📋 Пошаговый План Тестирования

### Этап 1: Подготовка Окружения

#### 1.1 Применение Миграций
```bash
# Применить обновленные миграции payments
npm run migrate:up
```

#### 1.2 Проверка Cron События
```bash
# Убедиться что cron событие создано
ls -la events/subscription-billing.json
```

#### 1.3 Переменные Окружения
Убедиться что установлены:
- `TBANK_TEST_TERMINAL_KEY`
- `TBANK_TEST_SECRET_KEY`
- `HASURA_EVENT_SECRET`
- `NEXT_PUBLIC_APP_URL`

### Этап 2: Настройка Провайдера

#### 2.1 Открыть Страницу Платежей
Перейти на `/app/hasyx/payments`

#### 2.2 Добавить TBank Test Провайдер
1. Нажать "Add TBank Test"
2. Заполнить:
   - Name: "TBank Test"
   - Terminal Key: `${TBANK_TEST_TERMINAL_KEY}`
   - Secret Key: `${TBANK_TEST_SECRET_KEY}`
3. Нажать "Add Provider"

#### 2.3 Проверка Провайдера
```bash
npm run js -- -e "console.log(await client.select({table: 'payments_providers', returning: ['*']}))"
```

### Этап 3: Создание Тестового Плана

#### 3.1 Создать План для Быстрого Тестирования
1. Перейти на вкладку "Plans"
2. Нажать "Create Plan"
3. Заполнить:
   - Plan Name: "Test Plan 1 Minute"
   - Description: "Test plan for quick billing cycles"
   - Price: "100"
   - Currency: "RUB"
   - Interval: "minute"
   - Count: "1"
   - Trial Period: "0"
4. Нажать "Create Plan"

#### 3.2 Проверка Плана
```bash
npm run js -- -e "console.log(await client.select({table: 'payments_plans', returning: ['*']}))"
```

### Этап 4: Добавление Метода Оплаты

#### 4.1 Добавить Карту
1. Перейти на вкладку "Payment Methods"
2. Нажать "Add Payment Method"
3. Заполнить:
   - Provider: выбрать созданный TBank Test
   - Customer Key: "test_customer_123"
4. Нажать "Add Method"

#### 4.2 Завершить Добавление Карты
1. Откроется окно TBank
2. Использовать тестовую карту: `4300000000000777`
3. Завершить процедуру добавления

#### 4.3 Проверка Метода Оплаты
```bash
npm run js -- -e "console.log(await client.select({table: 'payments_methods', returning: ['*', {provider: ['name']}]}))"
```

### Этап 5: Создание Подписки

#### 5.1 Создать Подписку
1. Перейти на вкладку "Plans"
2. Найти созданный план "Test Plan 1 Minute"
3. Нажать "Subscribe"
4. Выбрать добавленный метод оплаты
5. Нажать "Create Subscription"

#### 5.2 Завершить Первый Платеж
1. Откроется окно TBank для первого платежа
2. Завершить платеж

#### 5.3 Проверка Подписки
```bash
npm run js -- -e "console.log(await client.select({table: 'payments_subscriptions', returning: ['id', 'status', 'computed_next_billing_date', 'computed_last_billing_date', 'computed_missed_cycles', 'billing_retry_count']}))"
```

### Этап 6: Мониторинг Автоматических Списаний

#### 6.1 Ожидание (10-15 минут)
Подождать 10-15 минут для срабатывания cron события

#### 6.2 Проверка Debug Логов
```bash
# Проверить логи cron события
npm run js -- -e "console.log(await client.select({table: 'debug', where: {event: {_like: '%subscription_billing%'}}, order_by: {created_at: 'desc'}, limit: 10, returning: ['event', 'data', 'created_at']}))"
```

#### 6.3 Проверка Новых Операций
```bash
# Проверить автоматически созданные операции
npm run js -- -e "console.log(await client.select({table: 'payments_operations', where: {subscription_id: {_is_null: false}}, returning: ['id', 'subscription_id', 'status', 'paid_at', 'amount']}))"
```

#### 6.4 Проверка Обновления Подписки
```bash
# Проверить обновление next_billing_date
npm run js -- -e "console.log(await client.select({table: 'payments_subscriptions', returning: ['id', 'status', 'computed_next_billing_date', 'computed_last_billing_date', 'computed_missed_cycles', 'billing_retry_count']}))"
```

### Этап 7: Тестирование Обработки Ошибок

#### 7.1 Создать План с Большой Суммой
1. Создать план с ценой 999999 RUB
2. Создать подписку на этот план
3. Дождаться автоматического списания

#### 7.2 Проверка Retry Логики
```bash
# Проверить увеличение retry_count
npm run js -- -e "console.log(await client.select({table: 'payments_subscriptions', where: {billing_retry_count: {_gt: 0}}, returning: ['*']}))"

# Проверить failed операции
npm run js -- -e "console.log(await client.select({table: 'payments_operations', where: {status: {_eq: 'failed'}}, returning: ['*']}))"
```

## 🔍 Команды для Диагностики

### Общий Статус Системы
```bash
# Все провайдеры
npm run js -- -e "console.log('=== PROVIDERS ==='); console.log(await client.select({table: 'payments_providers', returning: ['id', 'name', 'type', 'is_test_mode']}))"

# Все планы
npm run js -- -e "console.log('=== PLANS ==='); console.log(await client.select({table: 'payments_plans', returning: ['id', 'name', 'price', 'currency', 'interval', 'interval_count', 'active']}))"

# Все методы оплаты
npm run js -- -e "console.log('=== PAYMENT METHODS ==='); console.log(await client.select({table: 'payments_methods', returning: ['id', 'user_id', 'type', 'status', 'is_recurrent_ready', {provider: ['name']}]}))"

# Все подписки
npm run js -- -e "console.log('=== SUBSCRIPTIONS ==='); console.log(await client.select({table: 'payments_subscriptions', returning: ['id', 'user_id', 'status', 'computed_next_billing_date', 'computed_last_billing_date', 'computed_missed_cycles', 'billing_retry_count', {plan: ['name']}, {provider: ['name']}]}))"

# Последние операции
npm run js -- -e "console.log('=== RECENT OPERATIONS ==='); console.log(await client.select({table: 'payments_operations', order_by: {created_at: 'desc'}, limit: 10, returning: ['id', 'amount', 'currency', 'status', 'description', 'created_at']}))"
```

### Debug Логи по Категориям
```bash
# Cron события
npm run js -- -e "console.log('=== CRON EVENTS ==='); console.log(await client.select({table: 'debug', where: {event: {_like: '%cron%'}}, order_by: {created_at: 'desc'}, limit: 5, returning: ['event', 'data', 'created_at']}))"

# Billing события
npm run js -- -e "console.log('=== BILLING EVENTS ==='); console.log(await client.select({table: 'debug', where: {event: {_like: '%billing%'}}, order_by: {created_at: 'desc'}, limit: 10, returning: ['event', 'data', 'created_at']}))"

# Ошибки
npm run js -- -e "console.log('=== ERRORS ==='); console.log(await client.select({table: 'debug', where: {event: {_like: '%error%'}}, order_by: {created_at: 'desc'}, limit: 5, returning: ['event', 'data', 'created_at']}))"
```

### Детальная Информация о Подписке
```bash
# Заменить SUBSCRIPTION_ID на реальный ID
npm run js -- -e "
const subId = 'SUBSCRIPTION_ID';
console.log('=== SUBSCRIPTION DETAILS ===');
const sub = await client.select({
  table: 'payments_subscriptions', 
  where: {id: {_eq: subId}}, 
  returning: ['*', {plan: ['*']}, {method: ['*']}, {provider: ['*']}]
});
console.log(sub);

console.log('=== SUBSCRIPTION OPERATIONS ===');
const ops = await client.select({
  table: 'payments_operations',
  where: {subscription_id: {_eq: subId}},
  order_by: {created_at: 'desc'},
  returning: ['*']
});
console.log(ops);
"
```

## 📊 Ожидаемые Результаты

### После Создания Подписки
- Статус подписки: `active` (если без trial) или `trialing`
- Первая операция: `succeeded`
- `computed_next_billing_date`: через 1 минуту от создания
- `computed_last_billing_date`: обновлена
- `computed_missed_cycles`: 0
- `billing_retry_count`: 0

### После Первого Автоматического Списания
- Новая операция со статусом `succeeded`
- `computed_last_billing_date`: обновлена
- `computed_next_billing_date`: сдвинута на +1 минуту
- Debug лог: `subscription_billing_success`

### При Ошибке Списания
- Операция со статусом `failed`
- `billing_retry_count`: увеличен
- `computed_next_billing_date`: сдвинута на +30 минут (retry)
- Debug лог: `subscription_billing_error`

### После Исчерпания Retry
- Статус подписки: `past_due`
- `billing_retry_count`: равен `max_billing_retries`
- Debug лог: `subscription_billing_max_retries_reached`

## 🚨 Возможные Проблемы и Решения

### Cron Событие Не Срабатывает
```bash
# Проверить что событие создано в Hasura
# Проверить переменную HASURA_EVENT_SECRET
# Проверить логи Hasura
```

### Методы Оплаты Не Становятся Recurrent Ready
- Проверить webhook обработку
- Убедиться что карта успешно добавлена
- Проверить статус в TBank

### Автоматические Списания Не Работают
- Проверить debug логи на ошибки
- Убедиться что подписка в статусе `active`
- Проверить что `computed_next_billing_date` в прошлом

## ✅ Критерии Успешного Тестирования

1. **Провайдер создан** и отображается в UI
2. **План создан** с интервалом 1 минута
3. **Метод оплаты добавлен** и имеет статус `active` + `is_recurrent_ready: true`
4. **Подписка создана** и первый платеж прошел успешно
5. **Автоматическое списание** произошло через 1-2 минуты после создания
6. **Debug логи** показывают успешную работу cron события
7. **Retry логика** работает при ошибках списания

После успешного прохождения всех этапов система готова к продакшен использованию! 