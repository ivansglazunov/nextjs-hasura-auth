import Debug from './debug';
import { Hasyx } from './hasyx'; // Assuming Hasyx client is used for DB operations
import { v4 as uuidv4 } from 'uuid';
import { HasuraEventPayload } from './events';

const debug = Debug('telegram_bot');

// Basic types for Telegram updates (simplified)
export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  my_chat_member?: TelegramChatMemberUpdated;
  // Add other update types like callback_query, etc. as needed
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  // entities?: MessageEntity[];
  // Add other message fields like photo, document, etc.
  reply_to_message?: TelegramMessage;
  new_chat_members?: TelegramUser[];
  message_thread_id?: number; // Topic/Thread ID for forum messages
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

// Added interface for my_chat_member updates
export interface TelegramChatMemberUpdated {
  chat: TelegramChat;
  from: TelegramUser;
  date: number;
  old_chat_member: TelegramChatMember;
  new_chat_member: TelegramChatMember;
  invite_link?: TelegramChatInviteLink;
}

export interface TelegramChatMember {
  user: TelegramUser;
  status: 'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked';
  // ... other fields like until_date, can_be_edited, etc.
}

export interface TelegramChatInviteLink {
  invite_link: string;
  creator: TelegramUser;
  creates_join_request: boolean;
  is_primary: boolean;
  is_revoked: boolean;
  name?: string;
  expire_date?: number;
  member_limit?: number;
  pending_join_request_count?: number;
}

// Helper function to call Telegram API
export async function callTelegramApi(token: string, methodName: string, params: Record<string, any>): Promise<any> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${methodName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await response.json();
  if (!data.ok) {
    debug(`Telegram API Error (${methodName}): ${data.error_code} - ${data.description}`);
    throw new Error(`Telegram API error (${methodName} - ${data.error_code}): ${data.description}`);
  }
  return data.result;
}

export interface BotCommand {
  command: string;
  description: string;
}

export async function setBotName(token: string, name: string): Promise<boolean> {
  try {
    await callTelegramApi(token, 'setMyName', { name });
    debug(`Successfully set bot name to "${name}"`);
    return true;
  } catch (error) {
    debug(`Failed to set bot name:`, error);
    console.error(`❌ Failed to set bot name: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

export async function setBotDescription(token: string, description: string): Promise<boolean> {
  try {
    await callTelegramApi(token, 'setMyDescription', { description });
    debug(`Successfully set bot description to "${description}"`);
    return true;
  } catch (error) {
    debug(`Failed to set bot description:`, error);
    console.error(`❌ Failed to set bot description: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

export async function setBotCommands(token: string, commands: BotCommand[]): Promise<boolean> {
  try {
    await callTelegramApi(token, 'setMyCommands', { commands });
    debug(`Successfully set bot commands:`, commands);
    return true;
  } catch (error) {
    debug(`Failed to set bot commands:`, error);
    console.error(`❌ Failed to set bot commands: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

export async function setWebhook(token: string, url: string): Promise<boolean> {
  try {
    await callTelegramApi(token, 'setWebhook', { url });
    debug(`Successfully set webhook to "${url}"`);
    return true;
  } catch (error) {
    debug(`Failed to set webhook:`, error);
    console.error(`❌ Failed to set webhook: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

// NEW function to set the bot's menu button to a Web App
export async function setBotMenuButtonWebApp(token: string, text: string, webAppUrl: string): Promise<boolean> {
  debug(`Setting bot menu button to Web App: ${text} -> ${webAppUrl}`);
  try {
    await callTelegramApi(token, 'setChatMenuButton', {
      menu_button: {
        type: 'web_app',
        text: text,
        web_app: {
          url: webAppUrl,
        },
      },
    });
    console.log(`✅ Bot menu button set to open Web App: "${text}" -> ${webAppUrl}`);
    debug(`Successfully set menu button to Web App: ${text}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to set bot menu button to Web App: ${error instanceof Error ? error.message : String(error)}`);
    debug('Failed to set bot menu button to Web App:', error);
    return false;
  }
}

// Helper function to send a message via Telegram API
export async function sendTelegramMessage(
  token: string, 
  chatId: number | string, 
  text: string, 
  replyToMessageId?: number,
  messageThreadId?: number
): Promise<any> {
  return callTelegramApi(token, 'sendMessage', {
    chat_id: chatId,
    text: text,
    reply_to_message_id: replyToMessageId,
    message_thread_id: messageThreadId
  });
}

/**
 * Processes an incoming Telegram update.
 * This function will be called from the API route.
 */
export async function processTelegramEvent(update: TelegramUpdate, client: Hasyx, env: Record<string, string | undefined>): Promise<any> {
  debug('Processing Telegram update:', update);
  const botToken = env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    debug('TELEGRAM_BOT_TOKEN not configured, skipping event processing.');
    return { success: false, message: 'Bot token not configured.' };
  }

  if (update.message) {
    const message = update.message;
    const chatId = message.chat.id;
    const userId = message.from?.id;
    const username = message.from?.username || message.from?.first_name || 'UnknownUser';
    const messageText = message.text;

    if (!userId) {
      debug('No user ID in message, cannot process.');
      return { success: false, message: 'User ID missing.' };
    }

    // Handle /start command: Register permission and reply with Chat ID
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

        await client.insert({
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
        debug('New telegram_bot permission potentially created/updated for chat ID:', chatId);
        
        await sendTelegramMessage(botToken, chatId, `Hello ${username}! Your Chat ID for Hasyx is: ${chatId}\nSend any message to test correspondence.`);
        return { success: true, message: '/start command processed' };

      } catch (dbError) {
        debug('Error processing /start command (DB operation):', dbError);
        await sendTelegramMessage(botToken, chatId, 'Sorry, there was an error processing your /start command. Please try again later.');
        return { success: false, message: 'DB error during /start processing.' };
      }
    }
    
    if (messageText) {
        debug(`Message from ${username} (Chat ID: ${chatId}) received, not /start. Potential for AI reply.`);
        // The API route and telegram-handler will decide if this needs an AI reply.
        return { success: true, message: 'Text message received, no specific action taken by core processor.' };
    }

  } else if (update.my_chat_member) {
    // Handle bot being added/removed from a chat, or status change
    debug('Received my_chat_member update:', update.my_chat_member);
    return { success: true, message: 'my_chat_member update processed.' };
    // Potentially log this or update bot's understanding of where it's active.
  }
  // Add handlers for other update types like callback_query if needed

  return { success: true, message: 'Event received, no specific action taken for this update type.' };
} 