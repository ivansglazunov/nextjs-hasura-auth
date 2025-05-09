import { Hasura } from './hasura';
import Debug from './debug';
import { Hasyx } from './hasyx';
import { HasuraEventPayload } from './events';

const debug = Debug('notify');

// Interface for notification data (from DB)
export interface Notification {
  id: string;
  message_id: string;
  permission_id: string;
  config?: Record<string, any> | null;
  status: 'pending' | 'sent' | 'failed' | 'viewed';
  error?: string | null;
  created_at: string;
  updated_at: string;
}

// Interface for notification permission data (from DB)
export interface NotificationPermission {
  id: string;
  user_id: string;
  provider: string; // e.g., 'firebase', 'apn', 'telegram_bot', 'telegram_channel'
  device_token: string;
  device_info: Record<string, any>; // e.g., { platform: 'web', browser: 'chrome', os: 'mac' }
  created_at: string;
  updated_at: string;
}

// Interface for notification message content (from DB)
export interface NotificationMessage {
  id: string;
  title: string;
  body: string;
  data?: Record<string, any> | null; // Custom data for the notification
  user_id: string; // User who created/triggered the message (optional, for tracking)
  created_at: string;
}

// Main notification event handler, called from API endpoint
export async function handleNotificationEvent(
  payload: HasuraEventPayload, 
  client: Hasyx, // Expecting Hasyx client
  getAccessToken: () => Promise<string> // Added for Firebase server-side auth
): Promise<any> {
  const { event, table } = payload;
  const { op, data } = event;
  
  debug('Received notification event:', { operation: op, table: `${table.schema}.${table.name}` });
  
  if (op !== 'INSERT' || table.name !== 'notifications') {
    debug('Ignoring event - not an insertion to notifications table');
    return { success: false, message: 'Unsupported event' };
  }
  
  const notification = data.new as Notification;
  debug('Processing notification:', notification);
  
  try {
    // Get permission information
    const permissions = await client.select<NotificationPermission[]>({
      table: 'notification_permissions',
      where: { id: { _eq: notification.permission_id } },
      returning: ['id', 'user_id', 'provider', 'device_token', 'device_info'],
      limit: 1
    });

    if (!permissions || permissions.length === 0) {
      throw new Error('Permission not found for notification');
    }
    const permission = permissions[0];

    // Get message information
    const messages = await client.select<NotificationMessage[]>({
      table: 'notification_messages',
      where: { id: { _eq: notification.message_id } },
      returning: ['id', 'title', 'body', 'data', 'user_id'],
      limit: 1
    });

    if (!messages || messages.length === 0) {
      throw new Error('Message not found for notification');
    }
    const message = messages[0];

    let result;
    switch (permission.provider) {
      case 'firebase':
        debug('Sending via Firebase provider');
        const { sendFirebaseNotification } = await import('./notify-firebase');
        result = await sendFirebaseNotification(permission, message, notification, getAccessToken);
        break;
      case 'telegram_bot':
        debug('Sending via Telegram Bot provider');
        const { sendTelegramNotification } = await import('./notify-telegram');
        result = await sendTelegramNotification(permission, message, notification);
        break;
      case 'telegram_channel':
        debug('Sending via Telegram Channel provider');
        const { sendTelegramChannelNotification } = await import('./notify-telegram-channel');
        result = await sendTelegramChannelNotification(permission, message, notification);
        break;
      default:
        debug(`Unsupported provider: ${permission.provider}`);
        result = { success: false, message: `Unsupported provider: ${permission.provider}` };
    }
    
    // Update notification status using Hasyx client
    await client.update<Notification>({
      table: 'notifications',
      where: { id: { _eq: notification.id } },
      _set: {
        status: result.success ? 'sent' : 'failed',
        error: result.success ? null : result.message,
        updated_at: new Date().toISOString()
      }
    });
    
    return result;
  } catch (error) {
    debug('Error processing notification:', error);
    // Update status with error using Hasyx client
    try {
      await client.update<Notification>({
        table: 'notifications',
        where: { id: { _eq: notification.id } }, 
        _set: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error in handleNotificationEvent',
          updated_at: new Date().toISOString()
        }
      });
    } catch (updateError) {
      debug('Failed to update notification status on error:', updateError);
    }
    
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error sending notification'
    };
  }
}

// New getDeviceInfo function from origin/main
/**
 * Gets device information from the user agent.
 * This is a client-side utility.
 */
export function getDeviceInfo(): { platform: string; browser: string; os: string; type: string; userAgent: string; } {
  if (typeof window === 'undefined') {
    return {
      platform: 'unknown',
      browser: 'unknown',
      os: 'unknown',
      type: 'unknown',
      userAgent: 'server'
    };
  }

  const userAgent = window.navigator.userAgent;
  let platform = 'unknown';
  let browser = 'unknown';
  let os = 'unknown';
  let type = 'desktop'; // Default to desktop

  // Detect OS
  if (/Windows NT 10.0/.test(userAgent)) os = 'Windows 10';
  else if (/Windows NT 6.2/.test(userAgent)) os = 'Windows 8';
  else if (/Windows NT 6.1/.test(userAgent)) os = 'Windows 7';
  else if (/Windows NT 6.0/.test(userAgent)) os = 'Windows Vista';
  else if (/Windows NT 5.1/.test(userAgent)) os = 'Windows XP';
  else if (/Mac OS X ([0-9_]+)/.test(userAgent)) {
    const osVersion = userAgent.match(/Mac OS X ([0-9_]+)/)?.[1].replace(/_/g, '.');
    os = `macOS ${osVersion || ''}`.trim();
  }
  else if (/Android ([0-9\.]+)/.test(userAgent)) {
    const osVersion = userAgent.match(/Android ([0-9\.]+)/)?.[1];
    os = `Android ${osVersion || ''}`.trim();
    type = 'mobile';
  }
  else if (/iPhone OS ([0-9_]+)/.test(userAgent)) {
    const osVersion = userAgent.match(/iPhone OS ([0-9_]+)/)?.[1].replace(/_/g, '.');
    os = `iOS ${osVersion || ''}`.trim();
    type = 'mobile';
  }
  else if (/Linux/.test(userAgent)) os = 'Linux';

  // Detect Browser
  if (/MSIE|Trident/.test(userAgent)) browser = 'Internet Explorer'; // Trident for IE11
  else if (userAgent.includes('Edge') || userAgent.includes('Edg')) browser = 'Edge'; // Edg for Chromium Edge
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Opera') || userAgent.includes('OPR')) browser = 'Opera'; // OPR for Blink Opera
  else if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Safari')) browser = 'Safari';

  // Detect Platform (more general than OS)
  if (/Mobi|Android|iPhone|iPad|iPod/.test(userAgent)) {
    platform = 'Mobile';
    type = 'mobile';
  } else {
    platform = 'Desktop';
    type = 'desktop';
  }
  
  // Refine type based on more specific checks
  if (/iPad/.test(userAgent)) type = 'tablet';
  else if (/Android/.test(userAgent) && !/Mobile/.test(userAgent)) type = 'tablet'; // Android tablet

  return {
    platform,
    browser,
    os,
    type,
    userAgent
  };
} 