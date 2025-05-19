import { NextResponse } from 'next/server';
import { TelegramUpdate, sendTelegramMessage, processTelegramEvent } from './telegram-bot';
import { Hasyx } from './hasyx';
import Debug from './debug';

const debug = Debug('telegram:handler');

export interface TelegramWebhookProcessors {
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

  if (!botToken) {
    console.error('❌ CRITICAL: TELEGRAM_BOT_TOKEN is not set. Telegram features will fail.');
    return NextResponse.json({ error: 'Telegram Bot token not configured on server' }, { status: 500 });
  }

  // 1. Core Hasyx event processing (e.g., /start command, permissions)
  const coreResult = await processTelegramEvent(payload, hasyxClient, env);
  debug('Core processing (processTelegramEvent) result:', coreResult);

  const message = payload.message;

  // 2. If it's a user text message, proceed to optional AI 
  if (
    message &&
    message.text &&
    message.from && !message.from.is_bot &&
    (coreResult.message === 'Text message received, no specific action taken by core processor.' ||
     coreResult.message === 'Event received, no specific action taken for this update type.' ||
     (coreResult.success === false && message.text) // If core processing failed, but it was a user message, still try AI
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
        await sendTelegramMessage(botToken, userChatId, "I couldn't process that with AI right now.");
      }
    }

    return NextResponse.json({
        success: true,
        message: 'User message processed by custom AI handler if configured.'
    });
  }

  // 3. If not a user message for AI, or no custom processors for those actions, 
  //    return the result from the core processing (processTelegramEvent).
  debug('Not a message for custom AI, or no AI processor defined. Returning core processing result.');
  return NextResponse.json(coreResult);
} 