'use server';

import { NextRequest, NextResponse } from 'next/server';
import {
  TelegramUpdate,
  callTelegramApi, // Used for testTelegramConnection
  sendTelegramMessage // Used by defaultMirrorToAdminGroup
} from 'hasyx/lib/telegram-bot';
import {
  handleTelegramWebhook,
  TelegramWebhookProcessors
} from 'hasyx/lib/telegram-handler';
import {
  ensureTopicExists // Used by defaultMirrorToAdminGroup
} from 'hasyx/lib/telegram-group';
import { Hasyx } from 'hasyx/lib/hasyx';
import { createApolloClient } from 'hasyx/lib/apollo';
import { Generator } from 'hasyx/lib/generator';
import schema from 'hasyx/public/hasura-schema.json';
import Debug from 'hasyx/lib/debug';
import { ask as defaultAskAI } from 'hasyx/lib/ask'; // Default AI implementation

const debug = Debug('api:telegram_bot:route');

// --- Test Connection Function (remains for diagnostic purposes) ---
async function testTelegramConnection(req: NextRequest): Promise<NextResponse> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN is not set' }, { status: 500 });
  }
  try {
    const getMeResponse = await callTelegramApi(botToken, 'getMe', {});
    debug('getMe response:', getMeResponse);

    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    let adminGroupInfo: any = null; // Changed to any to allow error object assignment
    if (adminChatId) {
      try {
        adminGroupInfo = await callTelegramApi(botToken, 'getChat', { chat_id: adminChatId });
        debug('getChat (admin) response:', adminGroupInfo);
      } catch (chatError: any) {
        debug('Error fetching admin chat info:', chatError.message);
        adminGroupInfo = { error: 'Failed to fetch admin chat info', details: chatError.message };
      }
    }

    return NextResponse.json({
      message: 'Telegram connection test successful',
      botInfo: getMeResponse,
      adminGroupInfo: adminGroupInfo,
      envVars: {
        NEXT_PUBLIC_HASURA_GRAPHQL_URL: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL ? 'Set' : 'Not Set',
        HASURA_ADMIN_SECRET: process.env.HASURA_ADMIN_SECRET ? 'Set (Hidden)' : 'Not Set',
        TELEGRAM_BOT_TOKEN: botToken ? 'Set (Hidden)' : 'Not Set',
        TELEGRAM_ADMIN_CHAT_ID: adminChatId || 'Not Set',
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

// --- Default Processors (can be customized or commented out in child projects) ---

/**
 * Default processor for mirroring messages to the admin group.
 * Creates a topic per user if it doesn't exist.
 */
async function defaultMirrorToAdminGroup(
  payload: TelegramUpdate,
  botToken: string,
  adminChatId: string,
  userMessageText: string,
  aiResponseText?: string
): Promise<void> {
  if (!payload.message || !payload.message.from) {
    debug('DefaultMirror: Aborting, missing message or from field in payload.');
    return;
  }

  const userTelegramId = payload.message.from.id;
  const userChatId = payload.message.chat.id; // This is user's private chat with the bot
  const username = payload.message.from.username || payload.message.from.first_name || 'UnknownUser';

  debug(`DefaultMirror: Attempting to mirror for user ${username} (ID: ${userTelegramId}) to admin group ${adminChatId}`);
  
  try {
    const topicThreadId = await ensureTopicExists(
      botToken,
      adminChatId,
      userTelegramId,
      username
    );

    if (topicThreadId) {
      const userMessagePrefix = `🧑 Message from: ${username} (User ID: ${userTelegramId}, Chat ID: ${userChatId}):\n\n`;
      await sendTelegramMessage(
        botToken,
        adminChatId,
        `${userMessagePrefix}${userMessageText}`,
        undefined, // parse_mode
        topicThreadId
      );
      debug(`DefaultMirror: Mirrored user message to admin group topic ${topicThreadId}`);

      if (aiResponseText) {
        const aiResponsePrefix = `🤖 AI response to ${username} (User ID: ${userTelegramId}):\n\n`;
        await sendTelegramMessage(
          botToken,
          adminChatId,
          `${aiResponsePrefix}${aiResponseText}`,
          undefined, // parse_mode
          topicThreadId
        );
        debug(`DefaultMirror: Mirrored AI response to admin group topic ${topicThreadId}`);
      }
    } else {
      debug('DefaultMirror: Failed to ensure topic. Fallback: sending combined message to admin group main chat.');
      let combinedMessage = `[No Topic / Error] User: ${username} (ID: ${userTelegramId}):\n${userMessageText}`;
      if (aiResponseText) {
          combinedMessage += `\n\nAI Response:\n${aiResponseText}`;
      }
      await sendTelegramMessage(botToken, adminChatId, combinedMessage);
    }
  } catch (error: any) {
    debug('DefaultMirror: Error during mirroring process:', error.message);
    console.error('Error in defaultMirrorToAdminGroup:', error);
    // Optionally send a non-topic message to admin group as a last resort for the user's message
    await sendTelegramMessage(botToken, adminChatId, `[Mirroring Error] User: ${username}: ${userMessageText}. Check logs.`);
  }
}

/**
 * Default processor for getting an AI response.
 * Uses the default `askAI` function from `lib/ask.ts`.
 */
async function defaultGetAiResponse(
  userMessageText: string,
  userId: string // Telegram User ID
): Promise<string | null> {
  // --- THIS IS WHERE THE PRE-PROMPT CAN BE CUSTOMIZED PER PROJECT ---
  const prePrompt = process.env.TELEGRAM_AI_PREPROMPT || "You are a helpful assistant. Keep your answers concise.";
  const fullQuery = `${prePrompt}\n\nUser question: ${userMessageText}`;
  
  debug(`DefaultGetAiResponse: Querying AI for user ${userId} with pre-prompt.`);
  
  if (!process.env.OPENROUTER_API_KEY) {
    debug('DefaultGetAiResponse: OPENROUTER_API_KEY is not set. AI functionality disabled.');
    console.warn('OPENROUTER_API_KEY is not set. AI responses will not be generated.');
    return "I'm sorry, but I'm not configured to use AI at the moment."; // User-facing message
  }

  try {
    const aiResponse = await defaultAskAI(fullQuery, userId);
    if (!aiResponse) {
        debug('DefaultGetAiResponse: AI returned null or empty response.');
        return "I'm sorry, I couldn't come up with a response for that.";
    }
    return aiResponse;
  } catch (e: any) {
    debug("DefaultGetAiResponse: Error calling AI:", e.message);
    console.error('Error in defaultGetAiResponse (calling defaultAskAI):', e);
    return "I'm sorry, I encountered an error trying to process your request with AI."; // Fallback AI response
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
    const payload = (await request.json()) as TelegramUpdate;
    debug('Parsed payload update_id:', payload.update_id);

    // Initialize Hasyx client
    const hasuraUrl = process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL;
    const hasuraSecret = process.env.HASURA_ADMIN_SECRET;

    if (!hasuraUrl || !hasuraSecret) {
        const errorMsg = "Critical: Hasura URL or Admin Secret not configured. Hasyx client cannot be initialized.";
        console.error(`❌ ${errorMsg}`);
        debug(errorMsg);
        return NextResponse.json({ error: "Backend services (database) not configured" }, { status: 500 });
    }
    
    const adminApolloClient = createApolloClient({ url: hasuraUrl, secret: hasuraSecret });
    const generator = Generator(schema as any);
    const hasyxClient = new Hasyx(adminApolloClient, generator);
    
    // --- CONFIGURE PROCESSORS FOR THIS PROJECT ---
    // To disable a feature, comment out its line or set the processor to undefined.
    const processors: TelegramWebhookProcessors = {
       mirrorToAdminGroup: process.env.TELEGRAM_ADMIN_CHAT_ID ? defaultMirrorToAdminGroup : undefined, // Only enable if admin chat ID is set
       getAiResponse: process.env.OPENROUTER_API_KEY ? defaultGetAiResponse : undefined,             // Only enable if AI key is set
    };
    
    // Pass all environment variables. The handler will pick what it needs.
    // process.env is a plain object and serializable for Next.js edge/serverless functions.
    return await handleTelegramWebhook(payload, hasyxClient, process.env, processors);

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
