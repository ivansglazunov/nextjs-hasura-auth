'use server';

import { NextResponse } from 'next/server';
import { 
  processTelegramEvent, 
  TelegramUpdate, 
  sendTelegramMessage, 
  callTelegramApi
} from 'hasyx/lib/telegram-bot';
import { Hasyx } from 'hasyx/lib/hasyx';
import { createApolloClient } from 'hasyx/lib/apollo';
import { Generator } from 'hasyx/lib/generator';
import schema from 'hasyx/public/hasura-schema.json';
import Debug from 'hasyx/lib/debug';
import { ask as askAI } from 'hasyx/lib/ask'; // Import the new ask function

const debug = Debug('api:telegram_bot');

// Helper function to ensure a topic exists for a user
async function ensureTopicExists(botToken: string, groupChatId: string, userId: number, username: string): Promise<number | null> {
  try {
    const topicTitle = `${username}_${userId}`;
    debug(`Ensuring topic exists for user ${username} (ID: ${userId}) in group ${groupChatId}`);
    
    // Try to find existing topic
    const getTopicsResponse = await callTelegramApi(botToken, 'getForumTopicsByChat', {
      chat_id: groupChatId
    });
    
    // Check if a topic for this user already exists
    const topics = getTopicsResponse.topics || [];
    const existingTopic = topics.find((topic: any) => 
      topic.name === topicTitle || 
      topic.name.includes(`${userId}`)
    );
    
    if (existingTopic) {
      debug(`Found existing topic for user ${username}: ${existingTopic.message_thread_id}`);
      return existingTopic.message_thread_id;
    }
    
    // Create a new topic if none exists
    const createTopicResponse = await callTelegramApi(botToken, 'createForumTopic', {
      chat_id: groupChatId,
      name: topicTitle
    });
    
    debug(`Created new topic for user ${username}: ${createTopicResponse.message_thread_id}`);
    return createTopicResponse.message_thread_id;
  } catch (error) {
    debug('Error ensuring topic exists:', error);
    console.error(`❌ Failed to ensure topic exists for user ${username}:`, error);
    return null;
  }
}

// Helper function to get userId from topic title
function getUserIdFromTopicTitle(topicTitle: string): number | null {
  // Extract userId from format "username_userId" or similar
  const match = topicTitle.match(/_(\d+)$/);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return null;
}

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
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    };

    if (!envVars.TELEGRAM_BOT_TOKEN) {
      console.error('TELEGRAM_BOT_TOKEN is not set on the server.');
      return NextResponse.json({ error: 'Telegram Bot not configured on server' }, { status: 500 });
    }
    if (!envVars.NEXT_PUBLIC_HASURA_GRAPHQL_URL || !envVars.HASURA_ADMIN_SECRET) {
      console.error('Hasura URL or Admin Secret not configured for Telegram bot handler.');
      return NextResponse.json({ error: 'Hasura not configured for bot' }, { status: 500 });
    }
    if (!envVars.OPENROUTER_API_KEY) {
      console.warn('⚠️ OPENROUTER_API_KEY is not explicitly checked here, but lib/ask.ts will need it.');
    }

    const adminApolloClient = createApolloClient({
      url: envVars.NEXT_PUBLIC_HASURA_GRAPHQL_URL,
      secret: envVars.HASURA_ADMIN_SECRET,
    });
    const generator = Generator(schema as any);
    const adminClient = new Hasyx(adminApolloClient, generator);

    // Handle message in topic from admin group
    if (
      payload.message && 
      payload.message.message_thread_id &&
      envVars.TELEGRAM_ADMIN_CHAT_ID &&
      String(payload.message.chat.id) === envVars.TELEGRAM_ADMIN_CHAT_ID &&
      payload.message.from &&
      !payload.message.from.is_bot
    ) {
      debug('Detected message in a topic from admin group');
      
      // Get topic info to extract the user ID
      try {
        const topicInfo = await callTelegramApi(envVars.TELEGRAM_BOT_TOKEN, 'getForumTopicByMessageThreadId', {
          chat_id: envVars.TELEGRAM_ADMIN_CHAT_ID,
          message_thread_id: payload.message.message_thread_id
        });
        
        const userId = getUserIdFromTopicTitle(topicInfo.name);
        if (userId) {
          debug(`Forwarding message from admin group topic to user ${userId}`);
          await sendTelegramMessage(
            envVars.TELEGRAM_BOT_TOKEN, 
            userId, 
            `Admin reply: ${payload.message.text || "Attachment or unsupported message type"}`
          );
          return NextResponse.json({ success: true, message: 'Message from admin group topic forwarded to user' });
        } else {
          debug('Could not extract user ID from topic name:', topicInfo.name);
        }
      } catch (error) {
        debug('Error handling message in topic:', error);
      }
    }

    const result = await processTelegramEvent(payload, adminClient, envVars);
    debug('processTelegramEvent result:', result);

    // Handle messages requiring AI response
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
      const username = payload.message.from.username || payload.message.from.first_name || 'UnknownUser';
      
      // Get AI response
      const aiResponseText = await askAI(payload.message.text, userId);
      
      // Send response to user
      await sendTelegramMessage(envVars.TELEGRAM_BOT_TOKEN, chatId, aiResponseText);
      debug('AI response sent to user:', chatId);
      
      // Also send to admin group if configured (with topic)
      if (envVars.TELEGRAM_ADMIN_CHAT_ID && String(chatId) !== envVars.TELEGRAM_ADMIN_CHAT_ID) {
        try {
          // Ensure topic exists
          const threadId = await ensureTopicExists(
            envVars.TELEGRAM_BOT_TOKEN,
            envVars.TELEGRAM_ADMIN_CHAT_ID,
            payload.message.from.id,
            username
          );
          
          if (threadId) {
            // Forward user message if not already forwarded by processTelegramEvent
            await sendTelegramMessage(
              envVars.TELEGRAM_BOT_TOKEN,
              envVars.TELEGRAM_ADMIN_CHAT_ID,
              `Message from: ${username} (${payload.message.from.id}):\n\n${payload.message.text}`,
              undefined,
              threadId
            );
            
            // Forward AI response to the same topic
            await sendTelegramMessage(
              envVars.TELEGRAM_BOT_TOKEN,
              envVars.TELEGRAM_ADMIN_CHAT_ID,
              `AI response to ${username}:\n\n${aiResponseText}`,
              undefined,
              threadId
            );
            debug(`User message and AI response forwarded to admin group topic ${threadId}`);
          }
        } catch (error) {
          debug('Error forwarding to admin group:', error);
        }
      }
      
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