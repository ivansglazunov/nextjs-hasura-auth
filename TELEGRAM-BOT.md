# Telegram Bot Integration in Hasyx

This document outlines how to use and extend the Telegram Bot integration in Hasyx.

## Features

1. **User Registration:** When a user sends the `/start` command, they are registered in the system:
   - A record is created in the `notification_permissions` table with:
     - `provider: 'telegram_bot'`
     - `device_token: <user's chat_id>`
     - User's information in `device_info`
   - This enables sending notifications to the user via the Telegram bot

2. **Message Handling:** The bot can receive and respond to user messages with a customizable handler.

3. **Notifications System:** Users can receive system notifications via the bot (using the `telegram_bot` provider in notification system).

## Setup

1. **Create a Telegram Bot**:
   - Open Telegram and search for "BotFather"
   - Send `/start` to BotFather
   - Send `/newbot` and follow the prompts to create a bot
   - BotFather will provide you with an API Token

2. **Configure Environment Variables**:
   ```env
   # Required for Telegram Bot functionality
   TELEGRAM_BOT_TOKEN="YOUR_TELEGRAM_BOT_API_TOKEN"
   ```

3. **Set Webhook**:
   - The Hasyx Telegram bot operates via a webhook at `/api/telegram_bot`
   - You can set it manually with:
     ```
     https://api.telegram.org/bot<TOKEN>/setWebhook?url=<YOUR_APP_URL>/api/telegram_bot
     ```
   - Or use the included helper functions:
     ```typescript
     import { TelegramBot } from 'hasyx/lib/telegram-bot';
     
     const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN || '');
     await bot.setWebhook('https://your-app.vercel.app/api/telegram_bot');
     ```

## Implementation Details

### Core Components

1. **TelegramBot Class** (`lib/telegram-bot.ts`):
   ```typescript
   const bot = new TelegramBot(token);
   
   // Get bot info
   const botInfo = await bot.getMe();
   
   // Configure bot
   await bot.setName('My Bot');
   await bot.setDescription('This is my bot description');
   await bot.setCommands([{ command: '/start', description: 'Start the bot' }]);
   
   // Work with a specific chat
   const chat = bot.chat(chatId);
   await chat.sendMessage('Hello!');
   ```

2. **Webhook Handler** (`lib/telegram-handler.ts`):
   ```typescript
   import { handleTelegramBot } from 'hasyx/lib/telegram-handler';
   
   // Simple usage
   return handleTelegramBot(request);
   
   // With custom message handler
   return handleTelegramBot(request, async ({ bot, chat, message, username }) => {
     await chat.sendMessage(`Hello ${username}, I received: ${message.text}`);
   });
   ```

3. **API Route** (`app/api/telegram_bot/route.ts`):
   - Handles incoming webhook requests from Telegram
   - Implements a simple echo response by default
   - Can be customized with your own message handling logic

### Notification System Integration

The bot supports sending notifications through the Hasyx notification system:

1. When a user sends `/start`, they are registered in the `notification_permissions` table
2. The `telegram_bot` provider in `lib/notify-telegram.ts` uses the chat ID as the `device_token`
3. When a notification is triggered for a user with a Telegram permission:
   - The notification message is formatted for Telegram
   - The message is sent to the user's chat ID using the Telegram API

## Usage Examples

### Simple Echo Bot

```typescript
// app/api/telegram_bot/route.ts
export async function POST(request: NextRequest) {
  return handleTelegramBot(request, async ({ chat, message, username }) => {
    await chat.sendMessage(`Hello ${username}, you said: ${message.text}`);
  });
}
```

### Command Handler

```typescript
export async function POST(request: NextRequest) {
  return handleTelegramBot(request, async ({ chat, message }) => {
    const text = message.text || '';
    
    if (text.startsWith('/help')) {
      await chat.sendMessage('Available commands:\n/start - Register for notifications\n/help - Show this help');
    } else if (text.startsWith('/status')) {
      await chat.sendMessage('System status: operational');
    } else {
      await chat.sendMessage('Unknown command. Type /help for available commands.');
    }
  });
}
```

## Future Enhancements

The Telegram Bot API offers many features not yet implemented in the current integration:

1. **Interactive Keyboards**:
   ```typescript
   // Potential implementation
   await chat.sendMessage('Please select an option:', {
     reply_markup: {
       inline_keyboard: [
         [{ text: 'Option 1', callback_data: 'opt1' }],
         [{ text: 'Option 2', callback_data: 'opt2' }]
       ]
     }
   });
   ```

2. **Callback Query Handling**:
   ```typescript
   // Future handler structure
   handleTelegramBot(request, {
     messageHandler: async ({ chat, message }) => {
       // Handle regular messages
     },
     callbackQueryHandler: async ({ query, bot }) => {
       // Handle button clicks
       await bot.answerCallbackQuery(query.id, { text: 'Processing your selection...' });
     }
   });
   ```

3. **Media Messages**:
   ```typescript
   // Potential methods to add
   await chat.sendPhoto(url, caption);
   await chat.sendDocument(fileUrl, caption);
   await chat.sendLocation(latitude, longitude);
   ```

4. **Webhook Management**:
   - Enhanced webhook configuration options (allowed updates, max connections)
   - Certificate handling for self-signed certs

5. **User Management**:
   - Track active users
   - Manage user preferences
   - Handle bot blocking/unblocking events

6. **Group Chat Support**:
   - Process group messages
   - Manage group administrative actions (when bot is admin)
   - Support for forum topics/threads

7. **Telegram Payment Integration**:
   - Process Telegram payments through the Bot API

## Implementation Roadmap

1. **Short Term**:
   - Support for inline keyboards and callback queries
   - Media message sending (photos, documents)
   - Enhanced error handling and rate limiting support

2. **Medium Term**:
   - Group chat support
   - Bot commands auto-configuration
   - Persistent menus and session management

3. **Long Term**:
   - Payments integration
   - Integration with Telegram Web Apps
   - Bot Analytics and usage statistics

## Resources

- [Official Telegram Bot API Documentation](https://core.telegram.org/bots/api)
- [BotFather Instructions](https://core.telegram.org/bots#botfather)
- [Telegram Bot API Methods](https://core.telegram.org/bots/api#available-methods) 