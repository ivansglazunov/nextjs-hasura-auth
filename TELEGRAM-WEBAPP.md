# Telegram WebApp Integration

Безопасная интеграция авторизации через Telegram WebApp для приложений на основе Next.js с NextAuth.js и Hasura.

## Архитектура

Система авторизации поддерживает:

### OAuth провайдеры:
- **Google** - OAuth через Google APIs
- **Yandex** - OAuth через Yandex ID
- **GitHub** - OAuth через GitHub Apps
- **Facebook** - OAuth через Facebook Login
- **VK** - OAuth через VK Connect

### Credentials провайдеры:
- **Email/Password** - традиционная авторизация с верификацией email
- **Telegram Login Widget** - авторизация через Telegram Login Widget
- **Telegram WebApp** - безопасная авторизация внутри Telegram WebApp

## Telegram WebApp Integration

### Компоненты

1. **Серверная часть** (`lib/telegram-miniapp-server.ts`):
   - Валидация `initData` с помощью HMAC-SHA256
   - Парсинг данных пользователя Telegram
   - Интеграция с `getOrCreateUserAndAccount`

2. **Клиентская часть** (`hooks/use-telegram-webapp.ts`):
   - React хук для работы с Telegram WebApp API
   - Автоматическая инициализация WebApp
   - Поддержка нативных функций (кнопки, haptic feedback)

3. **Компонент авторизации** (`components/auth/telegram-webapp-auth.tsx`):
   - Готовый UI для авторизации
   - Автоматическая авторизация при наличии данных
   - Обработка ошибок и состояний загрузки

4. **API роут** (`app/api/auth/verify-telegram-webapp/route.ts`):
   - Верификация `initData` на сервере
   - CORS поддержка
   - Защита от подделки данных

### Настройка

#### 1. Переменные окружения

```bash
# Токен бота для валидации Telegram данных
TELEGRAM_LOGIN_BOT_TOKEN=your_bot_token_here

# Для Telegram Login Widget (опционально)
TELEGRAM_LOGIN_BOT_USERNAME=your_bot_username
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=your_bot_username
```

#### 2. Создание Telegram бота

1. Создайте бота через [@BotFather](https://t.me/BotFather)
2. Используйте команду `/newbot` и следуйте инструкциям
3. Получите токен бота и username
4. Настройте WebApp URL командой `/mybots` → выберите бота → "Bot Settings" → "Menu Button" → "Edit Menu Button URL"

#### 3. Использование компонентов

```typescript
import { TelegramWebAppAuth } from 'hasyx/components/auth/telegram-webapp-auth';
import { useTelegramWebApp } from 'hasyx/hooks/use-telegram-webapp';

function MyApp() {
  const {
    isInTelegram,
    user,
    initData,
    showAlert,
    haptic,
    mainButton
  } = useTelegramWebApp();

  return (
    <div>
      <TelegramWebAppAuth
        onSuccess={(user) => console.log('Authenticated:', user)}
        onError={(error) => console.error('Auth error:', error)}
        autoAuth={true}
      />
    </div>
  );
}
```

### Безопасность

#### Валидация initData

Все данные от Telegram проходят серверную валидацию:

1. **HMAC-SHA256 проверка**: Данные проверяются с помощью secret key, полученного из bot token
2. **Время жизни**: Проверяется `auth_date` для предотвращения replay атак
3. **Структура данных**: Валидация формата и обязательных полей

```typescript
// Пример валидации на сервере
const isValid = await validateTelegramInitData(initData);
if (!isValid) {
  throw new Error('Invalid Telegram data');
}
```

#### Интеграция с NextAuth

После успешной валидации:

1. Данные передаются в `TelegramMiniappCredentialsProvider`
2. Вызывается `getOrCreateUserAndAccount` для создания/связывания аккаунта
3. Генерируется JWT токен с Hasura claims
4. Устанавливается NextAuth сессия

### Функционал WebApp

#### Хук `useTelegramWebApp`

```typescript
const {
  // Состояние
  isInTelegram,      // Находимся ли в Telegram WebApp
  isLoading,         // Загрузка инициализации
  user,              // Данные пользователя Telegram
  initData,          // Сырые initData
  platform,          // Платформа (ios, android, desktop)
  version,           // Версия Telegram
  colorScheme,       // Тема (light/dark)
  
  // Действия
  ready,             // Сигнал готовности приложения
  close,             // Закрытие WebApp
  expand,            // Разворачивание на весь экран
  showAlert,         // Показ нативного alert
  showConfirm,       // Показ нативного confirm
  
  // UI элементы
  mainButton: {
    setText,         // Установка текста главной кнопки
    setOnClick,      // Установка обработчика клика
    show,            // Показ кнопки
    hide,            // Скрытие кнопки
    enable,          // Активация кнопки
    disable,         // Деактивация кнопки
    showProgress,    // Показ индикатора загрузки
    hideProgress,    // Скрытие индикатора загрузки
  },
  
  backButton: {
    setOnClick,      // Установка обработчика клика
    show,            // Показ кнопки назад
    hide,            // Скрытие кнопки назад
  },
  
  // Haptic Feedback
  haptic: {
    impact,          // Тактильная отдача (light/medium/heavy)
    notification,    // Уведомления (success/warning/error)
    selection,       // Отклик на выбор
  }
} = useTelegramWebApp();
```

#### Пример использования UI элементов

```typescript
// Главная кнопка
mainButton.setText('Продолжить');
mainButton.setOnClick(() => {
  mainButton.showProgress();
  // ... выполнение действия
  haptic.notification('success');
  mainButton.hideProgress();
});
mainButton.show();

// Кнопка назад
backButton.setOnClick(() => {
  showConfirm('Вы уверены, что хотите выйти?').then((confirmed) => {
    if (confirmed) {
      close();
    }
  });
});
backButton.show();

// Haptic feedback
haptic.impact('light');          // Легкая вибрация
haptic.notification('success');   // Успешное действие
haptic.selection();              // Выбор элемента
```

### Тестирование

#### Локальная разработка

Для тестирования вне Telegram среды используется мок-данные:

```typescript
// Mock данные создаются автоматически в development режиме
const mockInitData = 'user=%7B%22id%22%3A123456%2C%22first_name%22%3A%22Test%22%7D&auth_date=1640995200&hash=mock_hash';
```

#### Тесты

```bash
# Запуск тестов
npm test -- lib/telegram-webapp.test.ts

# С debug информацией
DEBUG="telegram-webapp*" npm test -- lib/telegram-webapp.test.ts
```

### Развертывание

#### 1. Production настройка

```bash
# .env.production
TELEGRAM_LOGIN_BOT_TOKEN=prod_bot_token
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=your_prod_bot
```

#### 2. Настройка бота

1. Зайдите в [@BotFather](https://t.me/BotFather)
2. Выберите команду `/mybots`
3. Выберите вашего бота
4. "Bot Settings" → "Menu Button" → "Edit Menu Button URL"
5. Введите URL вашего приложения (например, `https://yourapp.vercel.app`)

#### 3. Домен

Убедитесь, что ваш домен:
- Использует HTTPS
- Доступен из интернета
- Имеет валидный SSL сертификат

### Отладка

#### Debug логи

```bash
# Клиентская сторона
DEBUG="hooks:use-telegram-webapp,auth:telegram-webapp" npm run dev

# Серверная сторона
DEBUG="telegram-miniapp*,api:auth:verify-telegram-webapp" npm run dev
```

#### Проверка initData

1. Откройте DevTools в Telegram WebApp
2. Проверьте `window.Telegram.WebApp.initData`
3. Убедитесь, что данные содержат корректный hash

#### Частые проблемы

1. **"Not in Telegram"**: Приложение не обнаруживает Telegram WebApp
   - Проверьте, что приложение открывается через Telegram
   - Убедитесь, что URL настроен в боте

2. **"Invalid Telegram data"**: Ошибка валидации initData
   - Проверьте `TELEGRAM_LOGIN_BOT_TOKEN`
   - Убедитесь, что токен соответствует боту

3. **"Authentication failed"**: Ошибка NextAuth
   - Проверьте логи сервера
   - Убедитесь, что `TelegramMiniappCredentialsProvider` настроен

### SDK Dependencies

Проект использует [`@twa-dev/sdk`](https://www.npmjs.com/package/@twa-dev/sdk) версии 8.0.2:

```json
{
  "dependencies": {
    "@twa-dev/sdk": "8.0.2"
  }
}
```

SDK предоставляет TypeScript типы и упрощает работу с Telegram WebApp API. В случае недоступности SDK используется fallback на `window.Telegram.WebApp`.

### Заключение

Данная интеграция обеспечивает:

✅ **Безопасность**: Серверная валидация всех данных  
✅ **Удобство**: Автоматическая авторизация  
✅ **Нативность**: Использование всех возможностей Telegram WebApp  
✅ **Типизация**: Полная поддержка TypeScript  
✅ **Отладка**: Подробные логи и моки для разработки  
✅ **Совместимость**: Работа с существующей архитектурой NextAuth + Hasura  

Интеграция следует лучшим практикам безопасности и обеспечивает seamless пользовательский опыт внутри Telegram экосистемы. 