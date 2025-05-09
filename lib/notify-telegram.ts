import Debug from './debug';
import { NotificationPermission, NotificationMessage, Notification } from './notify';

const debug = Debug('notify:telegram');

export async function sendTelegramNotification(
  permission: NotificationPermission,
  message: NotificationMessage,
  notification: Notification // eslint-disable-line @typescript-eslint/no-unused-vars
): Promise<{ success: boolean; message?: string }> {
  debug('Sending notification via Telegram bot');

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    debug('TELEGRAM_BOT_TOKEN is not set in environment variables.');
    return { success: false, message: 'Telegram Bot Token not configured.' };
  }

  if (!permission.device_token) {
    debug('Telegram chat_id (device_token) is missing in permission.');
    return { success: false, message: 'Telegram chat_id is missing.' };
  }

  const chatId = permission.device_token;
  let text = `*${message.title}*\n\n${message.body}`;

  // Append data if any, formatted as key: value
  if (message.data && Object.keys(message.data).length > 0) {
    text += '\n\n*Details:*';
    for (const [key, value] of Object.entries(message.data)) {
      text += `\n- ${key}: ${value}`;
    }
  }
  
  // Append config if any, formatted as key: value
  // This might be useful for Telegram-specific options in the future
  if (notification.config && Object.keys(notification.config).length > 0) {
    // Example: text += \n\n*Config:* ... (if needed)
  }

  const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown', // Or 'HTML' if you prefer
      }),
    });

    const responseData = await response.json();

    if (!response.ok || !responseData.ok) {
      debug('Failed to send Telegram message:', responseData);
      return {
        success: false,
        message: `Telegram API error: ${responseData.description || 'Unknown error'} (Code: ${responseData.error_code || response.status})`,
      };
    }

    debug('Telegram message sent successfully:', responseData.result);
    return { success: true };

  } catch (error) {
    debug('Error sending Telegram message:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error sending Telegram message',
    };
  }
} 