import Debug from './debug';
import { NotificationPermission, NotificationMessage, Notification } from './notify';
import fetch from 'node-fetch';

const debug = Debug('notify:telegram-channel');

export async function sendTelegramChannelNotification(
  permission: NotificationPermission,
  message: NotificationMessage,
  notification: Notification // eslint-disable-line @typescript-eslint/no-unused-vars
): Promise<{ success: boolean; message?: string }> {
  debug('Sending notification via Telegram channel');

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    debug('TELEGRAM_BOT_TOKEN is not set in environment variables.');
    return { success: false, message: 'Telegram Bot Token not configured.' };
  }

  // For channel, device_token stores the channel ID (e.g., @channelname or -100xxxxxxxxxx)
  const channelId = permission.device_token;
  if (!channelId) {
    debug('Telegram channel_id (device_token) is missing in permission.');
    return { success: false, message: 'Telegram channel_id is missing.' };
  }

  let text = `*${message.title}*\n\n${message.body}`;

  if (message.data && Object.keys(message.data).length > 0) {
    text += '\n\n*Details:*';
    for (const [key, value] of Object.entries(message.data)) {
      text += `\n- ${key}: ${value}`;
    }
  }
  // Add more formatting or Telegram-specific features like inline keyboards later if needed

  const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: channelId,
        text: text,
        parse_mode: 'Markdown',
        // disable_web_page_preview: false, // Optional
        // disable_notification: false, // Optional
      }),
    });

    const responseData = await response.json() as any;

    if (!response.ok || !responseData.ok) {
      debug('Failed to send Telegram channel message:', responseData);
      return {
        success: false,
        message: `Telegram API error: ${responseData.description || 'Unknown error'} (Code: ${responseData.error_code || response.status})`,
      };
    }

    debug('Telegram channel message sent successfully:', responseData.result);
    return { success: true };

  } catch (error) {
    debug('Error sending Telegram channel message:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error sending Telegram channel message',
    };
  }
} 