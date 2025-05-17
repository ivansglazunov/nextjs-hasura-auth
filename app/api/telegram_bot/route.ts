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
    debug(`1. Ensuring topic exists for user ${username} (ID: ${userId}) in group ${groupChatId}`);
    
    // First, check if the group is a forum
    try {
      const chatInfo = await callTelegramApi(botToken, 'getChat', {
        chat_id: groupChatId
      });
      debug('2. Chat info:', JSON.stringify(chatInfo, null, 2));
      
      if (chatInfo.is_forum !== true) {
        debug('❌ ERROR: This group is not a forum! Topics are not enabled.');
        console.error(`❌ Telegram group ${groupChatId} is not a forum. Please enable topics in group settings.`);
        return null;
      }
      
      debug('3. Group is a forum, proceeding with topic creation/search');
    } catch (error) {
      debug('❌ Error getting chat info:', error);
      console.error(`❌ Failed to get chat info for ${groupChatId}:`, error);
      return null;
    }
    
    // Try to create a topic directly - if it exists with same name, Telegram returns the existing one
    try {
      debug('4. Attempting to create forum topic');
      const createTopicResponse = await callTelegramApi(botToken, 'createForumTopic', {
        chat_id: groupChatId,
        name: topicTitle
      });
      
      debug(`5. Created/found topic: ${createTopicResponse.message_thread_id}`);
      return createTopicResponse.message_thread_id;
    } catch (createError: any) {
      // If topic already exists, Telegram might return an error
      debug('❌ Error creating topic:', createError);
      
      if (createError.message && createError.message.includes('already exist')) {
        debug('6. Topic already exists, trying to find it');
        
        // Alternative approach - get forum topics
        try {
          // Note: This API call may require the beta API or might not be available
          // See: https://core.telegram.org/bots/api#getforumtopicsbychat
          const getTopicsResponse = await callTelegramApi(botToken, 'getForumTopicsByChat', {
            chat_id: groupChatId
          });
          
          debug('7. Got forum topics list');
          const topics = getTopicsResponse.topics || [];
          const existingTopic = topics.find((topic: any) => 
            topic.name === topicTitle || 
            topic.name.includes(`${userId}`)
          );
          
          if (existingTopic) {
            debug(`8. Found existing topic: ${existingTopic.message_thread_id}`);
            return existingTopic.message_thread_id;
          }
        } catch (listError) {
          debug('❌ Error listing topics:', listError);
        }
      }
      
      console.error(`❌ Failed to create/find topic for user ${username}:`, createError);
      return null;
    }
  } catch (error) {
    debug('❌ General error in ensureTopicExists:', error);
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

// Helper function to check if a chat is a forum
async function isChatForum(botToken: string, chatId: string): Promise<{ isForum: boolean; error?: string }> {
  try {
    const chatInfo = await callTelegramApi(botToken, 'getChat', { chat_id: chatId });
    return { isForum: chatInfo.is_forum === true };
  } catch (error) {
    return { 
      isForum: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Helper function to test Telegram bot connection
export async function testTelegramConnection(req: Request): Promise<Response> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  
  if (!botToken) {
    return Response.json({ success: false, error: 'TELEGRAM_BOT_TOKEN not set' });
  }
  
  const results: Record<string, any> = {};
  
  try {
    // Test 1: Get bot info
    results.botInfo = await callTelegramApi(botToken, 'getMe', {});
    
    // Test 2: Check admin chat if set
    if (adminChatId) {
      try {
        results.adminChatInfo = await callTelegramApi(botToken, 'getChat', { chat_id: adminChatId });
        
        // Check if bot is admin
        const botId = results.botInfo.id;
        const memberInfo = await callTelegramApi(botToken, 'getChatMember', {
          chat_id: adminChatId,
          user_id: botId
        });
        
        results.botStatusInAdminChat = memberInfo.status;
        results.botPermissions = memberInfo;
        
        // Check if forum
        results.isAdminChatForum = results.adminChatInfo.is_forum === true;
        
        if (!results.isAdminChatForum) {
          results.forumWarning = 'Admin chat is not a forum. Topics cannot be created. Enable forum in group settings.';
        }
        
        // Try sending a test message
        try {
          const testMessage = await callTelegramApi(botToken, 'sendMessage', {
            chat_id: adminChatId,
            text: 'API test message. This is a diagnostic message to verify bot permissions.'
          });
          results.testMessageSent = true;
          results.testMessageId = testMessage.message_id;
        } catch (msgError) {
          results.testMessageSent = false;
          results.testMessageError = msgError instanceof Error ? msgError.message : String(msgError);
        }
        
      } catch (chatError) {
        results.adminChatInfo = null;
        results.adminChatError = chatError instanceof Error ? chatError.message : String(chatError);
      }
    } else {
      results.adminChatInfo = null;
      results.adminChatError = 'TELEGRAM_ADMIN_CHAT_ID not set';
    }
    
    return Response.json({
      success: true,
      results
    });
    
  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      results
    });
  }
}

export async function POST(request: Request) {
  // Check if it's a diagnostic request
  const url = new URL(request.url);
  if (url.searchParams.get('test') === 'true') {
    return testTelegramConnection(request);
  }
  
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
    
    // Check TELEGRAM_ADMIN_CHAT_ID format
    if (envVars.TELEGRAM_ADMIN_CHAT_ID) {
      debug(`TELEGRAM_ADMIN_CHAT_ID: ${envVars.TELEGRAM_ADMIN_CHAT_ID}`);
      // Validate the format
      if (!envVars.TELEGRAM_ADMIN_CHAT_ID.startsWith('-100') && !envVars.TELEGRAM_ADMIN_CHAT_ID.startsWith('@')) {
        console.warn(`⚠️ TELEGRAM_ADMIN_CHAT_ID format looks incorrect: ${envVars.TELEGRAM_ADMIN_CHAT_ID}`);
        console.warn('For supergroups, it should start with "-100" followed by digits.');
        console.warn('For public groups, it can start with "@" followed by username.');
        debug('WARNING: TELEGRAM_ADMIN_CHAT_ID format may be incorrect');
      }
    } else {
      debug('TELEGRAM_ADMIN_CHAT_ID is not set. Messages will not be forwarded to an admin group.');
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
          debug(`Attempting to forward messages to admin group: ${envVars.TELEGRAM_ADMIN_CHAT_ID}`);
          
          // First, verify the admin chat exists and bot has access to it
          try {
            const adminChatInfo = await callTelegramApi(envVars.TELEGRAM_BOT_TOKEN, 'getChat', {
              chat_id: envVars.TELEGRAM_ADMIN_CHAT_ID
            });
            debug(`Admin chat exists: ${adminChatInfo.title || adminChatInfo.username || adminChatInfo.id}`);
            
            // Check if bot is admin in this chat
            const botMember = await callTelegramApi(envVars.TELEGRAM_BOT_TOKEN, 'getChatMember', {
              chat_id: envVars.TELEGRAM_ADMIN_CHAT_ID,
              user_id: (await callTelegramApi(envVars.TELEGRAM_BOT_TOKEN, 'getMe', {})).id
            });
            
            debug(`Bot's status in admin group: ${botMember.status}`);
            const isAdmin = botMember.status === 'administrator' || botMember.status === 'creator';
            
            if (!isAdmin) {
              debug(`❌ WARNING: Bot is not an administrator in admin group. Status: ${botMember.status}`);
              console.warn(`⚠️ Bot is not an administrator in Telegram admin group ${envVars.TELEGRAM_ADMIN_CHAT_ID}. Topic creation will fail.`);
            }
            
            // Check if required permissions are available (if bot is admin)
            if (isAdmin && botMember.can_manage_topics !== true) {
              debug('❌ WARNING: Bot does not have "can_manage_topics" permission');
              console.warn('⚠️ Bot does not have permission to manage topics in the admin group. Please update bot permissions.');
            }
          } catch (chatCheckError) {
            debug('❌ Error checking admin chat:', chatCheckError);
            console.error('❌ Failed to verify admin chat:', chatCheckError);
            // Continue anyway to see what other errors we might get
          }
          
          // Ensure topic exists
          const threadId = await ensureTopicExists(
            envVars.TELEGRAM_BOT_TOKEN,
            envVars.TELEGRAM_ADMIN_CHAT_ID,
            payload.message.from.id,
            username
          );
          
          if (threadId) {
            debug(`Using thread ID ${threadId} for forwarding`);
            
            // Forward user message if not already forwarded by processTelegramEvent
            try {
              await sendTelegramMessage(
                envVars.TELEGRAM_BOT_TOKEN,
                envVars.TELEGRAM_ADMIN_CHAT_ID,
                `Message from: ${username} (${payload.message.from.id}):\n\n${payload.message.text}`,
                undefined,
                threadId
              );
              debug('Successfully forwarded user message to admin group');
            } catch (userMsgError) {
              debug('❌ Error forwarding user message to admin group:', userMsgError);
              console.error('❌ Failed to forward user message to admin group:', userMsgError);
            }
            
            // Forward AI response to the same topic
            try {
              await sendTelegramMessage(
                envVars.TELEGRAM_BOT_TOKEN,
                envVars.TELEGRAM_ADMIN_CHAT_ID,
                `AI response to ${username}:\n\n${aiResponseText}`,
                undefined,
                threadId
              );
              debug('Successfully forwarded AI response to admin group');
            } catch (aiMsgError) {
              debug('❌ Error forwarding AI response to admin group:', aiMsgError);
              console.error('❌ Failed to forward AI response to admin group:', aiMsgError);
            }
            
            debug(`User message and AI response forwarded to admin group topic ${threadId}`);
          } else {
            // Try sending to main group without thread as fallback
            debug('No thread ID available. Trying to send to main group...');
            try {
              await sendTelegramMessage(
                envVars.TELEGRAM_BOT_TOKEN,
                envVars.TELEGRAM_ADMIN_CHAT_ID,
                `Message from: ${username} (${payload.message.from.id}):\n\n${payload.message.text}\n\n` +
                `AI response:\n${aiResponseText}`
              );
              debug('Successfully sent combined message to admin group (without topic)');
            } catch (fallbackError) {
              debug('❌ Fallback message to admin group failed:', fallbackError);
              console.error('❌ Failed to send fallback message to admin group:', fallbackError);
            }
          }
        } catch (error) {
          debug('❌ General error forwarding to admin group:', error);
          console.error('❌ Failed to forward messages to admin group:', error instanceof Error ? error.message : String(error));
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

export async function GET(request: Request): Promise<Response> {
  return testTelegramConnection(request);
} 