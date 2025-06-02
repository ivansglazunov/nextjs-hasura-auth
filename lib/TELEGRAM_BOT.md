# GitHub Telegram Bot 🤖

> **AI-powered Telegram notifications for GitHub commits with strict workflow status reporting**

## Overview

The GitHub Telegram Bot is an intelligent notification system that automatically sends celebratory commit notifications to Telegram chats. It uses AI to generate joyful, progress-focused messages while providing strict, clear reporting on build, test, and deployment statuses.

## ✨ Features

- 🎉 **AI-Generated Messages**: Celebratory, enthusiastic notifications in Russian
- 📊 **Strict Status Reporting**: Clear PASSED/FAILED status for tests, builds, and deployments
- 🔗 **Smart Linking**: Automatic links to GitHub repository and documentation
- 🚫 **Privacy-Focused**: Never mentions commit author names or emails
- 📝 **MD File Support**: Direct GitHub links for mentioned documentation files
- 🎯 **Multi-Chat Support**: Send to multiple Telegram chats/channels
- 🔄 **Real-time Workflow Status**: Fetches live GitHub Actions results

## 🚀 Quick Start

### Environment Variables

```bash
# Required
GITHUB_SHA=your-commit-sha
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
GITHUB_TELEGRAM_BOT=1  # Enable (1=basic, 2=advanced)

# Optional but recommended
GITHUB_TOKEN=your-github-token  # Higher API rate limits
OPENROUTER_API_KEY=your-ai-api-key  # AI message generation

# Telegram Recipients
TELEGRAM_ADMIN_CHAT_ID=your-admin-chat-id
TELEGRAM_CHANNEL_ID=@your-channel-name
TELEGRAM_CHAT_ID_1=additional-chat-id-1
TELEGRAM_CHAT_ID_2=additional-chat-id-2
```

### GitHub Actions Integration

```yaml
name: GitHub Telegram Notifications
on:
  push:
    branches: [ main ]

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22.14'
          
      - name: Install dependencies
        run: npm install
        
      - name: Send Telegram notification
        env:
          GITHUB_SHA: ${{ github.sha }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_ADMIN_CHAT_ID: ${{ secrets.TELEGRAM_ADMIN_CHAT_ID }}
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          GITHUB_TELEGRAM_BOT: "1"
        run: npx tsx lib/github-telegram-bot.ts
```

## 📋 API Reference

### `askGithubTelegramBot(options)`

Generates AI-powered commit notification message.

```typescript
interface GithubTelegramBotOptions {
  commitSha?: string;
  githubToken?: string;
  telegramBotToken?: string;
  telegramAdminChatId?: string;
  repositoryUrl?: string;
  enabled?: boolean | string | number;
}
```

**Returns**: `Promise<string>` - Generated Telegram message

### `handleGithubTelegramBot(options)`

Complete notification workflow with message generation and sending.

**Returns**: `Promise<{ success: boolean; message: string; chatsSent: number }>`

## 🎨 Message Format

The bot generates messages with this structure:

1. **Project Header**: Name and version with celebration
2. **Changes Description**: What was accomplished (commit message analysis)
3. **Strict Status Report**:
   - ✅ Tests PASSED! / ❌ Tests FAILED!
   - ✅ Build PASSED! / ❌ Build FAILED!
   - ✅ Deploy PASSED! / ❌ Deploy FAILED!
4. **Statistics**: Files changed, lines added/removed
5. **Links**: Repository and documentation
6. **Encouraging Conclusion**: Progress celebration

### Sample Message

```
🎉 hasyx v0.1.257 - новый прогресс! 🚀

✨ Обновлен GitHub Telegram Bot с улучшенным статус-репортингом!

📊 Результаты workflow:
✅ Тесты ПРОШЛИ! 🟢
❌ Сборка УПАЛА! 💪 (работаем над исправлением)
✅ Деплой ПРОШЁЛ! 🚀

📈 Изменения: 3 файла, +150/-25 строк

🔗 Репозиторий: https://github.com/ivansglazunov/hasyx.git
📚 Документация: https://hasyx.deep.foundation/

Каждый коммит - шаг к совершенству! 🌟
```

## ⚙️ Configuration

### Telegram Setup

1. Create bot via [@BotFather](https://t.me/botfather)
2. Get bot token
3. Add bot to your chats/channels
4. Get chat IDs using [@userinfobot](https://t.me/userinfobot)

### Multiple Recipients

Configure multiple recipients using environment variables:

```bash
TELEGRAM_ADMIN_CHAT_ID=123456789      # Admin notifications
TELEGRAM_CHANNEL_ID=@dev_channel      # Public channel
TELEGRAM_CHAT_ID_1=-100123456789      # Private group 1
TELEGRAM_CHAT_ID_2=-100987654321      # Private group 2
```

### AI Configuration

Set `OPENROUTER_API_KEY` for AI-generated messages. Without it, the bot will still work but messages may be less dynamic.

## 🔧 Troubleshooting

### Common Issues

**Bot not sending messages:**
- Check `GITHUB_TELEGRAM_BOT` is set to "1" or "2"
- Verify `TELEGRAM_BOT_TOKEN` is correct
- Ensure bot is added to target chats

**No workflow status:**
- Set `GITHUB_TOKEN` for authenticated GitHub API access
- Check repository has GitHub Actions workflows
- Verify `GITHUB_SHA` points to valid commit

**Rate limiting:**
- Add `GITHUB_TOKEN` for higher GitHub API limits
- Reduce notification frequency if needed

### Debug Mode

Enable verbose logging:

```bash
DEBUG=hasyx:github-telegram-bot npm test github-telegram-bot
```

## 📚 Integration Examples

### Custom Script

```typescript
import { handleGithubTelegramBot } from './lib/github-telegram-bot';

const result = await handleGithubTelegramBot({
  commitSha: 'abc123...',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  enabled: true
});

console.log(`Sent to ${result.chatsSent} chats`);
```

### Webhook Integration

```typescript
// Express.js webhook endpoint
app.post('/github-webhook', async (req, res) => {
  const { commits } = req.body;
  
  for (const commit of commits) {
    await handleGithubTelegramBot({
      commitSha: commit.id,
      enabled: process.env.GITHUB_TELEGRAM_BOT
    });
  }
  
  res.status(200).send('OK');
});
```

## 🔒 Security

- Never commit tokens to repository
- Use GitHub Secrets for sensitive data
- Limit bot permissions to necessary chats only
- Regularly rotate API tokens

## 🛠️ Development

### Running Tests

```bash
npm test github-telegram-bot
```

### Local Testing

```bash
# Set test environment
export GITHUB_SHA=test-commit-sha
export TELEGRAM_BOT_TOKEN=your-test-token
export GITHUB_TELEGRAM_BOT=1

# Run locally
npx tsx lib/github-telegram-bot.ts
```

## 📈 Monitoring

The bot provides detailed logging for monitoring:

- ✅ Message generation success/failure
- 📤 Delivery status per chat
- 🔍 GitHub API response status
- 📊 Workflow analysis results

## 🔄 Updates

When updating MD files in the repository, the bot automatically creates direct GitHub links:

Example: "Updated TELEGRAM_BOT.md" → Links to `https://github.com/ivansglazunov/hasyx/blob/main/lib/TELEGRAM_BOT.md`

---

## 🎯 Best Practices

1. **Enable for main branches only** to avoid spam
2. **Use descriptive commit messages** for better AI analysis
3. **Configure multiple recipients** for redundancy
4. **Monitor delivery success** through logs
5. **Keep tokens secure** and rotated regularly

---

*Made with ❤️ for the hasyx framework* 