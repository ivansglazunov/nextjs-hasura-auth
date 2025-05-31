import { NextResponse } from 'next/server';
import { handleStartEvent, TelegramUpdate, sendTelegramMessage } from 'hasyx/lib/telegram-bot';
import { defineTelegramAsk, getTelegramAskStats } from 'hasyx/lib/ask-telegram';
import { Hasyx } from 'hasyx/lib/hasyx';
import { createApolloClient } from 'hasyx/lib/apollo'; // Standard Apollo client creation
import { Generator } from 'hasyx/lib/generator'; // Import Generator
import schema from 'hasyx/public/hasura-schema.json'; // Import schema
import Debug from 'hasyx/lib/debug';

const debug = Debug('api:telegram_bot');

export async function POST(request: Request) {
  debug('Received POST request to /api/telegram_bot');
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

    // Create an admin Hasyx client instance
    const adminApolloClient = createApolloClient({
      url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL,
      secret: process.env.HASURA_ADMIN_SECRET,
    });
    const generator = Generator(schema as any); // Cast schema to any if type issues arise with generator
    const adminClient = new Hasyx(adminApolloClient, generator);

    const result = await handleStartEvent(payload, adminClient);
    debug('handleStartEvent result:', result);

    // Generate and send telegram response based on result
    if (result.success && result.chatId && result.userId && result.username) {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const openRouterToken = process.env.OPENROUTER_API_KEY;
      
      if (payload.message?.text?.trim().toLowerCase() === '/start') {
        // Send response for /start command
        await sendTelegramMessage(
          botToken, 
          result.chatId, 
          `Hello ${result.username}! Your Chat ID for Hasyx is: ${result.chatId}\n\nI'm an AI assistant with code execution capabilities. Send me any question and I'll help you with real-time streaming responses!\n\n🪬 Available features:\n• JavaScript/TypeScript execution\n• Terminal commands\n• Math calculations\n• General knowledge\n• Code examples and explanations\n\nJust type your question!`
        );
      } else if (payload.message?.text) {
        // Handle other text messages with AI
        try {
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
          
          // Get current stats for monitoring
          const stats = getTelegramAskStats();
          debug(`Current AI instances: ${stats.totalInstances}`);
          
        } catch (aiError) {
          debug('Error processing AI question:', aiError);
          await sendTelegramMessage(
            botToken,
            result.chatId,
            `❌ Sorry, there was an error processing your question: ${aiError instanceof Error ? aiError.message : 'Unknown error'}\n\nPlease try again or send /start to restart.`
          );
        }
      }
    } else if (!result.success && result.chatId) {
      // Send error response
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      await sendTelegramMessage(
        botToken, 
        result.chatId, 
        'Sorry, there was an error processing your command. Please try again later.'
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    debug('Error in /api/telegram_bot POST handler:', error);
    console.error('Error processing Telegram update:', error);
    return NextResponse.json(
      { error: 'Failed to process Telegram update', details: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    );
  }
} 