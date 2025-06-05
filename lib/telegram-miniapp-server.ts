import { getOrCreateUserAndAccount } from 'hasyx/lib/authDbUtils';
import { Hasyx } from 'hasyx/lib/hasyx';
import Debug from './debug';
import crypto from 'crypto';

const debug = Debug('telegram-miniap-server');

// Types for Telegram miniapp data
export interface TelegramMiniappUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface TelegramMiniappData {
  user?: TelegramMiniappUser;
  auth_date: number;
  hash: string;
  query_id?: string;
  chat_type?: string;
  chat_instance?: string;
  start_param?: string;
}

// Validate Telegram initData hash using the same logic as telegram-credentials.ts
export async function validateTelegramInitData(initData: string): Promise<boolean> {
  const botToken = process.env.TELEGRAM_LOGIN_BOT_TOKEN;
  if (!botToken) {
    debug('TELEGRAM_LOGIN_BOT_TOKEN not set, cannot validate initData');
    return false;
  }

  try {
    // Parse initData into URLSearchParams
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    if (!hash) {
      debug('No hash found in initData');
      return false;
    }

    // Remove hash from params and sort remaining params
    urlParams.delete('hash');
    const dataCheckArray: string[] = [];
    
    // Sort params alphabetically and build data check string
    const sortedParams = Array.from(urlParams.entries()).sort(([a], [b]) => a.localeCompare(b));
    for (const [key, value] of sortedParams) {
      dataCheckArray.push(`${key}=${value}`);
    }
    const dataCheckString = dataCheckArray.join('\n');

    // Calculate expected hash
    const secretKey = crypto.createHash('sha256').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    debug('Hash validation:', {
      received: hash.substring(0, 8) + '...',
      calculated: calculatedHash.substring(0, 8) + '...',
      match: calculatedHash === hash
    });

    return calculatedHash === hash;
  } catch (error) {
    debug('Error validating initData hash:', error);
    return false;
  }
}

// Parse Telegram initData string
export function parseInitData(initDataString: string): TelegramMiniappData | null {
  try {
    if (!initDataString) return null;
    
    const params = new URLSearchParams(initDataString);
    const userData = params.get('user');
    const authDate = params.get('auth_date');
    const hash = params.get('hash');
    
    if (!authDate || !hash) return null;
    
    const initData: TelegramMiniappData = {
      auth_date: parseInt(authDate, 10),
      hash,
    };
    
    if (userData) {
      try {
        initData.user = JSON.parse(userData);
      } catch (e) {
        debug('Failed to parse user data:', e);
        return null;
      }
    }
    
    // Add other optional fields
    const queryId = params.get('query_id');
    if (queryId) initData.query_id = queryId;
    
    const chatType = params.get('chat_type');
    if (chatType) initData.chat_type = chatType;
    
    const chatInstance = params.get('chat_instance');
    if (chatInstance) initData.chat_instance = chatInstance;
    
    const startParam = params.get('start_param');
    if (startParam) initData.start_param = startParam;
    
    return initData;
  } catch (error) {
    debug('Error parsing initData:', error);
    return null;
  }
}

// Server-side NextAuth Credentials Provider
export function TelegramMiniappCredentialsProvider({ hasyx }: { hasyx: Hasyx }) {
  return {
    id: 'telegram-miniapp',
    name: 'Telegram Miniapp',
    type: 'credentials' as const,
    credentials: {
      initData: { 
        label: 'Telegram Init Data', 
        type: 'text' 
      }
    },
    async authorize(credentials: Record<string, string> | undefined) {
      const authorizeDebug = Debug('telegram-miniapp:authorize');
      
      if (!credentials?.initData) {
        authorizeDebug('No initData provided');
        return null;
      }

      try {
        // Validate initData hash
        const isValid = await validateTelegramInitData(credentials.initData);
        if (!isValid) {
          authorizeDebug('Invalid initData hash');
          return null;
        }

        // Parse the validated data
        const initData = parseInitData(credentials.initData);
        if (!initData || !initData.user) {
          authorizeDebug('No user data in initData');
          return null;
        }

        const telegramUser = initData.user;
        authorizeDebug('Valid Telegram user:', { id: telegramUser.id, username: telegramUser.username });

        // Use getOrCreateUserAndAccount to follow hasyx architecture
        const providerAccountId = telegramUser.id.toString();
        const userProfile = {
          name: `${telegramUser.first_name} ${telegramUser.last_name || ''}`.trim(),
          email: null, // Telegram doesn't provide email
          image: telegramUser.photo_url || null,
        };

        // Store additional Telegram data in provider_data field
        const providerData = {
          username: telegramUser.username,
          first_name: telegramUser.first_name,
          last_name: telegramUser.last_name,
          language_code: telegramUser.language_code,
          is_premium: telegramUser.is_premium,
        };

        authorizeDebug('Creating/finding user and account via getOrCreateUserAndAccount');
        
        const dbUser = await getOrCreateUserAndAccount(
          hasyx,
          'telegram-miniapp', // provider name
          providerAccountId,
          userProfile,
          telegramUser.photo_url // image
        );

        // Update the account with provider_data containing telegram-specific fields
        await hasyx.update({
          table: 'accounts',
          where: {
            provider: { _eq: 'telegram-miniapp' },
            provider_account_id: { _eq: providerAccountId }
          },
          _set: {
            provider_data: providerData
          }
        });

        authorizeDebug('User authorized successfully:', dbUser.id);

        // Return user object compatible with NextAuth
        return {
          id: dbUser.id,
          name: dbUser.name,
          email: dbUser.email || `${telegramUser.id}@telegram.user`,
          image: dbUser.image,
        };
      } catch (error) {
        authorizeDebug('Error during authorization:', error);
        return null;
      }
    }
  };
} 