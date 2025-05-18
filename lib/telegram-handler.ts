import { NextResponse } from 'next/server';
import { TelegramUpdate, sendTelegramMessage, processTelegramEvent } from './telegram-bot';
import { ensureTopicExists, getUserIdFromTopicTitle } from './telegram-group';
import { Hasyx } from './hasyx';
import { ask as askAI } from './ask';
import Debug from './debug';

const debug = Debug('telegram:handler');

export interface TelegramWebhookProcessors {
  /**
   * Optional. Handles mirroring the user's message and (if provided) the AI's response to an admin group.
   */
  mirrorToAdminGroup?: (
    payload: TelegramUpdate, // Full payload for context (e.g., message.from for username/id)
    botToken: string,
    adminChatId: string,
    userMessageText: string, 
    aiResponseText?: string 
  ) => Promise<void>;

  /**
   * Optional. Handles getting a response from an AI.
   * @param userMessageText The text from the user.
   * @param userId The user's Telegram ID.
   * @returns A promise that resolves to the AI's response string, or null if no response.
   */
  getAiResponse?: (
    userMessageText: string,
    userId: string
    // Hasyx client or other context can be added if needed by more advanced AI processors
  ) => Promise<string | null>;
}

/**
 * Handles messages originating from an admin in an admin group topic.
 * This function is currently a placeholder or for very specific direct admin messages in topics.
 * More complex reply chains are expected to be handled by processTelegramEvent.
 */
async function handleAdminReplyInTopic(
  payload: TelegramUpdate,
  botToken: string,
  adminChatId: string
): Promise<NextResponse | null> {
  if (
    payload.message &&
    payload.message.message_thread_id &&
    String(payload.message.chat.id) === adminChatId &&
    payload.message.from &&
    !payload.message.from.is_bot &&
    payload.message.text
  ) {
    debug('Processing admin message in topic (handleAdminReplyInTopic)...');
    // Actual logic for forwarding this admin message to the user would go here.
    // This might involve parsing the topic title to get the user ID.
    // For now, it returns null to let the main flow continue, assuming processTelegramEvent handles replies.
    // If this function were to fully handle the message, it would return a NextResponse.
    // const targetUserId = getUserIdFromTopicTitle(TOPIC_NAME_IF_AVAILABLE);
    // if (targetUserId) { 
    //   await sendTelegramMessage(botToken, targetUserId, `Admin: ${payload.message.text}`);
    //   return NextResponse.json({ success: true, message: 'Admin message forwarded from topic.' });
    // }
    debug('handleAdminReplyInTopic: No direct action taken, deferring to other handlers or processTelegramEvent.');
    return null;
  }
  return null;
}

/**
 * Handles a direct message from a user to the bot.
 * Gets an AI response and mirrors the conversation to the admin group topic.
 */
async function handleUserMessageAndAIResponse(
  payload: TelegramUpdate,
  botToken: string,
  adminChatId: string | undefined,
  hasyxClient: Hasyx // Renamed for clarity
): Promise<NextResponse> {
  if (
    !payload.message ||
    !payload.message.text ||
    !payload.message.from ||
    payload.message.from.is_bot
  ) {
    debug('handleUserMessageAndAIResponse: Not a processable user text message.');
    return NextResponse.json({ success: false, message: 'Not a processable user text message.' });
  }

  const userTelegramId = payload.message.from.id;
  const userChatId = payload.message.chat.id; // Private chat ID with the user
  const username = payload.message.from.username || payload.message.from.first_name || 'UnknownUser';
  const userMessageText = payload.message.text;

  debug(`handleUserMessageAndAIResponse: Processing user message from ${username} (ID: ${userTelegramId})`);

  // 1. Get AI response
  const aiResponseText = await askAI(userMessageText, String(userTelegramId));
  await sendTelegramMessage(botToken, userChatId, aiResponseText);
  debug('AI response sent to user in private chat:', userChatId);

  // 2. Ensure conversation is mirrored to the admin group topic
  if (adminChatId && String(userChatId) !== adminChatId) {
    debug(`Mirroring conversation to admin group ${adminChatId} for user ${username}`);
    const topicThreadId = await ensureTopicExists(
      botToken,
      adminChatId,
      userTelegramId,
      username
    );

    if (topicThreadId) {
      // Forward user's original message
      await sendTelegramMessage(
        botToken,
        adminChatId,
        `Message from: ${username} (User ID: ${userTelegramId}, Chat ID: ${userChatId}):\n\n${userMessageText}`,
        undefined, // replyToMessageId
        topicThreadId
      );
      // Forward AI's response
      await sendTelegramMessage(
        botToken,
        adminChatId,
        `AI response to ${username} (User ID: ${userTelegramId}):\n\n${aiResponseText}`,
        undefined, // replyToMessageId
        topicThreadId
      );
      debug(`User message and AI response mirrored to admin group topic ${topicThreadId}`);
    } else {
      debug('Failed to ensure topic in admin group for mirroring. Sending fallback message to group.');
      await sendTelegramMessage(
        botToken,
        adminChatId,
        `[No Topic / Error] User: ${username} (ID: ${userTelegramId}):\n${userMessageText}\n\nAI Response:\n${aiResponseText}`
      );
    }
  }
  return NextResponse.json({ success: true, message: 'AI response processed and interaction mirrored to admin group if configured.' });
}

/**
 * Main orchestrator for handling incoming Telegram webhook updates.
 */
export async function handleTelegramWebhook(
  payload: TelegramUpdate,
  hasyxClient: Hasyx,
  env: Record<string, string | undefined>, // Pass all environment variables
  processors?: TelegramWebhookProcessors
): Promise<NextResponse> {
  debug('handleTelegramWebhook: Processing update_id:', payload.update_id);

  const botToken = env.TELEGRAM_BOT_TOKEN;
  const adminChatId = env.TELEGRAM_ADMIN_CHAT_ID;

  if (!botToken) {
    console.error('❌ CRITICAL: TELEGRAM_BOT_TOKEN is not set. Telegram features will fail.');
    return NextResponse.json({ error: 'Telegram Bot token not configured on server' }, { status: 500 });
  }

  // 1. Core Hasyx event processing (e.g., /start command, permissions, basic non-AI replies from processTelegramEvent)
  const coreResult = await processTelegramEvent(payload, hasyxClient, env);
  debug('Core processing (processTelegramEvent) result:', coreResult);

  const message = payload.message;

  // 2. If it's a user text message, proceed to optional AI and mirroring
  if (
    message &&
    message.text &&
    message.from && !message.from.is_bot &&
    // Check if coreResult indicates it was NOT fully handled (e.g. /start usually is)
    (coreResult.message === 'Text message received, no specific action taken by core processor.' ||
     coreResult.message === 'Event received, no specific action taken for this update type.' ||
     coreResult.success === false // If core processing failed, but it was a user message, still try AI/mirror
    )
  ) {
    const userTelegramId = message.from.id;
    const userChatId = message.chat.id; // Private chat with user
    const userMessageText = message.text;

    let aiResponseText: string | null = null;

    // 2a. Optional: Get AI Response if a processor is provided
    if (processors?.getAiResponse) {
      debug('Calling custom getAiResponse processor...');
      try {
        aiResponseText = await processors.getAiResponse(userMessageText, String(userTelegramId));
        if (aiResponseText) {
          await sendTelegramMessage(botToken, userChatId, aiResponseText);
          debug('AI response from custom processor sent to user in private chat:', userChatId);
        } else {
          debug('Custom getAiResponse processor returned null or empty, no AI response sent.');
        }
      } catch (aiError: any) {
        debug('Error in custom getAiResponse processor:', aiError.message);
        console.error('Custom AI processor error:', aiError);
        // Optionally send a generic error message to the user via Telegram
        await sendTelegramMessage(botToken, userChatId, "I couldn't process that with AI right now.");
      }
    }

    // 2b. Optional: Mirror to Admin Group if a processor and adminChatId are provided
    if (processors?.mirrorToAdminGroup && adminChatId) {
        debug('Calling custom mirrorToAdminGroup processor...');
        try {
            await processors.mirrorToAdminGroup(payload, botToken, adminChatId, userMessageText, aiResponseText ?? undefined);
        } catch (mirrorError: any) {
            debug('Error in custom mirrorToAdminGroup processor:', mirrorError.message);
            console.error('Custom mirrorToAdminGroup processor error:', mirrorError);
        }
    }

    // If AI response was generated or mirroring was attempted, consider it a successful interaction path
    // The actual success depends on the processors themselves.
    return NextResponse.json({
        success: true,
        message: 'User message processed by custom handlers (AI and/or mirroring).'
        // coreProcessingResult: coreResult // Optionally include for debugging
    });
  }

  // 3. If not a user message for AI/mirroring, or no custom processors for those actions, 
  //    return the result from the core processing (processTelegramEvent).
  debug('Not a message for custom AI/mirroring, or no processors defined for it. Returning core processing result.');
  return NextResponse.json(coreResult);
} 