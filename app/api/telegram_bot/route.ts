'use server';

import { NextRequest, NextResponse } from 'next/server';
import {
  TelegramUpdate,
  callTelegramApi,
  sendTelegramMessage
} from 'hasyx/lib/telegram-bot';
// No longer importing handleTelegramWebhook or TelegramWebhookProcessors
import { Hasyx } from 'hasyx/lib/hasyx';
import { createApolloClient } from 'hasyx/lib/apollo';
import { Generator } from 'hasyx/lib/generator';
import schema from 'hasyx/public/hasura-schema.json';
import Debug from 'hasyx/lib/debug';
import { ask as askAI } from 'hasyx/lib/ask'; // AI implementation

const debug = Debug('api:telegram_bot:route');

// --- Test Connection Function (simplified) ---
async function testTelegramConnection(req: NextRequest): Promise<NextResponse> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN is not set' }, { status: 500 });
  }
  try {
    const getMeResponse = await callTelegramApi(botToken, 'getMe', {});
    debug('getMe response:', getMeResponse);

    return NextResponse.json({
      message: 'Telegram connection test successful',
      botInfo: getMeResponse,
      envVars: {
        NEXT_PUBLIC_HASURA_GRAPHQL_URL: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL ? 'Set' : 'Not Set',
        HASURA_ADMIN_SECRET: process.env.HASURA_ADMIN_SECRET ? 'Set (Hidden)' : 'Not Set',
        TELEGRAM_BOT_TOKEN: botToken ? 'Set (Hidden)' : 'Not Set',
        TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME || 'Not Set (Optional)',
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ? 'Set (Hidden)' : 'Not Set (Required for AI)',
        TELEGRAM_AI_PREPROMPT: process.env.TELEGRAM_AI_PREPROMPT ? 'Set' : 'Not Set (Using default)',
      }
    });
  } catch (error: any) {
    debug('Test connection error:', error);
    console.error('Error in testTelegramConnection:', error);
    return NextResponse.json({ error: 'Failed to connect to Telegram API', details: error.message }, { status: 500 });
  }
}

// --- Route Handlers ---

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  if (url.searchParams.get('test') === 'true') {
    debug('POST /api/telegram_bot?test=true received, running test connection.');
    return testTelegramConnection(request);
  }
  
  debug('POST /api/telegram_bot request received');
  
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      debug('TELEGRAM_BOT_TOKEN not configured');
      return NextResponse.json({ error: 'Telegram Bot token not configured on server' }, { status: 500 });
    }

    const payload = (await request.json()) as TelegramUpdate;
    debug('Parsed payload update_id:', payload.update_id);

    // Initialize Hasyx client - only needed for /start handler
    const hasuraUrl = process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL;
    const hasuraSecret = process.env.HASURA_ADMIN_SECRET;

    if (!hasuraUrl || !hasuraSecret) {
      const errorMsg = "Critical: Hasura URL or Admin Secret not configured. Database operations will fail.";
        console.error(`❌ ${errorMsg}`);
        debug(errorMsg);
        return NextResponse.json({ error: "Backend services (database) not configured" }, { status: 500 });
    }
    
    const adminApolloClient = createApolloClient({ url: hasuraUrl, secret: hasuraSecret });
    const generator = Generator(schema as any);
    const hasyxClient = new Hasyx(adminApolloClient, generator);
    
    // --- DIRECT MESSAGE HANDLING ---
    if (!payload.message) {
      return NextResponse.json({ success: true, message: 'No message in payload, nothing to process' });
    }

    const message = payload.message;
    const chatId = message.chat.id;
    const userId = message.from?.id;
    const username = message.from?.username || message.from?.first_name || 'UnknownUser';
    const messageText = message.text;

    if (!userId) {
      debug('No user ID in message, cannot process.');
      return NextResponse.json({ success: false, message: 'User ID missing.' });
    }

    // Handle /start command - register user in notification_permissions
    if (messageText && messageText.trim().toLowerCase() === '/start') {
      debug(`Processing /start command from chat ID: ${chatId} for user: ${username} (${userId})`);
      try {
        const deviceInfo = {
          platform: 'telegram',
          username: username,
          firstName: message.from?.first_name,
          lastName: message.from?.last_name,
          userId: userId
        };

        await hasyxClient.insert({
          table: 'notification_permissions',
          object: {
            user_id: String(userId), 
            provider: 'telegram_bot',
            device_token: String(chatId), 
            device_info: deviceInfo,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        });
        debug('New telegram_bot permission created/updated for chat ID:', chatId);
        
        await sendTelegramMessage(botToken, chatId, `Hello ${username}! Your Chat ID for Hasyx is: ${chatId}\nSend any message to test AI responses.`);
        return NextResponse.json({ success: true, message: '/start command processed' });
      } catch (dbError) {
        debug('Error processing /start command (DB operation):', dbError);
        await sendTelegramMessage(botToken, chatId, 'Sorry, there was an error processing your /start command. Please try again later.');
        return NextResponse.json({ success: false, message: 'DB error during /start processing.' });
      }
    }
    
    // Handle normal messages with AI
    if (messageText) {
      debug(`Processing message from ${username} (Chat ID: ${chatId}): "${messageText}"`);
      
      // Call AI directly if configured
      if (process.env.OPENROUTER_API_KEY) {
        try {
          // Prepare AI prompt
          const prePrompt = process.env.TELEGRAM_AI_PREPROMPT || "You are a helpful assistant. Keep your answers concise.";
          const fullQuery = `${prePrompt}\n\nUser question: ${messageText}`;
          
          // Get AI response
          const aiResponse = await askAI(fullQuery, String(userId));
          
          if (!aiResponse) {
            debug('AI returned null or empty response');
            await sendTelegramMessage(botToken, chatId, "I'm sorry, I couldn't come up with a response for that.");
          } else {
            // Send AI response directly to user
            await sendTelegramMessage(botToken, chatId, aiResponse);
            debug('AI response sent to user in chat:', chatId);
          }
          
          return NextResponse.json({ success: true, message: 'AI response processed and sent to user' });
        } catch (aiError: any) {
          debug('Error getting AI response:', aiError);
          console.error('AI error:', aiError);
          await sendTelegramMessage(botToken, chatId, "I'm sorry, I encountered an error trying to process your request with AI.");
          return NextResponse.json({ success: false, message: 'AI error', error: aiError.message });
        }
      } else {
        debug('OPENROUTER_API_KEY not set, AI responses disabled');
        await sendTelegramMessage(botToken, chatId, "I'm sorry, but I'm not configured to use AI at the moment.");
        return NextResponse.json({ success: true, message: 'AI feature disabled, notification sent to user' });
      }
    }

    return NextResponse.json({ success: true, message: 'Message processed' });
  } catch (error: any) {
    debug('❌ Top-level error in POST handler:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error';
    console.error('❌ Critical error processing Telegram update in POST route:', errorMessage, error.stack);
    return NextResponse.json(
      { error: 'Failed to process Telegram update due to an unexpected server error.'},
      { status: 500 }
    );
  }
} 

export async function GET(request: NextRequest): Promise<NextResponse> {
  debug('GET /api/telegram_bot request received, running test connection...');
  return testTelegramConnection(request);
} 
