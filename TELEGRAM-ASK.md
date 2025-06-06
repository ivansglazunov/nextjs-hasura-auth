# Telegram Ask Integration

Telegram Ask Integration позволяет использовать возможности Hasyx AI через Telegram bot с полной поддержкой выполнения кода и стриминга ответов.

## Features

- **🤖 AI Assistant через Telegram**: Полнофункциональный AI помощник в Telegram боте
- **⚡ Real-time Streaming**: Ответы AI приходят в Telegram в реальном времени
- **😈 Code Execution**: Выполнение JavaScript, TypeScript и терминальных команд через Telegram
- **📊 Instance Management**: Умное управление экземплярами AI для каждого пользователя  
- **💾 Memory Management**: Автоматическая очистка неактивных экземпляров
- **🛡️ Error Handling**: Graceful обработка ошибок с информативными сообщениями
- **📱 Message Buffering**: Оптимизация отправки сообщений в Telegram
- **🔧 Configurable**: Настраиваемые опции для различных сценариев использования

## Architecture

### Основные компоненты

1. **`AskHasyx`** (базовый класс) - Расширенный AI с переопределяемыми методами вывода
2. **`TelegramAskWrapper`** - Специализированный класс для работы с Telegram  
3. **Instance Manager** - Менеджер экземпляров для оптимизации ресурсов
4. **Output Handlers** - Система переопределяемых обработчиков вывода

### Схема работы

```
User Message (Telegram) 
    ↓
Telegram Bot API 
    ↓  
handleStartEvent() (database operations)
    ↓
route.ts (response generation)
    ↓
defineTelegramAsk() (get/create AI instance)
    ↓
TelegramAskWrapper.ask() (AI processing)
    ↓
Output Handlers (send to Telegram)
    ↓
Telegram Bot API → User
```

## Quick Start

### 1. Environment Setup

```env
# Required environment variables
TELEGRAM_BOT_TOKEN="your_telegram_bot_token"
OPENROUTER_API_KEY="your_openrouter_api_key"
NEXT_PUBLIC_HASURA_GRAPHQL_URL="your_hasura_url"
HASURA_ADMIN_SECRET="your_hasura_secret"
```

### 2. Basic Integration in route.ts

```typescript
import { NextResponse } from 'next/server';
import { handleStartEvent, TelegramUpdate } from 'hasyx/lib/telegram-bot';
import { defineTelegramAsk } from 'hasyx/lib/ask-telegram';

export async function POST(request: Request) {
  const payload = (await request.json()) as TelegramUpdate;
  
  // Handle /start and database operations
  const result = await handleStartEvent(payload, adminClient);
  
  if (result.success && result.chatId && result.userId && payload.message?.text) {
    if (payload.message.text.trim().toLowerCase() !== '/start') {
      // Get AI instance for this user
      const askInstance = defineTelegramAsk(
        result.userId,
        result.chatId,
        process.env.TELEGRAM_BOT_TOKEN!,
        process.env.OPENROUTER_API_KEY!,
        'My Project'
      );

      // Process with AI (responses sent automatically to Telegram)
      await askInstance.ask(payload.message.text);
    }
  }
  
  return NextResponse.json(result);
}
```

### 3. Testing

1. Create Telegram bot via [@BotFather](https://t.me/BotFather)
2. Set webhook: `https://your-app.com/api/telegram_bot`
3. Send `/start` to your bot
4. Ask any question: "Calculate 5 factorial with code"

## API Reference

### `defineTelegramAsk()`

Создает или получает экземпляр AI для конкретного пользователя.

```typescript
function defineTelegramAsk(
  userId: number,          // Telegram user ID
  chatId: number,          // Telegram chat ID  
  botToken: string,        // Telegram bot token
  openRouterToken: string, // OpenRouter API key
  projectName?: string,    // Project name for system prompt
  askOptions?: TelegramAskOptions // Additional options
): TelegramAskWrapper
```

### `TelegramAskOptions`

```typescript
interface TelegramAskOptions extends AskOptions {
  telegram?: {
    botToken: string;
    chatId: number;
    bufferTime?: number;         // Buffer timeout (default: 1000ms)
    maxMessageLength?: number;   // Max Telegram message length (default: 4096)
    enableCodeBlocks?: boolean;  // Format code blocks (default: true)
  };
}
```

### `TelegramAskWrapper`

Основной класс для работы с AI через Telegram.

```typescript
class TelegramAskWrapper extends AskHasyx {
  async ask(question: string): Promise<string>
  async flush(): Promise<void>
}
```

### Instance Management

```typescript
// Get statistics about active instances
const stats = getTelegramAskStats();
console.log(`Active instances: ${stats.totalInstances}`);

// Cleanup all instances (useful for testing)
clearAllTelegramAskInstances();
```

## Advanced Usage

### Custom Ask Options

```typescript
const askInstance = defineTelegramAsk(
  userId,
  chatId,
  botToken,
  openRouterToken,
  'Advanced Project',
  {
    exec: true,      // Enable JavaScript
    execTs: false,   // Disable TypeScript
    terminal: true,  // Enable terminal
    telegram: {
      botToken,
      chatId,
      bufferTime: 500,        // Faster responses
      maxMessageLength: 2000, // Shorter messages
      enableCodeBlocks: false // Disable code formatting
    }
  }
);
```

### Custom Output Handlers

```typescript
import { AskHasyx, OutputHandlers } from 'hasyx/lib/ask-hasyx';
import { sendTelegramMessage } from 'hasyx/lib/telegram-bot';

const customHandlers: OutputHandlers = {
  onThinking: () => sendTelegramMessage(botToken, chatId, '🤔 Думаю...'),
  onCodeFound: async (code, format) => {
    await sendTelegramMessage(botToken, chatId, `🔍 Нашел ${format} код:`);
    await sendTelegramMessage(botToken, chatId, `\`\`\`${format}\n${code}\n\`\`\``);
  },
  onCodeResult: async (result) => {
    await sendTelegramMessage(botToken, chatId, `💡 Результат:\n\`\`\`\n${result}\n\`\`\``);
  },
  onError: (error) => sendTelegramMessage(botToken, chatId, `❌ Ошибка: ${error}`)
};

const askInstance = new AskHasyx(
  openRouterToken,
  {}, // context
  {}, // options  
  'Custom system prompt',
  { exec: true, execTs: true, terminal: true },
  customHandlers
);
```

### wrapTelegramAsk()

Альтернативный способ создания Telegram-совместимого класса:

```typescript
import { Ask } from 'hasyx/lib/ask';
import { wrapTelegramAsk } from 'hasyx/lib/ask-telegram';

// Создать Telegram-версию любого Ask класса
const TelegramAsk = wrapTelegramAsk(Ask, chatId, botToken, {
  bufferTime: 1000,
  enableCodeBlocks: true
});

const askInstance = new TelegramAsk(openRouterToken, 'My Project');
```

## Error Handling

### Automatic Error Handling

Система автоматически обрабатывает ошибки и отправляет понятные сообщения:

```typescript
// AI execution error
❌ Ошибка: JavaScript execution is disabled

// Network error
❌ Ошибка: Network timeout occurred

// API error  
❌ Sorry, there was an error processing your question: Invalid API key
```

### Custom Error Handling

```typescript
try {
  const response = await askInstance.ask(userQuestion);
} catch (error) {
  await sendTelegramMessage(
    botToken,
    chatId,
    `🔧 Техническая ошибка: ${error.message}\n\nПопробуйте позже или обратитесь к администратору.`
  );
}
```

## Performance & Optimization

### Instance Lifecycle

- **Creation**: Экземпляры создаются по требованию для каждого пользователя
- **Reuse**: Повторные запросы используют существующий экземпляр
- **Cleanup**: Автоматическая очистка неактивных экземпляров (1 час)
- **Memory**: Ограничение количества активных экземпляров

### Message Buffering

```typescript
// Messages are buffered for optimal delivery
onThinking: () => buffer.add('🧠 AI думает...')
onCodeFound: (code) => buffer.add(`📋 Код: ${code}`)
// Buffer flushes every 1000ms or when full
```

### Rate Limiting

```typescript
// Automatic delays between chunked messages
for (const chunk of chunks) {
  await sendTelegramMessage(botToken, chatId, chunk);
  await sleep(100); // Prevent rate limiting
}
```

## Monitoring & Debugging

### Statistics

```typescript
const stats = getTelegramAskStats();
console.log('Active instances:', stats.totalInstances);
console.log('Instances by age:', stats.instancesByAge);
```

### Debug Logging

```bash
DEBUG="hasyx:ask-telegram,hasyx:ask-hasyx" npm start
```

Output:
```
hasyx:ask-telegram Creating new TelegramAsk instance for user 12345, chat 67890
hasyx:ask-hasyx Processing question with beautiful output: What is 2+2?
hasyx:ask-telegram Processing question for chat 67890: What is 2+2?
```

### Health Check

```typescript
// Add to your monitoring
app.get('/health/telegram-ask', (req, res) => {
  const stats = getTelegramAskStats();
  res.json({
    status: 'healthy',
    activeInstances: stats.totalInstances,
    oldestInstance: stats.instancesByAge[0]?.ageMinutes || 0
  });
});
```

## Examples

### Simple Math Bot

```typescript
// User: "Calculate 15 * 27"
🧠 AI думает...
📋 Найден JS код для выполнения:
15 * 27
⚡ Выполняется JS код...
✅ Результат выполнения:
405

The result of 15 * 27 is 405.
```

### Code Generation Bot

```typescript
// User: "Create a React component for a button"
🧠 AI думает...

Here's a simple React button component:

```tsx
interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  onClick, 
  variant = 'primary' 
}) => {
  return (
    <button 
      className={`btn btn-${variant}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
};
```

This component accepts children, click handler, and optional variant.
```

### Terminal Command Bot

```typescript
// User: "Show current directory contents"
🧠 AI думает...
📋 Найден TERMINAL код для выполнения:
ls -la
⚡ Выполняется TERMINAL код...
✅ Результат выполнения:
total 48
drwxr-xr-x  8 user  staff   256 Dec 15 10:30 .
drwxr-xr-x  4 user  staff   128 Dec 15 10:25 ..
-rw-r--r--  1 user  staff  1234 Dec 15 10:30 file.txt

Here are the contents of your current directory...
```

## Security Considerations

### API Key Management

```typescript
// ✅ Good: Use environment variables
const openRouterToken = process.env.OPENROUTER_API_KEY;

// ❌ Bad: Hardcode in source
const openRouterToken = 'sk-or-v1-hardcoded-key';
```

### User Isolation

- Каждый пользователь получает отдельный экземпляр AI
- Memory и результаты изолированы между пользователями
- Автоматическая очистка предотвращает утечки данных

### Rate Limiting

```typescript
// Implement user-level rate limiting
const userLimits = new Map<number, { count: number; resetTime: number }>();

function checkRateLimit(userId: number): boolean {
  const limit = userLimits.get(userId);
  const now = Date.now();
  
  if (!limit || now > limit.resetTime) {
    userLimits.set(userId, { count: 1, resetTime: now + 60000 });
    return true;
  }
  
  if (limit.count >= 10) { // 10 requests per minute
    return false;
  }
  
  limit.count++;
  return true;
}
```

## Troubleshooting

### Common Issues

**1. "TELEGRAM_BOT_TOKEN is not set"**
```bash
# Check environment variables
echo $TELEGRAM_BOT_TOKEN
# Add to .env file
TELEGRAM_BOT_TOKEN="your_token_here"
```

**2. "OpenRouter API Key not configured"**
```bash
# Check environment variables  
echo $OPENROUTER_API_KEY
# Get free key from openrouter.ai
```

**3. Messages not sending**
```typescript
// Check bot token and permissions
const botInfo = await fetch(`https://api.telegram.org/bot${token}/getMe`)
  .then(r => r.json());
console.log('Bot info:', botInfo);
```

**4. High memory usage**
```typescript
// Monitor instance count
setInterval(() => {
  const stats = getTelegramAskStats();
  console.log(`Active instances: ${stats.totalInstances}`);
  if (stats.totalInstances > 100) {
    console.warn('High instance count detected');
  }
}, 60000);
```

### Debug Mode

```bash
# Enable comprehensive debugging
DEBUG="hasyx:*" npm start
```

## Migration Guide

### From Basic Telegram Bot

**Before:**
```typescript
await sendTelegramMessage(botToken, chatId, `Echo: ${userMessage}`);
```

**After:**
```typescript
const askInstance = defineTelegramAsk(userId, chatId, botToken, openRouterToken);
await askInstance.ask(userMessage);
```

### From Console Ask

**Before:**
```typescript
import { ask } from 'hasyx/lib/ask';
const response = await ask.ask('What is 2+2?');
console.log(response);
```

**After:**
```typescript
import { defineTelegramAsk } from 'hasyx/lib/ask-telegram';
const askInstance = defineTelegramAsk(userId, chatId, botToken, openRouterToken);
// Response automatically sent to Telegram
await askInstance.ask('What is 2+2?');
```

## Best Practices

### 1. Instance Management
- Используйте `defineTelegramAsk()` для автоматического управления экземплярами
- Не создавайте экземпляры вручную для каждого запроса
- Мониторьте количество активных экземпляров

### 2. Error Handling
- Всегда оборачивайте AI calls в try-catch
- Предоставляйте понятные сообщения об ошибках пользователям
- Логируйте ошибки для мониторинга

### 3. Performance
- Используйте message buffering для оптимизации
- Настройте разумные timeouts
- Ограничивайте rate limits пользователей

### 4. Security
- Никогда не передавайте API ключи в сообщениях
- Изолируйте пользователей друг от друга
- Реализуйте rate limiting и abuse protection

## Related Documentation

- **[ASK.md](ASK.md)**: Базовая документация Ask системы
- **[AI.md](AI.md)**: Core AI functionality и streaming
- **[TELEGRAM-BOT.md](TELEGRAM-BOT.md)**: Basic Telegram bot integration
- **[OPENROUTER.md](OPENROUTER.md)**: OpenRouter API integration

## Contributing

Для улучшения Telegram Ask integration:

1. Fork repository
2. Создайте feature branch
3. Добавьте тесты для новой функциональности
4. Обновите документацию
5. Submit pull request

## Roadmap

### Planned Features

- **Group Chat Support**: Работа в групповых чатах
- **Inline Keyboards**: Интерактивные кнопки и меню
- **File Upload**: Обработка файлов и изображений  
- **Voice Messages**: Поддержка голосовых сообщений
- **Webhook Management**: Автоматическая настройка webhook
- **Analytics**: Детальная аналитика использования 