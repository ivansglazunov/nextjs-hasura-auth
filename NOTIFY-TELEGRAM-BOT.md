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
    *   A new `users` record is created if one doesn't exist for the Telegram user ID.
    *   A corresponding `accounts` record is created, linking the Telegram user ID to the Hasyx user ID with `provider: 'telegram'`.
    *   A `notification_permissions` record is created with `provider: 'telegram_bot'` and `device_token` set to the user's Telegram `chat_id`. This enables sending direct notifications to the user via the bot.
2.  **Direct User Notifications**: Hasyx can send notifications directly to users via the Telegram bot using the `telegram_bot` provider in the notification system.
3.  **Admin Correspondence Group (Optional)**:
    *   You can configure an admin Telegram group where the bot forwards messages received from users.
    *   Replies made by admins in this group to the bot's forwarded messages can be relayed back to the original user by the bot.
    *   The bot may attempt to create topics in this group for each user to keep conversations organized (requires bot to be admin with topic management rights).

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

    # Optional: For Admin Correspondence Group
    # The Chat ID of the Telegram group where user DMs will be forwarded
    # and from where admins can reply.
    TELEGRAM_ADMIN_CHAT_ID="YOUR_ADMIN_GROUP_CHAT_ID" 
    # (e.g., -1001234567890 or @youradmingroupusername if public)
    ```
    The `npx hasyx assist` command will guide you through setting these up.

3.  **Set Webhook (Automatic or Manual)**:
    *   Hasyx relies on a webhook to receive updates from Telegram. The API route `app/api/telegram_bot/route.ts` (copied during `npx hasyx init`) handles these updates.
    *   You need to tell Telegram where to send these updates.
    *   **Automatic (Recommended via `npx hasyx deploy` or similar in future)**: A future deployment script might handle setting the webhook automatically.
    *   **Manual**: You can set the webhook by sending a GET request to the Telegram API (replace `YOUR_BOT_TOKEN` and `YOUR_WEBHOOK_URL`):
        `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_WEBHOOK_URL>/api/telegram_bot`
        *   `YOUR_WEBHOOK_URL` should be your publicly accessible application URL (e.g., your Vercel deployment URL like `https://your-project.vercel.app`).
        *   Make sure your `/api/telegram_bot` endpoint is reachable from the internet.

4.  **Admin Correspondence Group (Optional)**:
    *   If you want to use the admin correspondence feature:
        1.  Create a new Telegram group (or use an existing one).
        2.  Add your Telegram Bot (created above) to this group.
        3.  Promote the bot to an **administrator** in the group. Essential permissions include:
            *   Sending messages.
            *   Managing topics (if your group is a forum/topic group and you want per-user topics).
        4.  Obtain the **Chat ID** of this group. 
            *   You can add a bot like `@RawDataBot` or `@JsonDumpBot` to the group temporarily. When any message is sent, it will show group details including the ID (usually a negative number for groups, e.g., `-100xxxxxxxxxx`).
            *   If the group is public, you might be able to use its username (e.g., `@myadmingroup`).
        5.  Set this Chat ID as `TELEGRAM_ADMIN_CHAT_ID` in your `.env` file.

5.  **Bot Profile Picture (Optional but Recommended)**:
    *   The `npx hasyx assist` command (after configuring the bot token) or `npx hasyx assets` (if `TELEGRAM_BOT_TOKEN` is set) will attempt to set your bot's profile picture using the `public/logo.png` from your project.
    *   Ensure `public/logo.png` is your desired bot avatar.
    *   Alternatively, you can set the bot's profile picture manually via BotFather using the `/setuserpic` command.

## How it Works

*   **Incoming Updates**: Telegram sends updates (new messages, commands, etc.) to your `/api/telegram_bot` webhook.
*   **`processTelegramEvent` (`lib/telegram_bot.ts`)**: This function is the core handler.
    *   It parses the update.
    *   If it's a `/start` command from a new user, it performs the registration steps (creates `users`, `accounts`, `notification_permissions` records).
    *   If it's a DM from a user and `TELEGRAM_ADMIN_CHAT_ID` is set, it forwards the message to the admin group (potentially creating a topic).
    *   If it's a reply from an admin in the admin group to a bot-forwarded message, it relays the reply to the original user.
*   **Outgoing Notifications**: When a Hasyx notification is triggered for the `telegram_bot` provider:
    *   `lib/notify-telegram.ts` is used.
    *   It calls the Telegram `sendMessage` API to send the notification content to the user's `chat_id` (stored as `device_token` in `notification_permissions`).

## Customization

*   **Bot Commands**: You can extend `lib/telegram_bot.ts` to handle more commands (e.g., `/help`, `/settings`).
*   **Message Formatting**: Messages sent by the bot use Markdown by default. You can customize this.
*   **Interactive Components**: For more complex interactions, explore Telegram Bot API features like inline keyboards, buttons, etc., and integrate them into `lib/telegram_bot.ts` and your notification sending logic.
