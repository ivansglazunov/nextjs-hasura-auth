import { NextResponse } from 'next/server';
import { processTelegramEvent, TelegramUpdate, sendTelegramMessage } from 'hasyx/lib/telegram-bot';
import { Hasyx } from 'hasyx/lib/hasyx';
import { createApolloClient } from 'hasyx/lib/apollo';
import { Generator } from 'hasyx/lib/generator';
import schema from 'hasyx/public/hasura-schema.json';
import Debug from 'hasyx/lib/debug';
import { ask as askAI } from 'hasyx/lib/ask'; // Import the new ask function

const debug = Debug('api:telegram_bot');

export async function POST(request: Request) {
  debug('Received POST request to /api/telegram_bot');
  try {
    const payload = (await request.json()) as TelegramUpdate;
    debug('Parsed payload:', payload);

    const envVars = {
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
      TELEGRAM_ADMIN_CHAT_ID: process.env.TELEGRAM_ADMIN_CHAT_ID,
      NEXT_PUBLIC_HASURA_GRAPHQL_URL: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL,
      HASURA_ADMIN_SECRET: process.env.HASURA_ADMIN_SECRET,
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY, // Ensure this is available for lib/ask.ts if it re-checks env
    };

    if (!envVars.TELEGRAM_BOT_TOKEN) {
      console.error('TELEGRAM_BOT_TOKEN is not set on the server.');
      return NextResponse.json({ error: 'Telegram Bot not configured on server' }, { status: 500 });
    }
    if (!envVars.NEXT_PUBLIC_HASURA_GRAPHQL_URL || !envVars.HASURA_ADMIN_SECRET) {
      console.error('Hasura URL or Admin Secret not configured for Telegram bot handler.');
      return NextResponse.json({ error: 'Hasura not configured for bot' }, { status: 500 });
    }
    // Check for OPENROUTER_API_KEY moved to lib/ask.ts, but good to be aware if it's needed by the time askAI is called.
    if (!envVars.OPENROUTER_API_KEY) {
      console.warn('⚠️ OPENROUTER_API_KEY is not explicitly checked here, but lib/ask.ts will need it.');
      // Depending on lib/ask.ts behavior, you might want to return an error if it's critical for this endpoint
      // For now, assuming lib/ask.ts handles fallback or error state.
    }

    const adminApolloClient = createApolloClient({
      url: envVars.NEXT_PUBLIC_HASURA_GRAPHQL_URL,
      secret: envVars.HASURA_ADMIN_SECRET,
    });
    const generator = Generator(schema as any);
    const adminClient = new Hasyx(adminApolloClient, generator);

    const result = await processTelegramEvent(payload, adminClient, envVars);
    debug('processTelegramEvent result:', result);

    if (
      payload.message &&
      payload.message.text &&
      payload.message.from && payload.message.from.id &&
      !payload.message.from.is_bot &&
      (
        result.message === 'Text message received, no specific action taken by core processor.' ||
        result.message === 'Event received, no specific action taken for this update type.'
      ) && envVars.TELEGRAM_BOT_TOKEN
    ) {
      debug(`Message from ${payload.message.from.username || payload.message.from.first_name} requires AI response.`);
      const userId = String(payload.message.from.id);
      const chatId = payload.message.chat.id;
      
      // Use the imported askAI function from lib/ask.ts
      const aiResponseText = await askAI(payload.message.text, userId);
      
      await sendTelegramMessage(envVars.TELEGRAM_BOT_TOKEN, chatId, aiResponseText);
      debug('AI response sent to user:', chatId);
      return NextResponse.json({ success: true, message: 'AI response processed and sent.' });
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