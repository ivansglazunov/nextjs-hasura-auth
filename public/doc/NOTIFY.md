# Push Notifications

Push Notification System in Hasyx

Hasyx aims to provide a unified and extensible system for delivering push notifications across various platforms. The core idea is to manage notification permissions, message content, and delivery status centrally, while allowing different providers (like Firebase Cloud Messaging, Apple Push Notification service, Telegram, etc.) to handle the actual delivery to specific devices or services.

## Core Concepts

1.  **`Notification Permissions`**: Represents a user's consent to receive notifications on a specific device/platform. It stores:
    *   `user_id`: The user who granted permission.
    *   `provider`: The notification service used (e.g., `firebase`, `apn`, `telegram`).
    *   `device_token`: The unique token or identifier for the target device/client provided by the notification service.
    *   `device_info`: JSONB اطلاعاتเกี่ยวกับอุปกรณ์ (เบราว์เซอร์ ระบบปฏิบัติการ รุ่น ฯลฯ).

2.  **`Notification Messages`**: Contains the actual content of a notification. This allows reusing the same message content for multiple recipients or platforms. It stores:
    *   `title`: The title of the notification.
    *   `body`: The main text content of the notification.
    *   `data`: Optional JSONB for custom data to be sent with the notification (e.g., deep link URLs, action identifiers).
    *   `user_id`: The user who created/owns this message template (useful for targeted campaigns or user-generated notifications).

3.  **`Notifications`**: Represents an instance of a specific message being sent to a specific permission (device/platform). This table tracks the delivery process. It stores:
    *   `message_id`: Foreign key to `notification_messages`.
    *   `permission_id`: Foreign key to `notification_permissions`.
    *   `config`: Optional JSONB for provider-specific configuration for this particular delivery (e.g., notification sound, badge count, custom FCM options).
    *   `status`: The delivery status (e.g., `pending`, `sent`, `failed`, `delivered`, `read`).
    *   `error`: Stores any error message if the delivery failed.

## Workflow Overview

1.  **Client-Side Permission**: The client application (e.g., web browser, mobile app) requests notification permission from the user. For channel notifications, this is handled server-side by `npx hasyx assist` linking a Project User to a channel.
2.  **Token Registration**: If permission is granted (or configured for a channel), the client receives a device token (or channel ID is configured). This, along with user/project user and device/channel info, is stored in `notification_permissions`.
3.  **Sending a Notification**:
    *   An action (e.g., user interaction, scheduled task, admin panel) triggers the need to send a notification.
    *   A record is created in `notification_messages` (if a new message) or an existing message is used.
    *   One or more records are created in the `notifications` table, linking the message to the target `notification_permissions` (devices/users) and specifying any custom `config`.
4.  **Server-Side Processing (Event Trigger)**:
    *   An `INSERT` into the `notifications` table triggers a Hasura Event.
    *   The event webhook calls a Hasyx API endpoint (e.g., `/api/events/notify`).
5.  **Notification Dispatch**: The API endpoint:
    *   Retrieves the full message and permission details.
    *   Determines the `provider` from the permission (e.g., `firebase`, `telegram_bot`, `telegram_channel`).
    *   Calls the appropriate provider-specific function (e.g., `sendFirebaseNotification`, `sendTelegramNotification`, `sendTelegramChannelNotification`).
    *   The provider function sends the notification using the `device_token` and message content.
    *   Updates the `status` and `error` fields in the `notifications` table based on the delivery outcome.

## Platform Support Status

| Platform              | Status                        | Details / Notes                                     |
| --------------------- | ----------------------------- | --------------------------------------------------- |
| Web (Firebase FCM)    | ✅ Implemented                | [See NOTIFY-FIREBASE.md](NOTIFY-FIREBASE.md)        |
| Telegram Bot (DMs)    | ✅ Implemented                | [See NOTIFY-TELEGRAM-BOT.md](NOTIFY-TELEGRAM-BOT.md)| 
| Telegram Channel      | ✅ Implemented                | [See NOTIFY-TELEGRAM-CHANNEL.md](NOTIFY-TELEGRAM-CHANNEL.md) |
| Android (Firebase FCM)| 🚧 Planned                    | Will leverage FCM.                                  |
| iOS (APNs)            | 🚧 Planned                    | Will use Apple Push Notification service.             |
| Windows (WNS)         | ❓ To Be Determined / Planned | Windows Push Notification Services.                 |
| macOS (APNs)          | 🚧 Planned                    | Will use Apple Push Notification service.             |
| Linux (Desktop)       | ❓ To Be Determined / Planned | Might use FCM or other desktop notification systems.|

Legend:
*   ✅ Implemented: Basic functionality is in place.
*   🚧 Planned: Intended for future development.
*   ❓ To Be Determined: Feasibility and approach need further research.
