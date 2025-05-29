# Environment Variables Documentation

This document describes all environment variables used in the Hasyx project.

## Core Database & GraphQL

### NEXT_PUBLIC_HASURA_GRAPHQL_URL
- [HASYX.md#hasura-setup](HASYX.md#hasura-setup) ✅
- description: The public URL for your Hasura GraphQL endpoint. Used by client-side components and server-side operations to connect to the GraphQL API.
- assist-hasura ✅

### HASURA_ADMIN_SECRET
- [AUTH.md#hasura-configuration](AUTH.md#hasura-configuration) ✅
- description: Admin secret for authenticating with Hasura GraphQL engine with full permissions. Required for schema modifications and admin operations.
- assist-hasura ✅

### HASURA_JWT_SECRET
- [AUTH.md#jwt-configuration](AUTH.md#jwt-configuration) ✅
- description: JSON Web Token secret configuration for Hasura JWT authentication. Should be a JSON object with type and key for JWT verification.
- assist-hasura ✅

### HASURA_EVENT_SECRET
- [lib/events.ts#security](lib/events.ts) ✅
- description: Secret used to verify incoming webhook events from Hasura event triggers. Ensures events are authentic. Required for secure event trigger handling in production.
- assist-hasura ✅

## Authentication & OAuth

### NEXTAUTH_SECRET
- [AUTH.md#nextauth-configuration](AUTH.md#nextauth-configuration) ✅
- description: Secret key used by NextAuth.js for session encryption and signing. Should be a random string in production.
- assist-auth ✅

### TEST_TOKEN
- [AUTH.md#test-token](AUTH.md#test-token) ✅
- description: Token used for testing authentication in non-production environments. Used to bypass OAuth flows during development.
- assist-auth ✅

### GOOGLE_CLIENT_ID
- [AUTH.md#google-oauth](AUTH.md#google-oauth) ✅
- description: Google OAuth application client ID for Google Sign-In integration.
- assist-oauth ✅

### GOOGLE_CLIENT_SECRET
- [AUTH.md#google-oauth](AUTH.md#google-oauth) ✅
- description: Google OAuth application client secret for Google Sign-In integration.
- assist-oauth ✅

### YANDEX_CLIENT_ID
- [lib/assist-oauth.ts](lib/assist-oauth.ts) ✅
- description: Yandex OAuth application client ID for Yandex authentication integration.
- assist-oauth ✅

### YANDEX_CLIENT_SECRET
- [lib/assist-oauth.ts](lib/assist-oauth.ts) ✅
- description: Yandex OAuth application client secret for Yandex authentication integration.
- assist-oauth ✅

### GITHUB_ID
- [AUTH.md#github-oauth](AUTH.md#github-oauth) ✅
- description: GitHub OAuth application client ID for GitHub Sign-In integration.
- assist-oauth ✅

### GITHUB_SECRET
- [AUTH.md#github-oauth](AUTH.md#github-oauth) ✅
- description: GitHub OAuth application client secret for GitHub Sign-In integration.
- assist-oauth ✅

### FACEBOOK_CLIENT_ID
- [lib/assist-oauth.ts](lib/assist-oauth.ts) ✅
- description: Facebook OAuth application client ID for Facebook Login integration.
- assist-oauth ✅

### FACEBOOK_CLIENT_SECRET
- [lib/assist-oauth.ts](lib/assist-oauth.ts) ✅
- description: Facebook OAuth application client secret for Facebook Login integration.
- assist-oauth ✅

### VK_CLIENT_ID
- [lib/assist-oauth.ts](lib/assist-oauth.ts) ✅
- description: VKontakte OAuth application client ID for VK authentication integration.
- assist-oauth ✅

### VK_CLIENT_SECRET
- [lib/assist-oauth.ts](lib/assist-oauth.ts) ✅
- description: VKontakte OAuth application client secret for VK authentication integration.
- assist-oauth ✅

## AI & External APIs

### OPENROUTER_API_KEY
- [OPENROUTER.md#api-key-setup](OPENROUTER.md#api-key-setup) ✅
- description: API key for OpenRouter service used for AI model interactions. Required for AI features including code generation and chat functionality.
- assist-ai ✅

### REACT_APP_OPENROUTER_API_KEY
- [AI.md#react-integration](AI.md#react-integration) ❌
- description: OpenRouter API key for React applications. Alternative naming convention for client-side AI integration.
- assist-ai ❌

### EXTERNAL_API_KEY
- [OPENROUTER.md#external-api](OPENROUTER.md#external-api) ❌
- description: Generic external API key placeholder used in examples for third-party service integrations.
- assist-external ❌

## Telegram Integration

### TELEGRAM_BOT_TOKEN
- [TELEGRAM-BOT.md#bot-setup](TELEGRAM-BOT.md#bot-setup) ✅
- description: Bot token from BotFather for Telegram bot functionality. Required for Telegram notifications and bot interactions.
- assist-telegram ✅

### TELEGRAM_ADMIN_CHAT_ID
- [TELEGRAM-BOT.md#admin-configuration](TELEGRAM-BOT.md#admin-configuration) ✅
- description: Telegram chat ID for admin notifications and bot management commands.
- assist-telegram ✅

### NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
- [TELEGRAM-BOT.md#public-integration](TELEGRAM-BOT.md#public-integration) ✅
- description: Public Telegram bot username for client-side integrations and Telegram Login widget.
- assist-telegram ✅

## Firebase Integration

### NEXT_PUBLIC_FIREBASE_API_KEY
- [NOTIFY-FIREBASE.md#firebase-setup](NOTIFY-FIREBASE.md#firebase-setup) ✅
- description: Firebase project API key for client-side Firebase SDK initialization.
- assist-firebase ✅

### NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
- [NOTIFY-FIREBASE.md#firebase-setup](NOTIFY-FIREBASE.md#firebase-setup) ✅
- description: Firebase authentication domain for Firebase Auth configuration.
- assist-firebase ✅

### NEXT_PUBLIC_FIREBASE_PROJECT_ID
- [NOTIFY-FIREBASE.md#firebase-setup](NOTIFY-FIREBASE.md#firebase-setup) ✅
- description: Firebase project ID for project identification in Firebase services.
- assist-firebase ✅

### NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
- [NOTIFY-FIREBASE.md#firebase-setup](NOTIFY-FIREBASE.md#firebase-setup) ✅
- description: Firebase Cloud Storage bucket name for file storage operations.
- assist-firebase ✅

### NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
- [NOTIFY-FIREBASE.md#firebase-setup](NOTIFY-FIREBASE.md#firebase-setup) ✅
- description: Firebase Cloud Messaging sender ID for push notification configuration.
- assist-firebase ✅

### NEXT_PUBLIC_FIREBASE_APP_ID
- [NOTIFY-FIREBASE.md#firebase-setup](NOTIFY-FIREBASE.md#firebase-setup) ✅
- description: Firebase application ID for app identification in Firebase console.
- assist-firebase ✅

### NEXT_PUBLIC_FIREBASE_VAPID_KEY
- [NOTIFY-FIREBASE.md#vapid-setup](NOTIFY-FIREBASE.md#vapid-setup) ✅
- description: VAPID key for Firebase Cloud Messaging web push notifications.
- assist-firebase ✅

## Email Services

### RESEND_API_KEY
- [README.md#resend-integration](README.md) ✅
- description: API key for Resend email service used for transactional emails and notifications. When set, enables email verification functionality.
- assist-resend ✅

## Application URLs

### NEXT_PUBLIC_MAIN_URL
- [lib/events.ts#webhook-urls](lib/events.ts) ✅
- description: Main production URL of the application. Used for absolute URLs in emails, webhooks, and external integrations. Required for production deployment.
- assist-deployment ✅

### NEXT_PUBLIC_BASE_URL
- [lib/url.ts](lib/url.ts) ✅
- description: Base URL for the application. Fallback for NEXT_PUBLIC_MAIN_URL and used for local development configuration.
- assist-deployment ✅

### NEXT_PUBLIC_API_URL
- [lib/url.ts](lib/url.ts) ✅
- description: API endpoint URL for external API calls. Used when API is hosted separately from the main application.
- assist-api ✅

### NEXT_PUBLIC_APP_URL
- [TBANK.md#payment-configuration](TBANK.md) ✅
- description: Application URL used specifically for payment redirects and callback URLs in TBank integration and other payment systems.
- assist-payments ✅

### VERCEL_URL
- [lib/vercel.ts](lib/vercel.ts) ✅
- description: Automatically set by Vercel deployment. Contains the deployment URL for the current build. Used as fallback for main URL configuration.
- assist-vercel ✅

## Build & Configuration

### NEXT_PUBLIC_BUILD_TARGET
- [lib/build-client.ts](lib/build-client.ts) ✅
- description: Target platform for the build process. Can be 'web', 'capacitor', 'client' or other platform-specific values for multi-platform builds.
- assist-build ✅

### NEXT_PUBLIC_BASE_PATH
- [next.config.ts](next.config.ts) ✅
- description: Base path for Next.js application when deployed in a subdirectory. Used for custom routing configurations.
- assist-build ✅

### NEXT_PUBLIC_WS
- [HASYX.md#websocket-configuration](HASYX.md#websocket-configuration) ✅
- description: WebSocket configuration flag. Set to '0' to disable WebSockets and use polling for subscriptions.
- assist-websockets ✅

### NEXT_PUBLIC_HID_NAMESPACE
- [HID.md#namespace-configuration](HID.md#namespace-configuration) ✅
- description: Default namespace for HID (Hasyx ID) system. Used for hierarchical identifier generation.
- assist-hid ✅

## Notifications

### NEXT_PUBLIC_NOTIFICATION_ICON
- [lib/notify-firebase.ts](lib/notify-firebase.ts) ✅
- description: URL path to the icon used in push notifications. Defaults to '/favicon.ico'.
- assist-notifications ✅

### NEXT_PUBLIC_APP_NAME
- [lib/assist-env.ts](lib/assist-env.ts) ✅
- description: Display name of the application used in notifications and branding.
- assist-branding ✅

## Database Connection

### POSTGRES_URL
- [lib/pg.ts](lib/pg.ts) ✅
- description: PostgreSQL connection URL for direct database access. Used by PG client for raw SQL operations.
- assist-database ✅

### PGHOST
- [lib/pg.ts](lib/pg.ts) ✅
- description: PostgreSQL host address for database connections.
- assist-database ✅

### PGPORT
- [lib/pg.ts](lib/pg.ts) ✅
- description: PostgreSQL port number for database connections. Defaults to 5432.
- assist-database ✅

### PGUSER
- [lib/pg.ts](lib/pg.ts) ✅
- description: PostgreSQL username for database authentication.
- assist-database ✅

### PGPASSWORD
- [lib/pg.ts](lib/pg.ts) ✅
- description: PostgreSQL password for database authentication.
- assist-database ✅

### PGDATABASE
- [lib/pg.ts](lib/pg.ts) ✅
- description: PostgreSQL database name to connect to.
- assist-database ✅

### PGSSLMODE
- [lib/pg.ts](lib/pg.ts) ✅
- description: PostgreSQL SSL mode configuration. Controls SSL connection requirements.
- assist-database ✅

## Development & Testing

### NODE_ENV
- [lib/auth-options.ts](lib/auth-options.ts) ✅
- description: Node.js environment mode. Set to 'production', 'development', or 'test' to control application behavior and authentication options.
- assist-development ✅

### DEBUG
- [CONTRIBUTING.md#debug-configuration](CONTRIBUTING.md#debug-configuration) ✅
- description: Debug namespace configuration for controlling debug output. Use 'hasyx*' to enable all Hasyx debug logs.
- assist-debug ✅

### HASYX_DEBUG
- [lib/hasyx.tsx](lib/hasyx.tsx) ✅
- description: Hasyx-specific debug flag. Set to '1' to enable detailed debugging output for Hasyx operations including debug log insertion.
- assist-debug ✅

### JEST_LOCAL
- [lib/hasura.test.ts](lib/hasura.test.ts) ✅
- description: Jest testing flag to skip integration tests during local development. Set to '1' to skip real database tests.
- assist-testing ✅

### TERM_THEME
- [MARKDOWN-TERMINAL.md#terminal-theming](MARKDOWN-TERMINAL.md#terminal-theming) ✅
- description: Terminal theme configuration. Set to 'light' for light terminal themes in markdown terminal component.
- assist-terminal ✅

### npm_package_name
- [lib/ask.ts](lib/ask.ts) ✅
- description: Automatically set by npm. Contains the name of the current package from package.json. Used in AI system prompts.
- assist-npm ✅

## Shell Environment

### SHELL
- [lib/cli-hasyx.ts](lib/cli-hasyx.ts) ✅
- description: Default shell path for terminal operations. Defaults to '/bin/bash' if not set. Used by terminal emulation system.
- assist-terminal ✅ 