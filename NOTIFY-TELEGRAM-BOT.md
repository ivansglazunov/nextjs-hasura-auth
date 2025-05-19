# Web Push Notifications with Firebase Cloud Messaging (FCM) in Hasyx

This document details how Hasyx implements web push notifications using Firebase Cloud Messaging (FCM) via the modern FCM HTTP v1 API.

## How It Works: End-to-End Flow

1.  **Client-Side Setup (`components/notify.tsx`):
    *   **Provider (`NotificationProvider`)**: When your application loads, this provider initializes.
        *   It checks if the browser supports push notifications.
        *   It attempts to load Firebase client-side configuration using `getFirebaseConfig()` (which reads `NEXT_PUBLIC_FIREBASE_*` environment variables).
        *   If supported and configured, it dynamically imports the Firebase SDK (`firebase/app` and `firebase/messaging`).
        *   It initializes the Firebase app and gets a `Messaging` instance.
        *   It sets up an `onMessage` listener to handle incoming messages when the app is in the foreground (these are not system notifications but can be used to update the UI or show an in-app notification).
    *   **User Interaction (`NotificationCard`)**: Displays UI for managing notification permissions.
        *   **Requesting Permission**: When the user clicks "Enable Notifications":
            1.  `Notification.requestPermission()` is called to ask the browser for permission.
            2.  If granted, `getToken(messaging, { vapidKey: ... })` is called to get a unique FCM registration token (device token) for this browser instance.
            3.  This `deviceToken`, along with `userId` (from `useSession`) and device information (from `getDeviceInfo()`), is saved to your `notification_permissions` table in Hasura via a GraphQL mutation.
        *   **Sending a Test Notification**: When the user fills in the title/body and clicks "Send Test Notification":
            1.  A new record is created in `notification_messages` (with title, body, data, `userId`).
            2.  A new record is created in `notifications` linking the new message to the current device's permission (`permission_id`) with status `pending`.

2.  **Backend Processing (Hasura Event & API Route):
    *   **Hasura Event Trigger (`events/notify.json`)**: Configured to listen for `INSERT` operations on the `public.notifications` table.
    *   **API Route (`app/api/events/notify/route.ts`)**: This endpoint is called by the Hasura Event Trigger.
        1.  It receives the payload of the newly inserted `notifications` record.
        2.  It uses the `message_id` and `permission_id` from the payload to query Hasura (as admin) for the full `notification_messages` and `notification_permissions` details.
        3.  It checks the `provider` field in `notification_permissions`. If it's `firebase`, it calls `sendFirebaseNotification()` from `lib/notify-firebase.ts`.

3.  **FCM v1 API Interaction (`lib/notify-firebase.ts`):
    *   `sendFirebaseNotification(permission, message, notification)` is called:
        1.  **Authentication**: Calls `getOAuthAccessToken()`.
            *   `getOAuthAccessToken()` uses the `google-auth-library`.
            *   This library automatically looks for the `GOOGLE_APPLICATION_CREDENTIALS` environment variable, which should point to the path of your Firebase Admin SDK service account JSON file.
            *   It requests an OAuth 2.0 access token from Google with the `https://www.googleapis.com/auth/firebase.messaging` scope.
        2.  **API Request**: Constructs a POST request to the FCM HTTP v1 endpoint: `https://fcm.googleapis.com/v1/projects/YOUR_PROJECT_ID/messages:send`.
            *   The `Authorization` header is set to `Bearer <YOUR_ACCESS_TOKEN>`.
            *   The payload includes:
                *   `message.token`: The `device_token` of the target browser.
                *   `message.notification`: Basic title and body.
                *   `message.data`: Any custom data.
                *   `message.webpush`: Web-specific configurations like `icon` and `fcm_options.link` (click action).
        3.  **Response Handling**: Sends the request and processes the response.
            *   A successful send (HTTP 200 OK with a message name in the response) updates the `notifications` table status to `sent`.
            *   Any errors from FCM or during token acquisition update the status to `failed` and log the error message in the `notifications` table.

4.  **Notification Delivery**: If the FCM API call is successful, FCM attempts to deliver the push notification to the user's browser.
    *   If the browser is online and the Service Worker is active, the notification should appear as a system notification.
    *   Clicking the notification will typically open the URL specified in `fcm_options.link`.

## Prerequisites & Setup

To use Firebase web push notifications with Hasyx, you need to configure the following:

1.  **Firebase Project**:
    *   Create a project at [Firebase Console](https://console.firebase.google.com/).
    *   Add a **Web app** to your project (Project Settings > General > Your apps > Add app).
    *   Enable **Cloud Messaging API** (usually enabled by default for new projects).

2.  **Service Account (for Server-Side Authentication)**:
    *   In Firebase Console: Project Settings > Service accounts.
    *   Click "Generate new private key" and download the JSON file.
    *   **Store this file securely.** Do not commit it to your repository.
    *   Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable in your server environment (e.g., Vercel project settings) to the *full path* to this JSON file if running locally, or paste the *contents* of the JSON file directly into the environment variable value if your hosting provider supports that (like Vercel).
        *   You can use the `npx hasyx assist` command to help set up this and other environment variables.

3.  **Web Push Certificate (VAPID Key)**:
    *   In Firebase Console: Project Settings > Cloud Messaging > Web configuration (at the bottom).
    *   Under "Web Push certificates", click "Generate key pair" if one doesn't exist.
    *   Copy the Key pair string. This is your VAPID key.

4.  **Environment Variables**: Set the following in your `.env` file (and in your Vercel project settings):

    ```env
    # --- Firebase Service Account ---
    # Path to your Firebase service account JSON file (for server-side logic)
    # On Vercel, you might paste the JSON content directly into the environment variable.
    # GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/secure/service-account-file.json

    # --- Firebase Web App Configuration (for client-side SDK) ---
    NEXT_PUBLIC_FIREBASE_PROJECT_ID="YOUR_FIREBASE_PROJECT_ID"
    NEXT_PUBLIC_FIREBASE_API_KEY="YOUR_WEB_API_KEY"
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="YOUR_PROJECT_ID.firebaseapp.com"
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="YOUR_PROJECT_ID.appspot.com"
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_MESSAGING_SENDER_ID"
    NEXT_PUBLIC_FIREBASE_APP_ID="YOUR_WEB_APP_ID"
    NEXT_PUBLIC_FIREBASE_VAPID_KEY="YOUR_VAPID_KEY_PAIR_STRING"

    # --- Notification Appearance & Behavior (Optional) ---
    # Default icon for notifications (path relative to public directory)
    # NEXT_PUBLIC_NOTIFICATION_ICON=/icons/icon-192x192.png
    # Default URL to open when a notification is clicked
    # NEXT_PUBLIC_BASE_URL=https://your-app.com
    ```

    *   The `npx hasyx assist` command can help guide you through setting many of these variables.

5.  **Install Dependencies**:
    *   `firebase` (for client-side SDK)
    *   `google-auth-library` (for server-side OAuth token generation)
    These are typically installed when you initialize Hasyx or follow the setup steps.

## Customizing Notifications

The content and behavior of notifications can be customized:

*   **Basic Content (`message.notification`)**: `title`, `body` are standard.
*   **Icon (`message.webpush.notification.icon`)**: Path to an image file for the notification icon. Best practice is often to handle this in your client-side Firebase service worker (`firebase-messaging-sw.js`) for more control, but it can also be set here.
*   **Click Action (`message.webpush.fcm_options.link`)**: The URL opened when the user clicks the notification.
*   **Custom Data (`message.data`)**: You can send arbitrary key-value pairs. This data is available to your client-side service worker when a notification is received, allowing for custom client-side logic (e.g., opening a specific page, performing an action).

### Advanced FCM Options

The FCM HTTP v1 API offers many more options for customizing notifications across different platforms (Web, Android, iOS). You can extend the `fcmPayload` in `lib/notify-firebase.ts` to include these.

*   **Webpush specific options**: Refer to [FCM Documentation: WebpushConfig](https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages#WebpushConfig).
    *   Custom actions with buttons.
    *   Badges, sounds, vibration patterns (browser/OS dependent).
*   **Android specific options**: [FCM Documentation: AndroidConfig](https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages#AndroidConfig).
*   **APNs specific options (for iOS via FCM)**: [FCM Documentation: ApnsConfig](https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages#ApnsConfig).

To implement these, you would modify the `fcmPayload.message` object in `lib/notify-firebase.ts` to include the relevant platform-specific configuration blocks, potentially driven by the `notification.config` JSONB field from your database.

## Client-Side Service Worker (`firebase-messaging-sw.js`)

For web push notifications to be received when your app tab is not active or closed, a Firebase service worker is required. Typically, you create a `firebase-messaging-sw.js` file in your `public` directory.

**Example `public/firebase-messaging-sw.js`:**

```javascript
// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase Messaging here, other Firebase Runtimes
// are not available in the service worker.
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in
// your app's Firebase config object.
// TODO: Replace with your actual Firebase config
const firebaseConfig = {
  apiKey: "YOUR_WEB_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_FIREBASE_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_WEB_APP_ID"
};

firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging so that it can handle background messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  // Customize notification here
  const notificationTitle = payload.notification?.title || 'New Message';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: payload.notification?.icon || '/favicon.ico',
    data: payload.data // Pass along data for click events
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Optional: Handle notification clicks
self.addEventListener('notificationclick', function(event) {
  console.log('[firebase-messaging-sw.js] Notification click Received.', event.notification);
  event.notification.close();

  // Example: Open a link from the data payload or a default link
  const clickLink = event.notification.data?.link || '/'; 

  event.waitUntil(
    clients.matchAll({ type: "window" }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url == clickLink && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(clickLink);
      }
    })
  );
});
```

**Important**:
*   Replace placeholder values in `firebaseConfig` within `firebase-messaging-sw.js` with your actual Firebase project configuration values (the same `NEXT_PUBLIC_` values, but without `NEXT_PUBLIC_` prefix and directly in the script).
*   This service worker file needs to be accessible at the root of your site (e.g., `https://your-app.com/firebase-messaging-sw.js`). The Firebase SDK on the client will register it.

By following these steps and understanding the flow, you can effectively manage and send web push notifications using Firebase FCM v1 within your Hasyx application.

# Telegram Bot Integration in Hasyx

This document outlines how Hasyx integrates with Telegram Bots for user interaction and notifications.

## Features

1.  **User Registration on `/start`**: When a user first interacts with the bot by sending the `/start` command:
    *   The bot registers the user in your Hasyx application.
    *   A `notification_permissions` record is created with `provider: 'telegram_bot'` and `device_token` set to the user's Telegram `chat_id`. This enables sending direct notifications to the user via the bot.
2.  **Direct User Notifications**: Hasyx can send notifications directly to users via the Telegram bot using the `telegram_bot` provider in the notification system.
3.  **AI Responses**: If configured with an `OPENROUTER_API_KEY`, the bot can respond to user messages using an AI model.

## Setup

1.  **Create a Telegram Bot**:
    *   Open Telegram and search for "BotFather".
    *   Send `/start` to BotFather.
    *   Send `/newbot` and follow the prompts to choose a name (e.g., "My Project Bot") and a username (e.g., `myproject_bot`).
    *   BotFather will provide you with an **API Token**. Keep this token secure.

2.  **Configure Environment Variables**:
    Add the following to your `.env` file:
    ```env
    # Required for Telegram Bot functionality
    TELEGRAM_BOT_TOKEN="YOUR_TELEGRAM_BOT_API_TOKEN"

    # Optional: For AI responses via OpenRouter
    OPENROUTER_API_KEY="YOUR_OPENROUTER_API_KEY"
    # Optional: Custom pre-prompt for the AI for Telegram interactions
    TELEGRAM_AI_PREPROMPT="You are a very helpful assistant."
    ```
    The `npx hasyx assist` command can guide you through setting `TELEGRAM_BOT_TOKEN`.

3.  **Set Webhook**:
    *   Hasyx relies on a webhook to receive updates from Telegram. The API route `app/api/telegram_bot/route.ts` handles these updates.
    *   You need to tell Telegram where to send these updates.
    *   **Manual**: You can set the webhook by sending a GET request to the Telegram API (replace `YOUR_BOT_TOKEN` and `YOUR_WEBHOOK_URL`):
        `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_WEBHOOK_URL>/api/telegram_bot`
        *   `YOUR_WEBHOOK_URL` should be your publicly accessible application URL (e.g., your Vercel deployment URL like `https://your-project.vercel.app`).
        *   Make sure your `/api/telegram_bot` endpoint is reachable from the internet.

4.  **Bot Profile Picture (Optional but Recommended)**:
    *   The `npx hasyx assist` command (after configuring the bot token) or `npx hasyx assets` (if `TELEGRAM_BOT_TOKEN` is set) will attempt to set your bot's profile picture using the `public/logo.png` from your project.
    *   Ensure `public/logo.png` is your desired bot avatar.
    *   Alternatively, you can set the bot's profile picture manually via BotFather using the `/setuserpic` command.

## How it Works

*   **Incoming Updates**: Telegram sends updates (new messages, commands, etc.) to your `/api/telegram_bot` webhook.
*   **Route Handler (`app/api/telegram_bot/route.ts`)**: This Next.js route parses the incoming request.
    *   It initializes a Hasyx client for database operations (like user registration).
    *   It sets up a processor for AI responses (`defaultGetAiResponse`) if `OPENROUTER_API_KEY` is configured.
    *   It then calls `handleTelegramWebhook` from `lib/telegram-handler.ts`.
*   **Webhook Handler (`lib/telegram-handler.ts`)**:
    *   Calls `processTelegramEvent` (`lib/telegram-bot.ts`) for core event processing.
    *   If the event is a user message eligible for AI, it calls the `getAiResponse` processor.
    *   The AI response (if any) is sent back to the user via `sendTelegramMessage`.
*   **Core Event Processor (`lib/telegram-bot.ts` -> `processTelegramEvent`)**:
    *   Parses the update.
    *   If it's a `/start` command from a new user, it performs the registration steps (creates/updates `notification_permissions` record for the user with their `chat_id`).
    *   Other messages are generally passed through for potential AI handling.
*   **AI Response Processor (`app/api/telegram_bot/route.ts` -> `defaultGetAiResponse`)**:
    *   Constructs a prompt using `TELEGRAM_AI_PREPROMPT`.
    *   Calls the `ask` function from `lib/ask.ts` (which interacts with OpenRouter).
    *   Returns the AI's textual response.
*   **Outgoing Notifications**: When a Hasyx notification is triggered for the `telegram_bot` provider:
    *   `lib/notify-telegram.ts` is used.
    *   It calls the Telegram `sendMessage` API to send the notification content to the user's `chat_id` (stored as `device_token` in `notification_permissions`).

## Customization

*   **Bot Commands**: You can extend `lib/telegram_bot.ts` to handle more commands (e.g., `/help`, `/settings`).
*   **AI Behavior**: Modify `TELEGRAM_AI_PREPROMPT` to change the AI's persona or instructions. For more advanced AI logic, you can customize or replace `defaultGetAiResponse`.
*   **Message Formatting**: Messages sent by the bot use Markdown by default. You can customize this in `sendTelegramMessage` or within the notification sending logic.
