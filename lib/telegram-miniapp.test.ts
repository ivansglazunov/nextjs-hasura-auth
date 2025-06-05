import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { getOrCreateUserAndAccount } from './authDbUtils';
import { Hasyx } from './hasyx';
import { createApolloClient } from './apollo';
import { Generator } from './generator';
import schema from '../public/hasura-schema.json';

describe('[DEBUG] Telegram Miniapp Authentication with Accounts Architecture', () => {
  let hasyx: Hasyx;
  let testUserId: string;
  let testAccountId: string;

  beforeAll(async () => {
    // Initialize Hasyx client
    const client = createApolloClient({
      url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
      secret: process.env.HASURA_ADMIN_SECRET!,
    });
    const generator = Generator(schema as any);
    hasyx = new Hasyx(client, generator);
  });

  afterAll(async () => {
    // Cleanup: remove test data
    if (testAccountId) {
      try {
        await hasyx.delete({
          table: 'accounts',
          where: { id: { _eq: testAccountId } }
        });
      } catch (e) {
        console.warn('Could not delete test account:', e);
      }
    }
    
    if (testUserId) {
      try {
        await hasyx.delete({
          table: 'users',
          where: { id: { _eq: testUserId } }
        });
      } catch (e) {
        console.warn('Could not delete test user:', e);
      }
    }
  });

  it('should create user and account with provider_data for telegram miniapp', async () => {
    // Test data
    const telegramUser = {
      id: 123456789,
      first_name: 'Test',
      last_name: 'User',
      username: 'testuser',
      photo_url: 'https://example.com/photo.jpg'
    };

    try {
      // Use getOrCreateUserAndAccount directly to test the new architecture
      const providerAccountId = telegramUser.id.toString();
      const userProfile = {
        name: `${telegramUser.first_name} ${telegramUser.last_name || ''}`.trim(),
        email: null,
        image: telegramUser.photo_url || null,
      };

      const dbUser = await getOrCreateUserAndAccount(
        hasyx,
        'telegram-miniapp',
        providerAccountId,
        userProfile,
        telegramUser.photo_url
      );

      expect(dbUser).toBeTruthy();
      expect(dbUser.name).toBe('Test User');

      testUserId = dbUser.id;

      // Update the account with provider_data
      const providerData = {
        username: telegramUser.username,
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name,
      };

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

      // Verify user was created correctly
      const user = await hasyx.select({
        table: 'users',
        where: { id: { _eq: testUserId } },
        returning: ['id', 'name', 'email', 'image', 'hasura_role']
      });

      expect(user).toHaveLength(1);
      expect(user[0].name).toBe('Test User');
      expect(user[0].hasura_role).toBe('user');

      // Verify account was created with correct provider_data
      const accounts = await hasyx.select({
        table: 'accounts',
        where: { 
          user_id: { _eq: testUserId },
          provider: { _eq: 'telegram-miniapp' }
        },
        returning: ['id', 'provider', 'provider_account_id', 'provider_data', 'type']
      });

      expect(accounts).toHaveLength(1);
      expect(accounts[0].provider).toBe('telegram-miniapp');
      expect(accounts[0].provider_account_id).toBe('123456789');
      expect(accounts[0].type).toBe('oauth');
      expect(accounts[0].provider_data).toEqual({
        username: 'testuser',
        first_name: 'Test',
        last_name: 'User',
      });

      testAccountId = accounts[0].id;

      console.log('✅ Test passed: User and account created correctly with provider_data');
    } catch (error) {
      console.error('Test error:', error);
      throw error;
    }
  });

  it('should link existing user if account with same provider_account_id exists', async () => {
    // This test verifies that getOrCreateUserAndAccount correctly finds existing accounts
    // The second authorization attempt should return the same user
    
    const telegramUser = {
      id: 123456789,
      first_name: 'Test',
      last_name: 'User',
      username: 'testuser'
    };

    try {
      const providerAccountId = telegramUser.id.toString();
      const userProfile = {
        name: `${telegramUser.first_name} ${telegramUser.last_name || ''}`.trim(),
        email: null,
        image: null,
      };

      // Second call with same telegram ID should return same user
      const dbUser2 = await getOrCreateUserAndAccount(
        hasyx,
        'telegram-miniapp',
        providerAccountId,
        userProfile,
        null
      );

      expect(dbUser2).toBeTruthy();
      expect(dbUser2.id).toBe(testUserId); // Should be the same user ID
      expect(dbUser2.name).toBe('Test User');

      console.log('✅ Test passed: Existing user found correctly by provider_account_id');
    } catch (error) {
      console.error('Test error:', error);
      throw error;
    }
  });
}); 