import { NextResponse } from 'next/server';
import { hasyxEvent, HasuraEventPayload } from 'hasyx/lib/events';
import { Hasura } from 'hasyx/lib/hasura';
import Debug from 'hasyx/lib/debug';
import { GoogleAuth } from 'google-auth-library';

const debug = Debug('api:events:notify');

// Function to get OAuth 2.0 access token for FCM v1 API (server-side implementation)
async function getOAuthAccessTokenForServer(): Promise<string> {
  debug('Attempting to get OAuth 2.0 access token for FCM on server');
  try {
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
      // GOOGLE_APPLICATION_CREDENTIALS environment variable will be used automatically by the library
    });
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    
    if (!accessToken || !accessToken.token) {
      debug('Failed to retrieve access token from GoogleAuth on server');
      throw new Error('Failed to retrieve access token from GoogleAuth. Ensure GOOGLE_APPLICATION_CREDENTIALS is set correctly.');
    }
    debug('Successfully retrieved OAuth 2.0 access token on server');
    return accessToken.token;
  } catch (error) {
    debug('Error getting OAuth access token on server:', error);
    throw new Error(`Error getting OAuth access token: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Event handler for Hasura notifications
 * This route is automatically called by Hasura Event Trigger when a new record is created in the notifications table
 */
export const POST = hasyxEvent(async (payload: HasuraEventPayload) => {
  debug('Received notify event:', { 
    table: `${payload.table.schema}.${payload.table.name}`,
    operation: payload.event.op 
  });
  
  // Create Hasura client for backend operations
  const hasura = new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!, 
    secret: process.env.HASURA_ADMIN_SECRET!,
  });
  
  // Process the event
  try {
    const notification = payload.event.data.new;
    
    if (payload.event.op !== 'INSERT' || payload.table.name !== 'notifications') {
      debug('Ignoring event - not an insertion to notifications table');
      return { success: false, message: 'Unsupported event' };
    }
    
    debug('Processing notification:', notification);
    
    // Get permission information using GraphQL query
    const permissionResult = await hasura.v1({
      type: 'select',
      args: {
        table: { schema: 'public', name: 'notification_permissions' },
        columns: ['id', 'user_id', 'provider', 'device_token', 'device_info'],
        where: { id: { _eq: notification.permission_id } }
      }
    });
    
    if (!permissionResult || !permissionResult.length) {
      throw new Error('Permission not found');
    }
    const permissionData = permissionResult[0];
    
    // Get message information using GraphQL query
    const messageResult = await hasura.v1({
      type: 'select',
      args: {
        table: { schema: 'public', name: 'notification_messages' },
        columns: ['id', 'title', 'body', 'data'],
        where: { id: { _eq: notification.message_id } }
      }
    });
    
    if (!messageResult || !messageResult.length) {
      throw new Error('Message not found');
    }
    const messageData = messageResult[0];
    
    // Route by provider type
    let result;
    switch (permissionData.provider) {
      case 'firebase':
        debug('Sending via Firebase provider');
        const { sendFirebaseNotification } = await import('hasyx/lib/notify-firebase');
        result = await sendFirebaseNotification(permissionData, messageData, notification, getOAuthAccessTokenForServer);
        break;
      default:
        debug(`Unsupported provider: ${permissionData.provider}`);
        result = { success: false, message: `Unsupported provider: ${permissionData.provider}` };
    }
    
    // Update notification status
    await hasura.v1({
      type: 'update',
      args: {
        table: { schema: 'public', name: 'notifications' },
        where: { id: { _eq: notification.id } },
        _set: {
          status: result.success ? 'sent' : 'failed',
          error: result.success ? null : result.message,
          updated_at: new Date().toISOString()
        }
      }
    });
    
    return result;
  } catch (error) {
    debug('Error processing notification:', error);
    
    // Update status with error
    try {
      await hasura.v1({
        type: 'update',
        args: {
          table: { schema: 'public', name: 'notifications' },
          where: { id: { _eq: payload.event.data.new.id } },
          _set: {
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
            updated_at: new Date().toISOString()
          }
        }
      });
    } catch (updateError) {
      debug('Failed to update notification status:', updateError);
    }
    
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error sending notification'
    };
  }
}); 