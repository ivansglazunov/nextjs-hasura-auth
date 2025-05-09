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
async function callTelegramApi(token: string, methodName: string, params: Record<string, any>): Promise<any> {
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

/**
 * Processes an incoming Telegram update.
 * This function will be called from the API route.
 */
export async function processTelegramEvent(update: TelegramUpdate, client: Hasyx, env: Record<string, string | undefined>): Promise<any> {
  debug('Processing Telegram event:', JSON.stringify(update, null, 2));
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const adminChatId = env.TELEGRAM_ADMIN_CHAT_ID; // For group interaction logic

  if (!botToken) {
    console.error('TELEGRAM_BOT_TOKEN is not defined.');
    return { success: false, message: 'Telegram Bot Token not configured.' };
  }

  if (update.message) {
    const message = update.message;
    const chatId = message.chat.id;
    const userId = message.from?.id;
    const username = message.from?.username || message.from?.first_name || 'TelegramUser';

    // Handle /start command
    if (message.text && message.text.startsWith('/start')) {
      debug(`Received /start command from user ${userId} in chat ${chatId}`);
      if (!userId) {
        debug('User ID not found in /start command message');
        return { success: false, message: 'User ID missing in command.'} ;
      }
      try {
        // 1. Check if an account for this Telegram user already exists
        let account = await client.select({
          table: 'accounts',
          where: {
            provider: { _eq: 'telegram' },
            provider_account_id: { _eq: userId.toString() },
          },
          returning: ['id', 'user_id', 'user'], // Include user to check if linked
          limit: 1,
          role: 'admin' // Use admin role for system operations
        });
        
        let hasyxUserId: string | undefined = account?.user_id;

        if (account && !hasyxUserId) {
          // Account exists but is not linked to a user (should not happen with current logic but good to check)
          // Potentially link to an existing user by email if Telegram provides it, or create new.
          // For now, assume we need to create a user or link to one.
          debug('Telegram account exists but not linked to a hasyx user. This case needs handling.');
        }

        // 2. If no Hasyx user, create one or find by email (if available)
        if (!hasyxUserId) {
          // For simplicity, we'll create a new user. 
          // A more robust solution might try to find an existing user by email if Telegram provides it.
          const newUser = await client.insert({
            table: 'users',
            object: {
              name: username,
              // email: if telegram provides email, use it here
              hasura_role: 'user', // Default role
            },
            returning: ['id', 'name'],
            role: 'admin'
          });
          hasyxUserId = newUser.id;
          debug(`Created new Hasyx user ${hasyxUserId} for Telegram user ${userId}`);
          
          // Link account if it wasn't found linked before, or create new if it didn't exist
          if (!account) {
            account = await client.insert({
              table: 'accounts',
              object: {
                user_id: hasyxUserId,
                type: 'oauth', // or a more specific type for bot interaction
                provider: 'telegram',
                provider_account_id: userId.toString(),
              },
              returning: ['id'],
              role: 'admin'
            });
            debug(`Created new Hasyx account for Telegram user ${userId}, linked to Hasyx user ${hasyxUserId}`);
          } else if (account && !account.user_id) {
            // This case should ideally be handled by linking logic if an unlinked account was found
            // For now, we'll assume the new user needs this account linked.
            await client.update({
              table: 'accounts',
              pk_columns: { id: account.id }, 
              _set: { user_id: hasyxUserId },
              role: 'admin'
            });
            debug(`Linked existing Hasyx account ${account.id} to new Hasyx user ${hasyxUserId}`);
          }
        } else {
          debug(`Telegram user ${userId} already linked to Hasyx user ${hasyxUserId}`);
        }

        // 3. Register for notifications
        const existingPermission = await client.select({
          table: 'notification_permissions',
          where: {
            user_id: { _eq: hasyxUserId },
            provider: { _eq: 'telegram_bot' },
            device_token: { _eq: chatId.toString() }
          },
          returning: ['id'],
          limit: 1,
          role: 'admin'
        });

        if (!existingPermission) {
          await client.insert({
            table: 'notification_permissions',
            object: {
              id: uuidv4(),
              user_id: hasyxUserId,
              provider: 'telegram_bot',
              device_token: chatId.toString(), // Store chat_id as device_token
              device_info: { platform: 'telegram', userAgent: `telegram_user_${userId}` }, // Basic device info
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            returning: ['id'],
            role: 'admin'
          });
          debug(`Registered Hasyx user ${hasyxUserId} for Telegram notifications on chat ${chatId}`);
        }

        // Send a welcome message or confirmation
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: `Welcome, ${username}! You are now registered.` }),
        });
        return { success: true, message: 'User registered and subscribed to notifications.' };

      } catch (error) {
        debug('Error processing /start command:', error);
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: 'An error occurred during registration. Please try again later.' }),
        });
        return { success: false, message: error instanceof Error ? error.message : 'Failed to process /start command' };
      }
    }
    
    // --- Start Group/Topic Management Logic ---
    // This is a simplified version. A robust solution would need more state management.
    if (message.chat.type === 'private' && adminChatId && message.from && !message.from.is_bot) {
        // User sent a DM to the bot
        const userTopicName = `@${message.from.username || message.from.id.toString()}`;
        let topicThreadId: number | undefined;

        // In a real scenario, you might query existing topics or store topic_id mapping.
        // For simplicity, we'll just try to create a topic or assume one named @username exists
        // This part of Telegram API (forum topics) is more complex.
        // For now, let's forward to the main group and mention it's from a user.
        
        const forwardText = `Message from ${userTopicName} (User ID: ${userId}, Chat ID: ${chatId}):\n\n${message.text}`;
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            chat_id: adminChatId, 
            text: forwardText 
            // In a full implementation, you'd use message_thread_id if you have it
          }),
        });
        debug(`Forwarded message from ${userTopicName} to admin chat ${adminChatId}`);
    }
    
    if (message.chat.id.toString() === adminChatId && message.reply_to_message && message.reply_to_message.from?.is_bot) {
        // This is a reply to the bot's message in the admin group
        // Attempt to extract original user's chat_id from the bot's message it replied to.
        // This requires the bot's forwarded message to contain the original user's chat_id.
        const originalMessageText = message.reply_to_message.text;
        if (originalMessageText) {
            const match = originalMessageText.match(/Chat ID: (\d+)/);
            if (match && match[1]) {
                const originalUserChatId = match[1];
                const replyText = message.text;

                await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ chat_id: originalUserChatId, text: `Reply from support: ${replyText}` }),
                });
                debug(`Sent reply from admin group to user chat ${originalUserChatId}`);
            }
        }
    }
    // --- End Group/Topic Management Logic ---

  } else if (update.my_chat_member) {
    // Bot was added to a group/channel or its status changed
    const chatMemberUpdate = update.my_chat_member;
    if (chatMemberUpdate.new_chat_member.status === 'administrator' || chatMemberUpdate.new_chat_member.status === 'member') {
        if (chatMemberUpdate.chat.type === 'group' || chatMemberUpdate.chat.type === 'supergroup') {
            debug(`Bot was added to group: ${chatMemberUpdate.chat.title} (ID: ${chatMemberUpdate.chat.id}) as ${chatMemberUpdate.new_chat_member.status}`);
            // Potentially store this group ID if it's intended to be the admin/correspondence group
            // The `assist` flow should guide the user to set this group ID as TELEGRAM_ADMIN_CHAT_ID
        }
    }
  }

  // Fallback for unhandled events or messages
  return { success: true, message: 'Event received' };
} 