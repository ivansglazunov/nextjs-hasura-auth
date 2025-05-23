import { NextRequest, NextResponse } from 'next/server';
import { 
  TelegramBot,
  TelegramUpdate,
  sendTelegramMessage
} from './telegram-bot';
import { Hasyx } from './hasyx';
import { createApolloClient } from './apollo';
import { Generator } from './generator';
import schema from '../public/hasura-schema.json';
import Debug from './debug';

const debug = Debug('telegram:handler');

/**
 * Handler for Telegram Bot webhook requests
 * 
 * @param request The NextRequest object
 * @param messageHandler Optional callback to handle messages (can be used to customize responses)
 * @returns NextResponse with operation result
 */
export async function handleTelegramBot(
  request: NextRequest,
  messageHandler?: (context: { 
    bot: TelegramBot, 
    chat: ReturnType<TelegramBot['chat']>,
    message: TelegramUpdate['message'],
    username: string,
    userId: number 
  }) => Promise<any>
): Promise<NextResponse> {
  const url = new URL(request.url);
  
  // Test connection if requested
  if (url.searchParams.get('test') === 'true') {
    return await testTelegramConnection(request);
  }
  
  debug('Processing Telegram webhook request');
  
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      debug('TELEGRAM_BOT_TOKEN not configured');
      return NextResponse.json({ error: 'Telegram Bot token not configured on server' }, { status: 500 });
    }

    const bot = new TelegramBot(botToken);
    const payload = (await request.json()) as TelegramUpdate;
    debug('Parsed payload update_id:', payload.update_id);

    // Initialize Hasyx client for DB operations
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
    
    // --- MESSAGE HANDLING ---
    if (!payload.message) {
      return NextResponse.json({ success: true, message: 'No message in payload, nothing to process' });
    }

    const message = payload.message;
    const chatId = message.chat.id;
    const userId = message.from?.id;
    const username = message.from?.username || message.from?.first_name || 'UnknownUser';
    const messageText = message.text;
    const chat = bot.chat(chatId);

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
            created_at: new Date().valueOf(),
            updated_at: new Date().valueOf(),
          }
        });
        debug('New telegram_bot permission created/updated for chat ID:', chatId);
        
        await chat.sendMessage(`Hello ${username}! Your Chat ID for Hasyx is: ${chatId}\nYou are now registered to receive notifications.`);
        return NextResponse.json({ success: true, message: '/start command processed' });
      } catch (dbError) {
        debug('Error processing /start command (DB operation):', dbError);
        await chat.sendMessage('Sorry, there was an error processing your /start command. Please try again later.');
        return NextResponse.json({ success: false, message: 'DB error during /start processing.' });
      }
    }
    
    // Handle messages with custom handler if provided
    if (messageText && messageHandler) {
      debug(`Processing message from ${username} (Chat ID: ${chatId}): "${messageText}"`);
      try {
        await messageHandler({ 
          bot, 
          chat,
          message,
          username,
          userId
        });
        return NextResponse.json({ success: true, message: 'Message processed by custom handler' });
      } catch (error: any) {
        debug('Error in custom message handler:', error);
        console.error('❌ Custom message handler error:', error);
        await chat.sendMessage("Sorry, I encountered an error processing your message.");
        return NextResponse.json({ success: false, message: 'Custom handler error', error: error.message });
      }
    } else if (messageText) {
      // Default message handling if no custom handler provided
      debug(`Received message from ${username}, but no custom handler provided`);
      await chat.sendMessage("I received your message, but I'm not configured to respond to it yet.");
      return NextResponse.json({ success: true, message: 'Default message handler used' });
    }

    return NextResponse.json({ success: true, message: 'Message processed' });
  } catch (error: any) {
    debug('❌ Top-level error in handleTelegramBot:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error';
    console.error('❌ Critical error processing Telegram update:', errorMessage, error.stack);
    return NextResponse.json(
      { error: 'Failed to process Telegram update due to an unexpected server error.'},
      { status: 500 }
    );
  }
}

/**
 * Test the Telegram connection by calling getMe
 */
async function testTelegramConnection(req: NextRequest): Promise<NextResponse> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN is not set' }, { status: 500 });
  }
  try {
    const bot = new TelegramBot(botToken);
    const getMeResponse = await bot.getMe();
    debug('getMe response:', getMeResponse);

    return NextResponse.json({
      message: 'Telegram connection test successful',
      botInfo: getMeResponse,
      envVars: {
        NEXT_PUBLIC_HASURA_GRAPHQL_URL: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL ? 'Set' : 'Not Set',
        HASURA_ADMIN_SECRET: process.env.HASURA_ADMIN_SECRET ? 'Set (Hidden)' : 'Not Set',
        TELEGRAM_BOT_TOKEN: botToken ? 'Set (Hidden)' : 'Not Set',
        TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME || 'Not Set (Optional)',
      }
    });
  } catch (error: any) {
    debug('Test connection error:', error);
    console.error('Error in testTelegramConnection:', error);
    return NextResponse.json({ error: 'Failed to connect to Telegram API', details: error.message }, { status: 500 });
  }
} 