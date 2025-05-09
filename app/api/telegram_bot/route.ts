import { NextResponse } from 'next/server';
import { processTelegramEvent, TelegramUpdate } from 'hasyx/lib/telegram-bot';
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

    const envVars = {
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
      TELEGRAM_ADMIN_CHAT_ID: process.env.TELEGRAM_ADMIN_CHAT_ID,
      NEXT_PUBLIC_HASURA_GRAPHQL_URL: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL,
      HASURA_ADMIN_SECRET: process.env.HASURA_ADMIN_SECRET,
    };

    if (!envVars.TELEGRAM_BOT_TOKEN) {
      console.error('TELEGRAM_BOT_TOKEN is not set on the server.');
      return NextResponse.json({ error: 'Telegram Bot not configured on server' }, { status: 500 });
    }
    if (!envVars.NEXT_PUBLIC_HASURA_GRAPHQL_URL || !envVars.HASURA_ADMIN_SECRET) {
      console.error('Hasura URL or Admin Secret not configured for Telegram bot handler.');
      return NextResponse.json({ error: 'Hasura not configured for bot' }, { status: 500 });
    }

    // Create an admin Hasyx client instance
    const adminApolloClient = createApolloClient({
      url: envVars.NEXT_PUBLIC_HASURA_GRAPHQL_URL,
      secret: envVars.HASURA_ADMIN_SECRET,
    });
    const generator = Generator(schema as any); // Cast schema to any if type issues arise with generator
    const adminClient = new Hasyx(adminApolloClient, generator);

    const result = await processTelegramEvent(payload, adminClient, envVars);
    debug('processTelegramEvent result:', result);

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