# Telegram Channel Notifications in Hasyx

This document describes how Hasyx integrates with Telegram Channels for sending project announcements and updates.

## Overview

Hasyx enables your project to send formatted messages (announcements, updates, etc.) directly to a designated Telegram Channel. This is useful for broadcasting information to your user base or community on Telegram.

The integration relies on:
- A Hasyx "Project User" identity (`NEXT_PUBLIC_PROJECT_USER_ID`) that acts as the conceptual sender of these channel messages within the Hasyx system.
- Your project's Telegram Bot, which must be an administrator in the target channel with permission to post messages.
- The Hasyx notification system, using a specific provider `telegram_channel`.

## Features

1.  **Project Announcements**: Easily send notifications from your Hasyx application to a specific Telegram Channel.
2.  **Centralized Project Identity**: Messages are associated with a defined "Project User" in Hasyx, allowing for consistent branding and potential future analytics on project communications.
3.  **Guided Setup via `npx hasyx assist`**:
    *   Assists in configuring the `NEXT_PUBLIC_PROJECT_USER_ID` environment variable, either by creating a new user in your Hasyx database or identifying an existing one.
    *   Provides instructions for creating a Telegram Channel and adding your bot as an administrator.
    *   Helps set the `TELEGRAM_CHANNEL_ID` environment variable (which can be the channel's username like `@mychannel` or its numerical ID like `-100xxxxxxxxxx`).
    *   Automatically creates the necessary `notification_permissions` record in your Hasura database. This record links your Project User to the specified Telegram Channel, enabling notifications of type `telegram_channel`.
    *   Optionally offers to update the Telegram Channel's name to match your project's name (from `package.json`) and set its profile picture using `public/logo.png` (requires the bot to have admin rights to change channel info).

## Setup

To enable Telegram Channel notifications, follow these steps:

1.  **Configure Telegram Bot**: First, ensure your Telegram Bot is fully configured as described in `NOTIFY-TELEGRAM-BOT.MD`. You must have `TELEGRAM_BOT_TOKEN` set in your environment variables.

2.  **Configure Project User (`NEXT_PUBLIC_PROJECT_USER_ID`)**:
    *   Run `npx hasyx assist`.
    *   The assistant will check for `NEXT_PUBLIC_PROJECT_USER_ID`. 
        *   If not found, it will offer to create a new user in your Hasyx `users` table (e.g., with name matching your project's name from `package.json`, a dummy email, and admin privileges within Hasyx). The ID of this new user will be set as `NEXT_PUBLIC_PROJECT_USER_ID`.
        *   If found, it will confirm if this is the correct user and offer to update its name and avatar (`public/logo.png`).
    *   This user ID is crucial as it represents the "sender" of messages to the channel within the Hasyx notification system.

3.  **Create Your Telegram Channel**:
    *   Open Telegram and create a new channel. You can make it public or private.
    *   Give it an initial name (e.g., "My Project Updates").

4.  **Add Your Bot as an Administrator to the Channel**:
    *   In your newly created Telegram Channel, go to Channel Info > Administrators > Add Admin.
    *   Search for your Telegram Bot (using its username) and add it as an administrator.
    *   Grant the bot at least the permission to **Post Messages**. For the `assist` command to also set the channel name and photo, the bot will need the "Change Channel Info" permission as well.

5.  **Obtain the Telegram Channel ID**:
    *   **For Public Channels**: If your channel has a public username (e.g., `t.me/my_project_channel`), its ID for the Telegram Bot API is usually the username prefixed with `@` (e.g., `@my_project_channel`).
    *   **For Private Channels**: The ID is a numerical value, typically starting with `-100`. To find it:
        1.  Send any message to your private channel.
        2.  Forward that message to a bot like `@JsonDumpBot` or `@RawDataBot`.
        3.  The bot will reply with JSON data. Look for the `chat.id` field associated with the forwarded message from your channel (e.g., `message.forward_from_chat.id`). This will be your channel's numerical ID.

6.  **Set Environment Variables**:
    *   Run `npx hasyx assist` again, or manually update your `.env` file. The assistant will prompt for `TELEGRAM_CHANNEL_ID` if not set.
    ```env
    # Should be set by the assist command or manually after identifying/creating the project user
    NEXT_PUBLIC_PROJECT_USER_ID="your_hasyx_project_user_uuid"

    # Your Telegram Bot Token (should already be set from bot setup)
    TELEGRAM_BOT_TOKEN="YOUR_TELEGRAM_BOT_API_TOKEN"

    # The ID or username of your Telegram Channel for announcements
    TELEGRAM_CHANNEL_ID="@your_channel_username_or_numerical_id" 
    ```

7.  **Automatic Notification Permission**: 
    *   During the `npx hasyx assist` process (specifically in the `configureTelegramChannel` step), if `TELEGRAM_CHANNEL_ID` and `NEXT_PUBLIC_PROJECT_USER_ID` are available, a `notification_permissions` record is automatically created in your Hasura database. This record will have:
        *   `user_id`: The value of `NEXT_PUBLIC_PROJECT_USER_ID`.
        *   `provider`: `'telegram_channel'`.
        *   `device_token`: The value of `TELEGRAM_CHANNEL_ID`.
        *   `device_info`: Includes basic info like `{ platform: 'telegram_channel', name: 'YourProjectName' }`.
    *   This permission record is what allows the notification system to target your channel.

8.  **Channel Branding (Optional via `assist`)**:
    *   The `npx hasyx assist` command, after configuring the channel ID, will ask if you want to attempt to update the channel's name to your project's name and set its profile picture using `public/logo.png`. This requires the bot to have the "Change Channel Info" admin permission in the channel.

## How it Works

1.  **Triggering a Notification for the Channel**:
    *   An event in your application (e.g., a new article published, a new product version released) decides a message should be sent to the project's Telegram Channel.
    *   You create a `notification_messages` record containing the title and body of the announcement.
    *   You then create a `notifications` record. Crucially, this record's `permission_id` must point to the specific `notification_permissions` record that was set up for the `telegram_channel` provider and your `NEXT_PUBLIC_PROJECT_USER_ID` (where `device_token` is the `TELEGRAM_CHANNEL_ID`).

2.  **Hasura Event and API Route**:
    *   The `INSERT` into the `notifications` table triggers a Hasura Event.
    *   This event calls the `/api/events/notify` webhook in your Hasyx application.

3.  **Notification Dispatch (`lib/notify.ts`)**:
    *   The `handleNotificationEvent` function receives the notification details.
    *   It identifies the `provider` as `telegram_channel` from the `notification_permissions` record.
    *   It then calls the `sendTelegramChannelNotification` function from `lib/notify-telegram-channel.ts`.

4.  **Message Posting (`lib/notify-telegram-channel.ts`)**:
    *   The `sendTelegramChannelNotification` function takes the message content and the `permission` details (which include the `TELEGRAM_CHANNEL_ID` as `device_token`).
    *   It uses your `TELEGRAM_BOT_TOKEN` to make a `sendMessage` API call to the Telegram Bot API, targeting the specified `TELEGRAM_CHANNEL_ID`.
    *   The message is posted to your channel.

## Use Cases

*   **Broadcasting News**: Announce new blog posts, articles, or company news.
*   **Product Updates**: Inform your community about new features, releases, or bug fixes.
*   **System Announcements**: Notify users of scheduled maintenance, service disruptions, or important system-wide changes.
*   **Community Engagement**: Share milestones, upcoming events, or other information relevant to your project's followers on Telegram.

By using this system, you can maintain a direct line of communication for official project announcements on Telegram, managed through your Hasyx application's notification infrastructure.
