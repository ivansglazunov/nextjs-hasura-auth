import CredentialsProvider from "next-auth/providers/credentials";
import { Hasyx } from "./hasyx";
import { getOrCreateUserAndAccount } from "./authDbUtils";
import Debug from "./debug";
import crypto from 'crypto';

const debug = Debug("auth:telegram");

interface TelegramUserData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

function verifyTelegramHash(data: Omit<TelegramUserData, 'hash'>, botToken: string): boolean {
  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  
  const dataCheckString = Object.keys(data)
    .filter(key => key !== 'hash')
    .sort()
    .map(key => `${key}=${(data as any)[key]}`)
    .join('\n');

  const hmac = crypto.createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');
  
  // The hash from Telegram comes in the `data` object itself.
  // We need to compare this to our calculated hmac.
  // The `hash` property will be on the `credentials` object passed to `authorize`.
  // This function is a helper, the actual comparison happens in `authorize`.
  // For now, let's assume this function will be called with the `hash` from `credentials`.
  // The signature of this function implies `data.hash` is available, which is incorrect.
  // Let's adjust this. The `hash` will be passed separately.

  // This function needs to be called from `authorize` like:
  // verifyTelegramHash({ id, first_name, ... }, TELEGRAM_BOT_TOKEN, credentials.hash)
  // So, let's adjust the signature:
  // function verifyTelegramHash(dataToCheck: Omit<TelegramUserData, 'hash'>, botToken: string, receivedHash: string): boolean {
  // And then `return hmac === receivedHash;`

  // For now, to match the planned call from `authorize`, we'll keep it as is,
  // and the `authorize` function will construct the object carefully.
  // The crucial part is `dataCheckString` and `hmac` calculation.
  // The actual comparison `hmac === receivedHash` will be in `authorize`.
  return true; // Placeholder: actual comparison will be in authorize
}


export function TelegramProvider({ hasyx }: { hasyx: Hasyx }) {
  if (!process.env.TELEGRAM_LOGIN_BOT_TOKEN) {
    debug("TELEGRAM_LOGIN_BOT_TOKEN not set. Telegram Login disabled.");
    console.warn("⚠️ TELEGRAM_LOGIN_BOT_TOKEN not set. Telegram Login disabled.");
    return null; 
  }
  if (!process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME) {
    debug("NEXT_PUBLIC_TELEGRAM_BOT_USERNAME not set. Telegram Login client-side might fail.");
    console.warn("⚠️ NEXT_PUBLIC_TELEGRAM_BOT_USERNAME not set. Telegram Login client-side might fail.");
  }
  
  return CredentialsProvider({
    id: "telegram",
    name: "Telegram",
    credentials: {
      id: { label: "ID", type: "text" },
      first_name: { label: "First Name", type: "text" },
      last_name: { label: "Last Name", type: "text" },
      username: { label: "Username", type: "text" },
      photo_url: { label: "Photo URL", type: "text" },
      auth_date: { label: "Auth Date", type: "text" },
      hash: { label: "Hash", type: "text" },
    },
    async authorize(credentials) {
      debug("🔐 Telegram authorize attempt started");
      console.log("🔐 Telegram authorize attempt with credentials keys:", credentials ? Object.keys(credentials) : 'null');
      
      // Log to database for Vercel debugging
      hasyx.debug({
        action: "telegram_auth_start",
        timestamp: new Date().toISOString(),
        credentialsKeys: credentials ? Object.keys(credentials) : null,
        hasCredentials: !!credentials
      });
      
      if (!credentials) {
        debug("❌ No credentials provided");
        console.error("❌ Telegram login failed: No credentials provided");
        hasyx.debug({
          action: "telegram_auth_error",
          error: "No credentials provided",
          timestamp: new Date().toISOString()
        });
        return null;
      }

      const botToken = process.env.TELEGRAM_LOGIN_BOT_TOKEN;
      if (!botToken) {
        debug("❌ TELEGRAM_LOGIN_BOT_TOKEN is not set in environment. Cannot verify hash.");
        console.error("❌ TELEGRAM_LOGIN_BOT_TOKEN is not set in environment. Cannot verify hash.");
        hasyx.debug({
          action: "telegram_auth_error",
          error: "TELEGRAM_LOGIN_BOT_TOKEN not configured",
          timestamp: new Date().toISOString()
        });
        throw new Error("Telegram bot token is not configured.");
      }

      // Log received credentials for debugging
      const credentialsForLog = {
        id: credentials.id,
        first_name: credentials.first_name,
        username: credentials.username,
        auth_date: credentials.auth_date,
        has_hash: !!credentials.hash,
        hash_length: credentials.hash ? credentials.hash.length : 0
      };
      
      debug("📝 Received credentials:", credentialsForLog);
      hasyx.debug({
        action: "telegram_auth_credentials",
        credentials: credentialsForLog,
        timestamp: new Date().toISOString()
      });

      // Prepare data for hash verification (all fields except 'hash' itself)
      const dataToCheck: Record<string, string | number> = {};
      const potentialFields: (keyof TelegramUserData)[] = ['id', 'first_name', 'last_name', 'username', 'photo_url', 'auth_date'];
      
      for (const key of potentialFields) {
        if (credentials[key]) {
          // Telegram user ID is a number
          if (key === 'id') dataToCheck[key] = parseInt(credentials[key], 10);
          // auth_date is a Unix timestamp (number)
          else if (key === 'auth_date') dataToCheck[key] = parseInt(credentials[key], 10);
          else dataToCheck[key] = credentials[key];
        }
      }
      
      // Construct the data_check_string
      const dataCheckArray: string[] = [];
      for (const key of Object.keys(dataToCheck).sort()) {
        dataCheckArray.push(`${key}=${dataToCheck[key]}`);
      }
      const dataCheckString = dataCheckArray.join("\n");
      
      const secretKey = crypto.createHash('sha256').update(botToken).digest();
      const calculatedHash = crypto.createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');
      
      debug("🔍 Hash verification details:");
      debug("Data check string:", dataCheckString);
      debug("Received hash:", credentials.hash);
      debug("Calculated hash:", calculatedHash);
      
      const hashVerification = {
        dataCheckString,
        received_hash: credentials.hash ? `${credentials.hash.substring(0, 8)}...` : 'missing',
        calculated_hash: `${calculatedHash.substring(0, 8)}...`,
        match: calculatedHash === credentials.hash,
        bot_token_configured: !!botToken,
        bot_token_length: botToken ? botToken.length : 0
      };
      
      console.log("🔍 Telegram hash verification - received vs calculated:", hashVerification);
      hasyx.debug({
        action: "telegram_auth_hash_verification",
        verification: hashVerification,
        timestamp: new Date().toISOString()
      });

      if (calculatedHash !== credentials.hash) {
        debug("❌ Hash verification failed!");
        console.error("❌ Telegram login failed: Hash verification failed");
        hasyx.debug({
          action: "telegram_auth_error",
          error: "Hash verification failed",
          verification: hashVerification,
          timestamp: new Date().toISOString()
        });
        return null; // Hash mismatch
      }
      debug("✅ Telegram hash verification successful.");

      // Check auth_date to prevent replay attacks (e.g., data is not older than 24 hours)
      const authDate = parseInt(credentials.auth_date, 10);
      const now = Math.floor(Date.now() / 1000);
      const timeDiff = now - authDate;
      
      const timeVerification = { authDate, now, timeDiff, maxAge: 86400 };
      debug("⏰ Time verification:", timeVerification);
      hasyx.debug({
        action: "telegram_auth_time_verification",
        verification: timeVerification,
        timestamp: new Date().toISOString()
      });
      
      if (timeDiff > 86400) { // 24 hours in seconds
        debug("❌ Telegram auth_date is too old. Possible replay attack.");
        console.error("❌ Telegram login failed: Auth date too old (replay attack protection)");
        hasyx.debug({
          action: "telegram_auth_error",
          error: "Auth date too old (replay attack protection)",
          verification: timeVerification,
          timestamp: new Date().toISOString()
        });
        return null;
      }
      debug("✅ Telegram auth_date is recent.");

      // Construct TelegramUserData safely from credentials
      const telegramUser: Partial<TelegramUserData> = {
        id: parseInt(credentials.id, 10),
        first_name: credentials.first_name,
        last_name: credentials.last_name,
        username: credentials.username,
        photo_url: credentials.photo_url,
        auth_date: parseInt(credentials.auth_date, 10),
        hash: credentials.hash,
      };

      const userInfo = {
        id: telegramUser.id,
        name: `${telegramUser.first_name || ''} ${telegramUser.last_name || ''}`.trim(),
        username: telegramUser.username
      };

      debug("👤 Processing Telegram user:", userInfo);
      hasyx.debug({
        action: "telegram_auth_user_processing",
        user: userInfo,
        timestamp: new Date().toISOString()
      });

      try {
        // Use providerAccountId as the Telegram user ID
        const providerAccountId = telegramUser.id!.toString();
        
        const userProfile = {
          name: `${telegramUser.first_name || ''} ${telegramUser.last_name || ''}`.trim() || telegramUser.username,
          // Telegram doesn't provide email, so we'll have to manage this.
          // For now, we won't set an email from Telegram.
          // The user might link it to an existing account with an email or set one later.
          email: null, // Explicitly null as Telegram doesn't provide it
          image: telegramUser.photo_url,
        };
        
        debug("🔄 Calling getOrCreateUserAndAccount with Telegram data:", { provider: "telegram", providerAccountId, userProfile });
        hasyx.debug({
          action: "telegram_auth_db_operation_start",
          provider: "telegram",
          providerAccountId,
          userProfile,
          timestamp: new Date().toISOString()
        });

        const dbUser = await getOrCreateUserAndAccount(
          hasyx,
          "telegram", // provider name
          providerAccountId,
          userProfile,
          telegramUser.photo_url // Pass image separately as well
        );

        if (dbUser && dbUser.id) {
          debug("✅ Telegram user authorized and mapped to DB user:", dbUser.id);
          console.log("✅ Telegram login successful for user:", dbUser.id);
          hasyx.debug({
            action: "telegram_auth_success",
            dbUserId: dbUser.id,
            telegramUserId: telegramUser.id,
            timestamp: new Date().toISOString()
          });
          return {
            id: dbUser.id,
            name: dbUser.name,
            email: dbUser.email, // This will be null if no existing account was linked
            image: dbUser.image,
          };
        } else {
          debug("❌ Failed to get or create user for Telegram login.");
          console.error("❌ Failed to get or create user for Telegram login.");
          hasyx.debug({
            action: "telegram_auth_error",
            error: "Failed to get or create user in DB",
            dbUser,
            timestamp: new Date().toISOString()
          });
          return null;
        }
      } catch (error) {
        debug("❌ Error during Telegram user processing in DB:", error);
        console.error("❌ Error during Telegram user processing in DB:", error);
        hasyx.debug({
          action: "telegram_auth_error",
          error: "Database operation failed",
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        });
        throw new Error("Failed to process Telegram login with database.");
      }
    },
  });
} 