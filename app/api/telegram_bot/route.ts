import { NextResponse } from 'next/server';
import { handleStartEvent, TelegramUpdate, sendTelegramMessage } from 'hasyx/lib/telegram-bot';
import { defineTelegramAsk, getTelegramAskStats, initializeTelegramAsk } from 'hasyx/lib/ask-telegram';
import { Hasyx } from 'hasyx/lib/hasyx';
import { createApolloClient } from 'hasyx/lib/apollo'; // Standard Apollo client creation
import { Generator } from 'hasyx/lib/generator'; // Import Generator
import schema from 'hasyx/public/hasura-schema.json'; // Import schema
import Debug from 'hasyx/lib/debug';

const debug = Debug('api:telegram_bot');

// Initialize Telegram Ask system on module load (clears memory from previous container)
initializeTelegramAsk();

// Message deduplication cache (in-memory, could be Redis in production)
const processedMessages = new Map<string, number>();
const MESSAGE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function cleanupOldMessages() {
  const now = Date.now();
  for (const [key, timestamp] of processedMessages.entries()) {
    if (now - timestamp > MESSAGE_CACHE_TTL) {
      processedMessages.delete(key);
    }
  }
}

function isMessageAlreadyProcessed(userId: number, messageId: number, messageText?: string): boolean {
  const key = `${userId}_${messageId}`;
  const textKey = messageText ? `${userId}_${messageText.substring(0, 50)}` : null;
  
  // Check by message ID
  if (processedMessages.has(key)) {
    debug(`Message already processed: ${key}`);
    return true;
  }
  
  // Check by text content for extra safety
  if (textKey && processedMessages.has(textKey)) {
    debug(`Message content already processed: ${textKey}`);
    return true;
  }
  
  return false;
}

function markMessageAsProcessed(userId: number, messageId: number, messageText?: string): void {
  const now = Date.now();
  const key = `${userId}_${messageId}`;
  const textKey = messageText ? `${userId}_${messageText.substring(0, 50)}` : null;
  
  processedMessages.set(key, now);
  if (textKey) {
    processedMessages.set(textKey, now);
  }
  
  debug(`Marked message as processed: ${key}`);
}

export async function POST(request: Request) {
  debug('Received POST request to /api/telegram_bot');
  
  // Cleanup old messages periodically
  cleanupOldMessages();
  
  try {
    const payload = (await request.json()) as TelegramUpdate;
    debug('Parsed payload:', payload);

    if (!process?.env?.TELEGRAM_BOT_TOKEN) {
      console.error('TELEGRAM_BOT_TOKEN is not set on the server.');
      return NextResponse.json({ error: 'Telegram Bot not configured on server' }, { status: 500 });
    }
    if (!process?.env?.NEXT_PUBLIC_HASURA_GRAPHQL_URL || !process?.env?.HASURA_ADMIN_SECRET) {
      console.error('Hasura URL or Admin Secret not configured for Telegram bot handler.');
      return NextResponse.json({ error: 'Hasura not configured for bot' }, { status: 500 });
    }
    if (!process?.env?.OPENROUTER_API_KEY) {
      console.error('OPENROUTER_API_KEY is not set on the server.');
      return NextResponse.json({ error: 'OpenRouter API Key not configured on server' }, { status: 500 });
    }

    // Check for message deduplication
    if (payload.message && payload.message.from) {
      const userId = payload.message.from.id;
      const messageId = payload.message.message_id;
      const messageText = payload.message.text;
      
      if (isMessageAlreadyProcessed(userId, messageId, messageText)) {
        debug(`Skipping duplicate message from user ${userId}, message ${messageId}`);
        return NextResponse.json({ success: true, message: 'Duplicate message ignored' });
      }
      
      // Mark as processing to prevent race conditions
      markMessageAsProcessed(userId, messageId, messageText);
    }

    // Create an admin Hasyx client instance
    const adminApolloClient = createApolloClient({
      url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL,
      secret: process.env.HASURA_ADMIN_SECRET,
    });
    const generator = Generator(schema as any);
    const adminClient = new Hasyx(adminApolloClient, generator);

    const result: any = (await handleStartEvent(payload, adminClient)) as any;
    debug('handleStartEvent result:', result);

    // **КРИТИЧНО: Сразу возвращаем 200 OK в Telegram, чтобы предотвратить retry**
    const responsePromise = NextResponse.json(result);

    // Generate and send telegram response АСИНХРОННО
    if (result.success && result.chatId && result.userId && result.username) {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const openRouterToken = process.env.OPENROUTER_API_KEY;
      
      // Запускаем обработку асинхронно - не ждем результата
      setImmediate(async () => {
        try {
          if (payload.message?.text?.trim().toLowerCase() === '/start') {
            // Send response for /start command
            await sendTelegramMessage(
              botToken, 
              result.chatId, 
              `Hello ${result.username}! Your Chat ID for Hasyx is: ${result.chatId}\n\nI'm an AI assistant with code execution capabilities. Send me any question and I'll help you with real-time streaming responses!\n\n😈 Available features:\n• JavaScript/TypeScript execution\n• Terminal commands\n• Math calculations\n• General knowledge\n• Code examples and explanations\n\nJust type your question!`
            );
          } else if (payload.message?.text && payload.message.text.trim() !== '/start') {
            // Handle other text messages with AI
            try {
              // Отправляем статус обработки в Telegram
              await sendTelegramMessage(
                botToken,
                result.chatId,
                `🔄 Обрабатываю ваш запрос: "${payload.message.text.substring(0, 50)}${payload.message.text.length > 50 ? '...' : '"'}`
              );
              
              debug(`Processing AI question from user ${result.userId}: ${payload.message.text}`);
              
              // Get or create AI instance for this user
              const askInstance = defineTelegramAsk(
                result.userId,
                result.chatId,
                botToken,
                openRouterToken,
                process?.env?.npm_package_name || 'Hasyx Telegram Bot'
              );

              // Process the question with AI (responses will be sent automatically via Telegram)
              const response = await askInstance.ask(payload.message.text);
              
              debug(`AI processing completed for user ${result.userId}, response length: ${response.length}`);
              
              // Get current stats for monitoring and send to Telegram
              const stats = getTelegramAskStats();
              await sendTelegramMessage(
                botToken,
                result.chatId,
                `ℹ️ Статус: AI instances: ${stats.totalInstances}, Container: ${process.env.HOSTNAME || 'unknown'}`
              );
              
            } catch (aiError) {
              debug('Error processing AI question:', aiError);
              await sendTelegramMessage(
                botToken,
                result.chatId,
                `❌ Sorry, there was an error processing your question: ${aiError instanceof Error ? aiError.message : 'Unknown error'}\n\nPlease try again or send /start to restart.\n\n🔧 Debug info: Container ${process.env.HOSTNAME || 'unknown'}, Error: ${aiError instanceof Error ? aiError.stack : 'No stack'}`
              );
            }
          }
        } catch (asyncError) {
          debug('Error in async processing:', asyncError);
          // Last resort - try to send error to Telegram
          try {
            await sendTelegramMessage(
              botToken,
              result.chatId,
              `💥 Critical error in async processing: ${asyncError instanceof Error ? asyncError.message : 'Unknown error'}`
            );
          } catch (finalError) {
            console.error('Failed to send error message to Telegram:', finalError);
          }
        }
      });
    } else if (!result.success && result.chatId) {
      // Send error response асинхронно
      setImmediate(async () => {
        try {
          const botToken = process.env.TELEGRAM_BOT_TOKEN!;
          await sendTelegramMessage(
            botToken, 
            result.chatId, 
            `Sorry, there was an error processing your command. Please try again later.\n\n🔧 Debug: Container ${process.env.HOSTNAME || 'unknown'}`
          );
        } catch (error) {
          console.error('Failed to send error response:', error);
        }
      });
    }

    // Возвращаем ответ немедленно
    return responsePromise;
  } catch (error) {
    debug('Error in telegram_bot route:', error);
    console.error('❌ Error processing Telegram webhook:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 