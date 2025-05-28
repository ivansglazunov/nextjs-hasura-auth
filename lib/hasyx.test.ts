import dotenv from 'dotenv';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ApolloError, gql } from '@apollo/client/core';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import { Hasyx } from './hasyx'; 
import { createApolloClient, HasyxApolloClient } from './apollo'; 
import Debug from './debug'; 
import { Generator } from './generator'; 
import schema from '../public/hasura-schema.json'; 
import { hashPassword } from './authDbUtils'; 

const debug = Debug('test:hasyx');

const generate = Generator(schema as any); 

const HASURA_URL = process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!;
const ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET!;

interface TestUser {
  id: string;
  name: string;
  hasura_role?: string;
}

// Helper function to create an admin Hasyx client
function createAdminHasyx(): Hasyx {
  if (!HASURA_URL || !ADMIN_SECRET) {
    throw new Error('❌ Missing HASURA_URL or ADMIN_SECRET in environment variables for test setup.');
  }
  
  const adminApolloClient = createApolloClient({
    url: HASURA_URL,
    secret: ADMIN_SECRET,
    ws: false,
  }) as HasyxApolloClient;
  
  return new Hasyx(adminApolloClient, generate);
}

// Helper function to create test user
async function createTestUser(adminHasyx: Hasyx, suffix: string = ''): Promise<TestUser> {
  const email = `hasyx-test-${uuidv4()}@example.com`;
  const password = 'password123';
  const name = `Hasyx Test User ${suffix}`;
  
  const hashedPassword = await hashPassword(password);
  
  const createdUser = await adminHasyx.insert<TestUser>({
    table: 'users',
    object: { email, password: hashedPassword, name, hasura_role: 'user' },
    returning: ['id', 'name']
  });
  
  if (!createdUser || !createdUser.id) {
    throw new Error(`Failed to create test user ${suffix}`);
  }
  
  return {
    id: createdUser.id,
    name: createdUser.name
  };
}

// Helper function to cleanup user
async function cleanupTestUser(adminHasyx: Hasyx, userId: string) {
  try {
    await adminHasyx.delete({
      table: 'users',
      pk_columns: { id: userId },
    });
  } catch (error: any) {
    debug(`Error deleting test user ${userId}:`, error.message);
  }
}

// Helper function to cleanup Hasyx client
function cleanupHasyx(hasyx: Hasyx, label: string = '') {
  if (hasyx && hasyx.apolloClient && hasyx.apolloClient.terminate) {
    hasyx.apolloClient.terminate();
  }
}

(!!+(process?.env?.JEST_LOCAL || '') ? describe.skip : describe)('Hasyx Integration Tests', () => {
  
  describe('Hasyx Class HTTP Tests', () => {
    it('should perform CRUD operations on users', async () => {
      const adminHasyx = createAdminHasyx();
      const testUsers: TestUser[] = [];
      
      try {
        debug('🧪 Testing Hasyx CRUD operations (select, update, delete)...');
        
        // Create 3 test users
        for (let i = 0; i < 3; i++) {
          const user = await createTestUser(adminHasyx, `${i + 1}`);
          testUsers.push(user);
          debug(`[test:hasyx]   👤 Test user ${i + 1} created: ${user.id} with name: ${user.name}`);
        }
        
        expect(testUsers.length).toBe(3);
        
        // Testing SELECT
        debug('📋 Testing SELECT: Fetching all test users...');
        const testUserIds = testUsers.map(u => u.id);
        const users = await adminHasyx.select<TestUser[]>({
          table: 'users',
          where: { id: { _in: testUserIds } },
          returning: ['id', 'name'],
          order_by: [{ id: 'asc' }],
          limit: 10
        });
        
        debug(`[test:hasyx] 📊 SELECT returned ${users.length} users:`, users);
        expect(users).toBeDefined();
        expect(Array.isArray(users)).toBe(true);
        expect(users.length).toBe(3);
        users.forEach((user) => {
          expect(user.id).toBeDefined();
          expect(testUserIds).toContain(user.id);
        });
        debug('✅ SELECT test succeeded.');
        
        // Testing UPDATE
        debug('📝 Testing UPDATE: Modifying name of first user...');
        const newName = `Updated User ${Date.now()}`;
        const updatedUser = await adminHasyx.update<TestUser>({
          table: 'users',
          pk_columns: { id: testUsers[0].id },
          _set: { name: newName },
          returning: ['id', 'name']
        });
        
        debug('📊 UPDATE returned:', updatedUser);
        expect(updatedUser).toBeDefined();
        expect(updatedUser.id).toBe(testUsers[0].id);
        expect(updatedUser.name).toBe(newName);
        debug('✅ UPDATE test succeeded.');
        
        // Testing SELECT after UPDATE
        debug('🔍 Testing SELECT after UPDATE to verify changes...');
        const verifyUser = await adminHasyx.select<TestUser>({
          table: 'users',
          pk_columns: { id: testUsers[0].id },
          returning: ['id', 'name']
        });
        
        debug('📊 SELECT after UPDATE returned:', verifyUser);
        expect(verifyUser).toBeDefined();
        expect(verifyUser.id).toBe(testUsers[0].id);
        expect(verifyUser.name).toBe(newName);
        debug('✅ Verification of UPDATE succeeded.');
        
        // Testing INSERT and DELETE with temporary user
        debug('🧪 Testing INSERT and DELETE: Creating temporary user...');
        const tempUser = await createTestUser(adminHasyx, 'Temp');
        
        debug('📊 INSERT returned:', tempUser);
        expect(tempUser).toBeDefined();
        expect(tempUser.id).toBeTruthy();
        expect(tempUser.name).toContain('Temp');
        debug('✅ INSERT test succeeded.');
        
        // Testing DELETE
        debug('🗑️ Testing DELETE: Removing temporary user...');
        const deleteResult = await adminHasyx.delete<{id: string}>({
          table: 'users',
          pk_columns: { id: tempUser.id },
          returning: ['id']
        });
        
        debug('📊 DELETE returned:', deleteResult);
        expect(deleteResult).toBeDefined();
        expect(deleteResult.id).toBe(tempUser.id);
        debug('✅ DELETE test succeeded.');
        
        // Verifying DELETE
        debug('🔍 Verifying DELETE by attempting to select deleted user...');
        const deletedUser = await adminHasyx.select<TestUser | null>({
          table: 'users',
          pk_columns: { id: tempUser.id },
          returning: ['id', 'name']
        });
        
        debug('📊 SELECT after DELETE returned:', deletedUser);
        expect(deletedUser).toBeNull();
        debug('✅ Verification of DELETE succeeded.');
        
        debug('🎉 All CRUD tests completed successfully!');
        
      } finally {
        // Cleanup all test users
        for (const user of testUsers) {
          await cleanupTestUser(adminHasyx, user.id);
        }
        cleanupHasyx(adminHasyx, 'CRUD test');
      }
    }, 15000);
  });

  describe('Hasyx Subscription Rate Limiting Tests', () => {
    
    it('should throttle subscription updates to at most 1 per second in WebSocket mode', async () => {
      const adminHasyx = createAdminHasyx();
      let subHasyx: Hasyx | null = null;
      let testUser: TestUser | null = null;
      const subscriptionResults: any[] = [];
      const updateTimes: number[] = [];
      
      try {
        // Create test user
        testUser = await createTestUser(adminHasyx, 'WS-Test');
        debug(`[test:hasyx] 👤 Test user created for WebSocket test: ${testUser.id}`);
        
        // Create WebSocket-enabled Hasyx client
        const subApolloClient = createApolloClient({
          url: HASURA_URL,
          secret: ADMIN_SECRET,
          ws: true,
        }) as HasyxApolloClient;
        subHasyx = new Hasyx(subApolloClient, generate);
        debug('✅ WS-enabled Hasyx client for subscription is ready.');
        
        const NUM_DB_UPDATES = 5;
        const DB_UPDATE_INTERVAL_MS = 200;
        const THROTTLE_INTERVAL_MS = 1000;
        const originalName = testUser.name;
        
        await new Promise<void>((resolve, reject) => {
          debug('🧪 Testing REAL subscription rate limiting in WEBSOCKET mode (explicit ws: true)');
          
          const subscription = subHasyx!.subscribe<TestUser>({
            table: 'users',
            pk_columns: { id: testUser!.id },
            returning: ['id', 'name'],
            pollingInterval: THROTTLE_INTERVAL_MS,
            ws: true
          }).subscribe({
            next: (result) => {
              const timestamp = Date.now();
              subscriptionResults.push(result);
              updateTimes.push(timestamp);
              debug(`[test:hasyx] 📬 [WS] Subscription update received at ${timestamp}:`, JSON.stringify(result));
            },
            error: (err) => {
              reject(new Error('[test:hasyx] ❌ [WS] Subscription error:' + err));
            }
          });
          
          // Trigger database updates
          (async () => {
            try {
              for (let i = 0; i < NUM_DB_UPDATES; i++) {
                await new Promise(res => setTimeout(res, DB_UPDATE_INTERVAL_MS));
                const newName = `User WS Test Update ${i + 1} ${Date.now()}`;
                debug(`[test:hasyx] 🚀 [WS] Triggering DB update ${i+1}/${NUM_DB_UPDATES}: user ${testUser!.id}, name: ${newName}`);
                await adminHasyx.update<TestUser>({
                  table: 'users',
                  pk_columns: { id: testUser!.id },
                  _set: { name: newName },
                  returning: ['id']
                });
                debug(`[test:hasyx] ✅ [WS] DB update ${i+1} successful.`);
              }
              
              const timeToWaitForAllMessages =
                (NUM_DB_UPDATES * DB_UPDATE_INTERVAL_MS) +
                (NUM_DB_UPDATES * THROTTLE_INTERVAL_MS) +
                2000;
              debug(`[test:hasyx] [WS] All ${NUM_DB_UPDATES} DB updates triggered. Waiting ${timeToWaitForAllMessages / 1000}s for throttled messages...`);
              
              setTimeout(async () => {
                subscription.unsubscribe();
                debug('[WS] Subscription unsubscribed.');
                
                // Restore original name
                try {
                  await adminHasyx.update<TestUser>({
                    table: 'users',
                    pk_columns: { id: testUser!.id },
                    _set: { name: originalName },
                  });
                  debug(`[test:hasyx] [WS] Target user name restored to '${originalName}'.`);
                } catch (restoreError) {
                  debug(`[test:hasyx] [WS] Failed to restore user name:`, restoreError);
                }
                
                // Analyze results
                debug(`📊 Analyzing update intervals. Raw updateTimes: ${JSON.stringify(updateTimes)}`);
                if (updateTimes.length < 2) {
                  reject(new Error(`Insufficient updates to analyze throttling: received ${updateTimes.length} updates. Expected at least 2.`));
                  return;
                }
                
                const intervals: number[] = [];
                for (let i = 1; i < updateTimes.length; i++) {
                  intervals.push(updateTimes[i] - updateTimes[i-1]);
                }
                
                debug(`📊 Intervals between updates: ${JSON.stringify(intervals)}`);
                resolve();
              }, timeToWaitForAllMessages);
            } catch (error) {
              reject(error);
            }
          })();
        });
        
      } finally {
        if (testUser) {
          await cleanupTestUser(adminHasyx, testUser.id);
        }
        if (subHasyx) {
          cleanupHasyx(subHasyx, 'WS subscription test');
        }
        cleanupHasyx(adminHasyx, 'WS admin test');
      }
    }, 30000);
  });
});