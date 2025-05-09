import Debug from './debug';
import { NotificationPermission, NotificationMessage, Notification } from './notify';

const debug = Debug('notify:firebase');

// Interface for Firebase configuration
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  vapidKey: string;
}

// Function to send notification through Firebase Cloud Messaging (HTTP v1 API)
export async function sendFirebaseNotification(
  permission: NotificationPermission,
  message: NotificationMessage,
  notification: Notification,
  getAccessToken: () => Promise<string>
): Promise<{ success: boolean; message?: string }> {
  try {
    debug('Starting notification delivery through Firebase (HTTP v1)');

    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) {
      debug('Firebase Project ID (NEXT_PUBLIC_FIREBASE_PROJECT_ID) not configured');
      throw new Error('Firebase Project ID not configured');
    }

    // Get OAuth 2.0 access token using the provided function
    const accessToken = await getAccessToken();

    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    };

    // Prepare message for FCM HTTP v1 API
    const fcmPayload = {
      message: {
        token: permission.device_token,
        notification: { // Basic notification structure
          title: message.title,
          body: message.body,
        },
        data: { // Custom data payload
          ...message.data,
          ...notification.config,
          notificationId: notification.id,
          messageId: message.id
        },
        webpush: { // Web push specific configuration
          notification: {
            // icon is often best handled on the client service worker for web push
            // but can be specified here too.
            icon: process.env.NEXT_PUBLIC_NOTIFICATION_ICON || '/favicon.ico',
            // other webpush specific notification fields if needed
          },
          fcm_options: {
            link: process.env.NEXT_PUBLIC_BASE_URL || 'https://your-domain.com' // Click action URL
          }
        }
        // Add android, apns specific configurations if needed in the future
      }
    };

    debug('Sending FCM v1 request to:', fcmEndpoint, 'for token:', permission.device_token);

    const response = await fetch(fcmEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(fcmPayload)
    });

    const responseText = await response.text(); // Read text first for better error logging
    debug('FCM v1 response status:', response.status);
    debug('FCM v1 response text:', responseText);

    if (!response.ok) {
      debug('FCM v1 response error:', { status: response.status, text: responseText });
      // Try to parse error for more details
      try {
        const errorJson = JSON.parse(responseText);
        if (errorJson.error && errorJson.error.message) {
          throw new Error(`Firebase v1 API error: ${errorJson.error.message} (Status: ${response.status})`);
        }
      } catch (e) {
        // Ignore parsing error, use original text
      }
      throw new Error(`Firebase v1 API responded with error: ${response.status} ${responseText}`);
    }

    const result = JSON.parse(responseText); // Parse after checking ok
    debug('FCM v1 response JSON:', result);

    // FCM v1 success response is just the message name, e.g., "projects/your-project-id/messages/0:1500415314453727%31bd1c7431bd1c74"
    // It doesn't have a 'success' or 'failure' count directly like the legacy API.
    // A 200 OK with a message name in response body indicates success.
    if (result.name) {
      return { success: true };
    } else {
      // This case might indicate an unexpected successful response format
      throw new Error('Firebase v1 API did not return a message name, though status was OK.');
    }

  } catch (error) {
    debug('Error sending Firebase v1 notification:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown Firebase v1 error'
    };
  }
}

// Get Firebase configuration from environment variables
export function getFirebaseConfig(): FirebaseConfig | null {
  if (
    !process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    !process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    !process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    !process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
    !process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
    !process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
  ) {
    return null;
  }
  
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
  };
} 