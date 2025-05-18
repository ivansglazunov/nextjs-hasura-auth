import Debug from './debug';
import { callTelegramApi } from './telegram-bot'; // Assuming callTelegramApi is exported from telegram-bot.ts

const debug = Debug('telegram:group');

/**
 * Ensures a topic (forum thread) exists for a given user in a specified group.
 * If a topic with the name "username_userId" doesn't exist, it attempts to create one.
 * Telegram's createForumTopic might return an existing topic if one with the same name exists.
 * 
 * @param botToken - The Telegram bot token.
 * @param groupChatId - The ID of the admin group (must be a supergroup with topics enabled).
 * @param userId - The Telegram user ID.
 * @param username - The Telegram username or first name.
 * @returns The message_thread_id of the topic, or null if an error occurs.
 */
export async function ensureTopicExists(botToken: string, groupChatId: string, userId: number, username: string): Promise<number | null> {
  try {
    const topicTitle = `${username}_${userId}`;
    debug(`1. ensureTopicExists: User ${username} (ID: ${userId}), Group ${groupChatId}, Topic ${topicTitle}`);

    // First, verify the group is a forum
    const chatInfo = await callTelegramApi(botToken, 'getChat', { chat_id: groupChatId });
    debug('2. ensureTopicExists: Group info:', JSON.stringify(chatInfo, null, 2));

    if (chatInfo.is_forum !== true) {
      debug(`❌ ERROR: Group ${groupChatId} is not a forum. Topics cannot be used.`);
      console.error(`❌ Telegram group ${groupChatId} is not a forum. Please enable topics in group settings.`);
      return null;
    }
    debug('3. ensureTopicExists: Group is a forum.');

    // Attempt to create the topic. Telegram should return the existing topic if the name matches.
    // This is generally more reliable than listing all topics if the bot has creation rights.
    try {
      debug(`4. ensureTopicExists: Attempting to create/get topic: "${topicTitle}"`);
      const createTopicResponse = await callTelegramApi(botToken, 'createForumTopic', {
        chat_id: groupChatId,
        name: topicTitle,
      });
      debug(`5. ensureTopicExists: createForumTopic response:`, createTopicResponse);
      if (createTopicResponse && createTopicResponse.message_thread_id) {
        console.log(`✅ Topic "${topicTitle}" ensured (ID: ${createTopicResponse.message_thread_id}) in group ${groupChatId}.`);
        return createTopicResponse.message_thread_id;
      } else {
        debug('❌ ERROR: createForumTopic did not return a message_thread_id.', createTopicResponse);
        console.error(`❌ Failed to ensure topic "${topicTitle}" in group ${groupChatId}. Response:`, createTopicResponse);
        return null;
      }
    } catch (createError: any) {
      debug('❌ ERROR creating/getting topic via createForumTopic:', createError);
      console.error(`❌ Failed to ensure topic "${topicTitle}" for user ${username} in group ${groupChatId}:`, createError.message || createError);
      // Fallback: If creation failed for reasons other than "already exists", 
      // or if we want to be absolutely sure, we could try listing topics here.
      // However, the primary method should be createForumTopic if permissions are correct.
      return null;
    }
  } catch (error: any) {
    debug('❌ GENERAL ERROR in ensureTopicExists:', error);
    console.error(`❌ General error ensuring topic for user ${username} in group ${groupChatId}:`, error.message || error);
    return null;
  }
}

/**
 * Extracts a user ID from a topic title string.
 * Assumes the format "username_userId" or similar where userId is numeric at the end.
 * @param topicTitle The title of the topic.
 * @returns The extracted user ID, or null if not found.
 */
export function getUserIdFromTopicTitle(topicTitle: string): number | null {
  if (!topicTitle) return null;
  const match = topicTitle.match(/_(\d+)$/);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return null;
}

/**
 * Checks if a given Telegram chat is a forum (topics enabled).
 * @param botToken The Telegram bot token.
 * @param chatId The ID of the chat to check.
 * @returns An object { isForum: boolean, error?: string }.
 */
export async function isChatForum(botToken: string, chatId: string): Promise<{ isForum: boolean; error?: string }> {
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