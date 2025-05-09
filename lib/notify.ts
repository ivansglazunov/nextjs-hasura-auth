import Debug from './debug';
import { Hasyx } from './hasyx'; 
import { HasuraEventPayload } from './events';

const debug = Debug('notify');

// Типы для системы уведомлений
export interface NotificationPermission {
  id: string;
  user_id: string;
  provider: string;
  device_token: string;
  device_info: DeviceInfo;
  created_at: string;
  updated_at: string;
}

export interface NotificationMessage {
  id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  created_at: string;
  user_id: string;
}

export interface Notification {
  id: string;
  message_id: string;
  permission_id: string;
  config?: Record<string, any>;
  status: 'pending' | 'sent' | 'failed';
  error?: string;
  created_at: string;
  updated_at: string;
}

export interface DeviceInfo {
  platform: 'browser' | 'android' | 'ios' | 'windows' | 'mac' | 'linux' | 'telegram';
  browser?: string;
  os?: string;
  device?: string;
  userAgent?: string;
}

// Получение информации об устройстве для сохранения в разрешении
export function getDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined') {
    return { platform: 'browser' };
  }

  const userAgent = window.navigator.userAgent;
  const platform = detectPlatform(userAgent);
  const browser = detectBrowser(userAgent);
  const os = detectOS(userAgent);
  const device = detectDevice(userAgent);

  return {
    platform,
    browser,
    os,
    device,
    userAgent
  };
}

// Определение платформы по User-Agent
function detectPlatform(userAgent: string): DeviceInfo['platform'] {
  if (/android/i.test(userAgent)) return 'android';
  if (/iPad|iPhone|iPod/.test(userAgent)) return 'ios';
  if (/Win/.test(userAgent)) return 'windows';
  if (/Mac/.test(userAgent)) return 'mac';
  if (/Linux/.test(userAgent)) return 'linux';
  return 'browser';
}

// Определение браузера по User-Agent
function detectBrowser(userAgent: string): string {
  if (/chrome/i.test(userAgent)) return 'Chrome';
  if (/firefox/i.test(userAgent)) return 'Firefox';
  if (/safari/i.test(userAgent)) return 'Safari';
  if (/edge/i.test(userAgent)) return 'Edge';
  if (/opera|opr/i.test(userAgent)) return 'Opera';
  if (/msie|trident/i.test(userAgent)) return 'Internet Explorer';
  return 'Unknown';
}

// Определение OS по User-Agent
function detectOS(userAgent: string): string {
  if (/Windows NT 10.0/.test(userAgent)) return 'Windows 10';
  if (/Windows NT 6.3/.test(userAgent)) return 'Windows 8.1';
  if (/Windows NT 6.2/.test(userAgent)) return 'Windows 8';
  if (/Windows NT 6.1/.test(userAgent)) return 'Windows 7';
  if (/Mac OS X/.test(userAgent)) {
    const macOSVersion = userAgent.match(/Mac OS X ([0-9_]+)/);
    return macOSVersion ? `macOS ${macOSVersion[1].replace(/_/g, '.')}` : 'macOS';
  }
  if (/Linux/.test(userAgent)) return 'Linux';
  if (/Android/.test(userAgent)) {
    const androidVersion = userAgent.match(/Android ([0-9.]+)/);
    return androidVersion ? `Android ${androidVersion[1]}` : 'Android';
  }
  if (/iPhone|iPad|iPod/.test(userAgent)) {
    const iOSVersion = userAgent.match(/OS ([0-9_]+)/);
    return iOSVersion ? `iOS ${iOSVersion[1].replace(/_/g, '.')}` : 'iOS';
  }
  return 'Unknown';
}

// Определение устройства по User-Agent
function detectDevice(userAgent: string): string {
  if (/iPad/.test(userAgent)) return 'iPad';
  if (/iPhone/.test(userAgent)) return 'iPhone';
  if (/Android/.test(userAgent)) {
    if (/Mobile/.test(userAgent)) return 'Android Phone';
    return 'Android Tablet';
  }
  return 'Desktop';
}

// Основной обработчик событий для уведомлений, вызываемый из API endpoint
export async function handleNotificationEvent(payload: HasuraEventPayload, client: Hasyx): Promise<any> {
  const { event, table } = payload;
  const { op, data } = event;
  
  debug('Received notification event:', { operation: op, table: `${table.schema}.${table.name}` });
  
  // Only process new notification insertions
  if (op !== 'INSERT' || table.name !== 'notifications') {
    debug('Ignoring event - not an insertion to notifications table');
    return { success: false, message: 'Unsupported event' };
  }
  
  const notification = data.new as Notification;
  debug('Processing notification:', notification);
  
  try {
    // Get permission information
    const permission = await client.select<NotificationPermission>({
      table: 'notification_permissions',
      pk_columns: { id: notification.permission_id },
      returning: ['id', 'user_id', 'provider', 'device_token', 'device_info'],
      role: 'admin'
    });
    
    if (!permission) {
      throw new Error('Permission not found');
    }
    
    // Get message for notification
    const message = await client.select<NotificationMessage>({
      table: 'notification_messages',
      pk_columns: { id: notification.message_id },
      returning: ['id', 'title', 'body', 'data'],
      role: 'admin'
    });
    
    if (!message) {
      throw new Error('Message not found');
    }
    
    // Route by provider type
    let result;
    switch (permission.provider) {
      case 'firebase':
        debug('Sending via Firebase provider');
        // This import will be defined in a separate file
        const { sendFirebaseNotification } = await import('./notify-firebase');
        result = await sendFirebaseNotification(permission, message, notification);
        break;
      // Future providers can be added here
      default:
        debug(`Unsupported provider: ${permission.provider}`);
        result = { success: false, message: `Unsupported provider: ${permission.provider}` };
    }
    
    // Update notification status
    await client.update({
      table: 'notifications',
      pk_columns: { id: notification.id },
      _set: {
        status: result.success ? 'sent' : 'failed',
        error: result.success ? null : result.message,
        updated_at: new Date().toISOString()
      },
      role: 'admin'
    });
    
    return result;
  } catch (error) {
    debug('Error processing notification:', error);
    
    // Update status with error
    try {
      await client.update({
        table: 'notifications',
        pk_columns: { id: notification.id },
        _set: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          updated_at: new Date().toISOString()
        },
        role: 'admin'
      });
    } catch (updateError) {
      debug('Failed to update notification status:', updateError);
    }
    
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error sending notification'
    };
  }
}

// Клиентская версия обработчика уведомлений для работы с клиентом из useClient()
export async function handleClientNotificationEvent(payload: HasuraEventPayload, client: any): Promise<any> {
  const { event, table } = payload;
  const { op, data } = event;
  
  debug('Received notification event (client version):', { operation: op, table: `${table.schema}.${table.name}` });
  
  // Only process new notification insertions
  if (op !== 'INSERT' || table.name !== 'notifications') {
    debug('Ignoring event - not an insertion to notifications table');
    return { success: false, message: 'Unsupported event' };
  }
  
  const notification = data.new as Notification;
  debug('Processing notification:', notification);
  
  try {
    // Use the same code as in the main function, but with client version of Hasyx
    const permission = await client.select({
      table: 'notification_permissions',
      pk_columns: { id: notification.permission_id },
      returning: ['id', 'user_id', 'provider', 'device_token', 'device_info'],
      role: 'admin'
    });
    
    if (!permission) {
      throw new Error('Permission not found');
    }
    
    const message = await client.select({
      table: 'notification_messages',
      pk_columns: { id: notification.message_id },
      returning: ['id', 'title', 'body', 'data'],
      role: 'admin'
    });
    
    if (!message) {
      throw new Error('Message not found');
    }
    
    let result;
    switch (permission.provider) {
      case 'firebase':
        debug('Sending via Firebase provider');
        const { sendFirebaseNotification } = await import('./notify-firebase');
        result = await sendFirebaseNotification(permission, message, notification);
        break;
      default:
        debug(`Unsupported provider: ${permission.provider}`);
        result = { success: false, message: `Unsupported provider: ${permission.provider}` };
    }
    
    await client.update({
      table: 'notifications',
      pk_columns: { id: notification.id },
      _set: {
        status: result.success ? 'sent' : 'failed',
        error: result.success ? null : result.message,
        updated_at: new Date().toISOString()
      },
      role: 'admin'
    });
    
    return result;
  } catch (error) {
    debug('Error processing notification:', error);
    
    try {
      await client.update({
        table: 'notifications',
        pk_columns: { id: notification.id },
        _set: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          updated_at: new Date().toISOString()
        },
        role: 'admin'
      });
    } catch (updateError) {
      debug('Failed to update notification status:', updateError);
    }
    
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error sending notification'
    };
  }
} 