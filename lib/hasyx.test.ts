import dotenv from 'dotenv';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ApolloError, gql } from '@apollo/client';

// Load environment variables from root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { Hasyx } from './hasyx'; 
import { createApolloClient, HasyxApolloClient } from './apollo'; 
import Debug from './debug'; // UNCOMMENTED
import { Generator } from './generator'; 
import schema from '../public/hasura-schema.json'; 
import { hashPassword } from './authDbUtils'; 

// Using console.log for direct output, original namespace was 'test:hasyx'
// const debug = Debug('test:hasyx'); 
const debug = Debug('test:hasyx'); // UNCOMMENTED
const generate = Generator(schema as any); // RESTORED

// --- Test Configuration ---
const HASURA_URL = process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!;
const ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET!;

interface TestUser {
  id: string;
  name: string;
  hasura_role?: string;
}

describe('Hasyx Integration Tests', () => {
  let adminHasyx: Hasyx;
  const testUsersData: TestUser[] = [];
  const initialUserNames: string[] = []; 

  beforeAll(async () => {
    console.log("RUNNING: Main beforeAll in hasyx.test.ts"); 
    debug('🔧 Hasyx Test Setup: Initializing admin Hasyx client and creating test users...');
    console.log(`[test:hasyx]   🔑 Loaded HASURA_URL: ${HASURA_URL}`);
    console.log(`[test:hasyx]   🔑 Loaded ADMIN_SECRET: ${ADMIN_SECRET ? '******' + ADMIN_SECRET.slice(-4) : undefined}`);

    if (!HASURA_URL || !ADMIN_SECRET) {
      console.error('❌ Missing HASURA_URL or ADMIN_SECRET in environment variables for test setup.');
      console.error('   Please ensure NEXT_PUBLIC_HASURA_GRAPHQL_URL and HASURA_ADMIN_SECRET are correctly set in your .env file.');
      throw new Error('Missing HASURA_URL or ADMIN_SECRET in environment variables for test setup.');
    }

    const adminApolloClient = createApolloClient({
      url: HASURA_URL,
      secret: ADMIN_SECRET,
      ws: false, // Отключаем WebSocket для основного клиента CRUD операций
    }) as HasyxApolloClient;
    adminHasyx = new Hasyx(adminApolloClient, generate);

    for (let i = 0; i < 3; i++) {
      const email = `hasyx-test-${uuidv4()}@example.com`;
      const password = 'password123';
      const name = `Hasyx Test User ${i + 1}`;
      initialUserNames.push(name); 
      const hashedPassword = await hashPassword(password);

      try {
        const createdUser = await adminHasyx.insert<TestUser>({
          table: 'users',
          object: { email, password: hashedPassword, name, hasura_role: 'user' },
          returning: ['id', 'name']
        });
        if (!createdUser || !createdUser.id) {
          throw new Error(`Failed to create test user ${i + 1}`);
        }
        
        const userToAdd: TestUser = {
          id: createdUser.id,
          name: createdUser.name 
        };
        testUsersData.push(userToAdd);
        console.log(`[test:hasyx]   👤 Test user ${i + 1} created: ${userToAdd.id} with name: ${userToAdd.name}`);
      } catch (error: any) {
        console.error(`[test:hasyx] ❌ Error creating test user ${i + 1}: ${error.message}`);
        
        for (const user of testUsersData) {
          if (user.id) await adminHasyx.delete({ table: 'users', pk_columns: { id: user.id } });
        }
        throw error; 
      }
    }
    expect(testUsersData.length).toBe(3);
    debug('✅ Hasyx Test Setup Complete.');
  }, 45000); 

  afterAll(async () => {
    debug('\n🧹 Hasyx Test Teardown: Deleting test users...');
    if (adminHasyx && testUsersData.length > 0) {
      for (const user of testUsersData) {
        if (user.id) {
          try {
            await adminHasyx.delete({
              table: 'users',
              pk_columns: { id: user.id },
            });
            console.log(`[test:hasyx]   🗑️ Test user deleted: ${user.id}`);
          } catch (error: any) {
            console.error(`[test:hasyx] ❌ Error deleting test user ${user.id}: ${error.message}`);
          }
        }
      }
    }
    debug('✅ Hasyx Test Teardown Complete.');
  }, 45000); 

  describe('Hasyx Class HTTP Tests', () => {
    it('should perform CRUD operations on users', async () => {
      debug('🧪 Testing Hasyx CRUD operations (select, update, delete)...');
      expect(testUsersData.length).toBe(3);
      
      // Test 1: SELECT - Fetch all test users
      debug('📋 Testing SELECT: Fetching all test users...');
      const testUserIds = testUsersData.map(u => u.id);
      const users = await adminHasyx.select<TestUser[]>({
        table: 'users',
        where: { id: { _in: testUserIds } },
        returning: ['id', 'name'],
        order_by: [{ id: 'asc' }],
        limit: 10
      });
      
      console.log(`[test:hasyx] 📊 SELECT returned ${users.length} users:`, users);
      expect(users).toBeDefined();
      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBe(3);
      users.forEach((user) => {
        expect(user.id).toBeDefined();
        expect(testUserIds).toContain(user.id);
      });
      debug('✅ SELECT test succeeded.');
      
      // Test 2: UPDATE - Modify name of first user
      debug('📝 Testing UPDATE: Modifying name of first user...');
      const newName = `Updated User ${Date.now()}`;
      const updatedUser = await adminHasyx.update<TestUser>({
        table: 'users',
        pk_columns: { id: testUsersData[0].id },
        _set: { name: newName },
        returning: ['id', 'name']
      });
      
      debug('📊 UPDATE returned:', updatedUser);
      expect(updatedUser).toBeDefined();
      expect(updatedUser.id).toBe(testUsersData[0].id);
      expect(updatedUser.name).toBe(newName);
      debug('✅ UPDATE test succeeded.');
      
      // Test 3: Verify the update with another SELECT
      debug('🔍 Testing SELECT after UPDATE to verify changes...');
      const verifyUser = await adminHasyx.select<TestUser>({
        table: 'users',
        pk_columns: { id: testUsersData[0].id },
        returning: ['id', 'name']
      });
      
      debug('📊 SELECT after UPDATE returned:', verifyUser);
      expect(verifyUser).toBeDefined();
      expect(verifyUser.id).toBe(testUsersData[0].id);
      expect(verifyUser.name).toBe(newName);
      debug('✅ Verification of UPDATE succeeded.');
      
      // Test 4: Create a temporary user and then DELETE it
      debug('🧪 Testing INSERT and DELETE: Creating temporary user...');
      const tempEmail = `hasyx-temp-${uuidv4()}@example.com`;
      const tempPassword = await hashPassword('temppass');
      const tempName = 'Temporary Test User';
      
      const tempUser = await adminHasyx.insert<TestUser>({
        table: 'users',
        object: { 
          email: tempEmail,
          password: tempPassword,
          name: tempName,
          hasura_role: 'user'
        },
        returning: ['id', 'name']
      });
      
      debug('📊 INSERT returned:', tempUser);
      expect(tempUser).toBeDefined();
      expect(tempUser.id).toBeTruthy();
      expect(tempUser.name).toBe(tempName);
      debug('✅ INSERT test succeeded.');
      
      // Delete the temporary user
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
      
      // Verify deletion by attempting to select the deleted user
      debug('🔍 Verifying DELETE by attempting to select deleted user...');
      const deletedUser = await adminHasyx.select<TestUser | null>({
        table: 'users',
        pk_columns: { id: tempUser.id },
        returning: ['id', 'name']
      });
      
      debug('📊 SELECT after DELETE returned:', deletedUser);
      expect(deletedUser).toBeNull(); // Should return null for non-existent user
      debug('✅ Verification of DELETE succeeded.');
      
      debug('🎉 All CRUD tests completed successfully!');
    });
  });

  describe('Hasyx Subscription Rate Limiting Tests', () => {
    let subHasyx: Hasyx; // Hasyx client for subscriptions, WS-enabled
    const subscriptionResults: any[] = [];
    const updateTimes: number[] = [];
    
    // Target user for subscription tests
    let targetUserForSubscription: TestUser;

    beforeAll(async () => {
      debug('🧪 Setting up Hasyx client for subscription tests (WS-enabled)...');
      if (testUsersData.length === 0) {
        console.error("[test:hasyx] ❌ No test users available for subscription tests. Outer beforeAll might have failed.");
        throw new Error("No test users for subscription tests.");
      }
      targetUserForSubscription = testUsersData[0]; // Use the first test user

      // Более подробная отладка для WebSocket подключения
      console.log(`[test:hasyx] 📡 WebSocket URL: ${HASURA_URL.replace(/^http/, 'ws').replace(/^https/, 'wss')}`);
      console.log(`[test:hasyx] 🔑 Using admin secret: ${ADMIN_SECRET ? ADMIN_SECRET.substring(0, 5) + '...' : 'undefined'}`);
      console.log(`[test:hasyx] 🚀 Creating Apollo client for WebSocket...`);

      // Создаем новый Apollo клиент с улучшенной настройкой WebSocket
      const subApolloClient = createApolloClient({
        url: HASURA_URL,
        secret: ADMIN_SECRET, // Use admin secret for subscriptions
        ws: true, // Explicitly enable WebSocket transport
      }) as HasyxApolloClient;
      
      // Проверяем, что клиент создался с правильными настройками
      // console.log(`[test:hasyx] ✓ Apollo client options:`, {
      //   url: subApolloClient._options.url,
      //   ws: subApolloClient._options.ws,
      //   secret: subApolloClient._options.secret ? '✓ Set' : 'undefined'
      // });
      debug(`✓ Apollo client options: url=${subApolloClient._options.url}, ws=${subApolloClient._options.ws}, secret=${subApolloClient._options.secret ? '✓ Set' : 'undefined'}`);

      subHasyx = new Hasyx(subApolloClient, generate);
      debug('✅ WS-enabled Hasyx client for subscriptions is ready.');
    }, 30000); // Increase timeout for WebSocket connection

    beforeEach(() => {
      subscriptionResults.length = 0;
      updateTimes.length = 0;
      // No mockClient setup needed here anymore
      // Reset name of targetUserForSubscription to ensure clean state for each test if needed
      // This might be better in an afterEach or specific to tests that modify it.
      // For now, assuming tests handle their own state or one modification is fine.
    });
    
    afterAll(async () => {
      // Clean up subHasyx or its Apollo client if necessary (e.g., close WS connections)
      if (subHasyx && subHasyx.apolloClient && subHasyx.apolloClient.terminate) {
        debug('ttempting to terminate WebSocket client...');
        subHasyx.apolloClient.terminate();
        debug('WebSocket client termination called.');
      }
      debug('✅ Subscription test Hasyx client cleaned up (attempted).');
    });

    // Helper function to analyze update intervals
    function analyzeUpdateIntervals(doneFn: jest.DoneCallback, expectedMinInterval: number = 950) {
      // debug('📊 Analyzing update intervals. Raw updateTimes:', updateTimes.map(t => new Date(t).toISOString()));
      debug(`📊 Analyzing update intervals. Raw updateTimes: ${JSON.stringify(updateTimes.map(t => new Date(t).toISOString()))}`);
      if (updateTimes.length < 2) {
        const errorMessage = `[test:hasyx] ⚠️ Insufficient updates to analyze throttling: received ${updateTimes.length} updates. Expected at least 2.`;
        console.error(errorMessage);
        // If no updates were received, it's a failure if we expected some.
        // If only one update was received, we can't calculate an interval.
        // The number of expected updates should be managed by the test itself.
        if (updateTimes.length === 0 && expectedMinInterval > 0) { // expectedMinInterval > 0 implies we expected updates
             doneFn(new Error("No updates received by subscription."));
             return;
        }
        if (updateTimes.length === 1 && expectedMinInterval > 0) {
             doneFn(new Error("Only one update received, cannot calculate interval."));
             return;
        }
        // If it's okay to have 0 or 1 update (e.g. testing unsubscribe), then don't error here.
        // For throttling tests, less than 2 is an issue.
        doneFn(new Error(errorMessage));
        return;
      }
      const intervals: number[] = [];
      for (let i = 1; i < updateTimes.length; i++) {
        intervals.push(updateTimes[i] - updateTimes[i-1]);
      }
      
      // debug('📊 Calculated intervals (ms): [${intervals.join(', ')}]');
      debug(`📊 Calculated intervals (ms): [${intervals.join(', ')}]`);
      
      // It's possible no intervals were calculated if only one update was received, caught above.
      if (intervals.length === 0) {
        const errorMessage = `[test:hasyx] ⚠️ No intervals calculated, though ${updateTimes.length} updates were received. This indicates an issue.`;
        console.error(errorMessage);
        doneFn(new Error(errorMessage));
        return;
      }
      
      const minInterval = Math.min(...intervals);
      // console.log(`[test:hasyx] ⏱️ Minimum interval: ${minInterval}ms`);
      debug(`⏱️ Minimum interval: ${minInterval}ms`);
      
      try {
        expect(minInterval).toBeGreaterThanOrEqual(expectedMinInterval);
        console.log(`[test:hasyx] ✅ Throttling verified: all updates were at least ${expectedMinInterval}ms apart (min actual: ${minInterval}ms).`);
        doneFn();
      } catch (error) {
        console.error(`[test:hasyx] ❌ Throttling assertion failed: ${error}. Min interval: ${minInterval}ms, Expected: >=${expectedMinInterval}ms. Intervals: [${intervals.join(', ')}]`);
        doneFn(error);
      }
    }
    
    it('should throttle subscription updates to at most 1 per second in WebSocket mode', (done) => {
      debug('🧪 Testing REAL subscription rate limiting in WEBSOCKET mode (explicit ws: true)');
      expect(targetUserForSubscription).toBeDefined();
      expect(subHasyx).toBeDefined();

      const NUM_DB_UPDATES = 5;
      const DB_UPDATE_INTERVAL_MS = 200; // How quickly we trigger DB changes
      const THROTTLE_INTERVAL_MS = 1000; // The pollingInterval for Hasyx, expected min emit interval

      const originalName = targetUserForSubscription.name;

      const subscription = subHasyx.subscribe<TestUser>({
        table: 'users',
        pk_columns: { id: targetUserForSubscription.id },
        returning: ['id', 'name'], // Ensure 'name' is returned
        pollingInterval: THROTTLE_INTERVAL_MS, // This is key for the throttling logic
        ws: true // Explicitly use WebSocket
      }).subscribe({
        next: (result) => {
          const timestamp = Date.now();
          subscriptionResults.push(result);
          updateTimes.push(timestamp);
          console.log(`[test:hasyx] 📬 [WS] Subscription update received at ${new Date(timestamp).toISOString()}:`, JSON.stringify(result));
        },
        error: (err) => {
          console.error('[test:hasyx] ❌ [WS] Subscription error:', err);
          done(err);
        }
      });

      // Trigger database updates rapidly
      (async () => {
        for (let i = 0; i < NUM_DB_UPDATES; i++) {
          await new Promise(resolve => setTimeout(resolve, DB_UPDATE_INTERVAL_MS));
          try {
            const newName = `User WS Test Update ${i + 1} ${Date.now()}`;
            console.log(`[test:hasyx] 🚀 [WS] Triggering DB update ${i+1}/${NUM_DB_UPDATES}: user ${targetUserForSubscription.id}, name: ${newName}`);
            await adminHasyx.update<TestUser>({
              table: 'users',
              pk_columns: { id: targetUserForSubscription.id },
              _set: { name: newName },
              returning: ['id'] 
            });
            console.log(`[test:hasyx] ✅ [WS] DB update ${i+1} successful.`);
          } catch (dbError) {
            console.error(`[test:hasyx] ❌ [WS] DB update ${i+1} failed:`, dbError);
            subscription.unsubscribe();
            done(dbError); // Fail test if DB update fails
            return;
          }
        }

        // Wait for all updates to be processed and throttled messages to arrive
        // Max time for updates to occur: (NUM_DB_UPDATES - 1) * DB_UPDATE_INTERVAL_MS
        // Max time for throttled messages: (NUM_DB_UPDATES -1) * THROTTLE_INTERVAL_MS (roughly, if each update triggers a new throttle window)
        // Add a buffer
        const timeToWaitForAllMessages = 
            (NUM_DB_UPDATES * DB_UPDATE_INTERVAL_MS) + // Time for all DB updates to be sent
            (NUM_DB_UPDATES * THROTTLE_INTERVAL_MS) + // Time for all potential throttled messages
            2000; // Extra buffer for network latency and processing

        console.log(`[test:hasyx] [WS] All ${NUM_DB_UPDATES} DB updates triggered. Waiting ${timeToWaitForAllMessages / 1000}s for throttled messages...`);
        
        setTimeout(async () => {
          subscription.unsubscribe();
          debug('[WS] Subscription unsubscribed.');
          
          // Restore original name
          try {
            await adminHasyx.update<TestUser>({
              table: 'users',
              pk_columns: { id: targetUserForSubscription.id },
              _set: { name: originalName },
            });
             console.log(`[test:hasyx] [WS] Target user name restored to '${originalName}'.`);
          } catch (restoreError) {
            console.warn(`[test:hasyx] [WS] Failed to restore user name:`, restoreError)
          }
          
          // Expect at least a few updates, but not necessarily all NUM_DB_UPDATES if they are too close
          // The key is the interval between received updates.
          if(updateTimes.length < 2 && NUM_DB_UPDATES > 1) {
             console.warn(`[test:hasyx] [WS] Received only ${updateTimes.length} updates after ${NUM_DB_UPDATES} DB changes. This might indicate an issue or very effective throttling / debouncing.`);
          }
          analyzeUpdateIntervals(done, 950); // Analyze with expected min interval
        }, timeToWaitForAllMessages);
      })();
    }, 25000); // Increased test timeout 
    
    it('should throttle subscription updates according to pollingInterval in HTTP interval mode', (done) => {
      debug('🧪 Testing REAL subscription rate limiting in HTTP INTERVAL mode (explicit ws: false)');
      expect(targetUserForSubscription).toBeDefined();
      expect(subHasyx).toBeDefined();

      const NUM_DB_UPDATES = 3; // Number of distinct changes to make
      const POLLING_INTERVAL_MS = 1500; // Set a specific polling interval for this test
      const originalName = targetUserForSubscription.name + " http poll"; // Make it unique to ensure change

      // Restore name first to ensure it's different from WS test if run sequentially on same user.
       adminHasyx.update<TestUser>({
          table: 'users',
          pk_columns: { id: targetUserForSubscription.id },
          _set: { name: originalName },
        }).then(() => {
          console.log(`[test:hasyx] [HTTP] Target user name set to '${originalName}' for HTTP test.`);

          const subscription = subHasyx.subscribe<TestUser>({
            table: 'users',
            pk_columns: { id: targetUserForSubscription.id },
            returning: ['id', 'name'],
            pollingInterval: POLLING_INTERVAL_MS, // This is the actual polling interval
            ws: false // Explicitly use HTTP polling
          }).subscribe({
            next: (result) => {
              const timestamp = Date.now();
              subscriptionResults.push(result);
              updateTimes.push(timestamp);
              console.log(`[test:hasyx] 📬 [HTTP] Subscription update received at ${new Date(timestamp).toISOString()}:`, JSON.stringify(result));
            },
            error: (err) => {
              console.error('[test:hasyx] ❌ [HTTP] Subscription error:', err);
              done(err);
            }
          });
    
          // Trigger database updates, spaced out enough for polling to pick them up individually
          (async () => {
            for (let i = 0; i < NUM_DB_UPDATES; i++) {
              // Wait a bit longer than half the polling interval, but less than the full, to ensure change is seen on next poll
              await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS / 2 + (i * POLLING_INTERVAL_MS) )); 
              try {
                const newName = `User HTTP Poll Test Update ${i + 1} ${Date.now()}`;
                console.log(`[test:hasyx] 🚀 [HTTP] Triggering DB update ${i+1}/${NUM_DB_UPDATES}: user ${targetUserForSubscription.id}, name: ${newName}`);
                await adminHasyx.update<TestUser>({
                  table: 'users',
                  pk_columns: { id: targetUserForSubscription.id },
                  _set: { name: newName },
                  returning: ['id']
                });
                console.log(`[test:hasyx] ✅ [HTTP] DB update ${i+1} successful.`);
              } catch (dbError) {
                console.error(`[test:hasyx] ❌ [HTTP] DB update ${i+1} failed:`, dbError);
                subscription.unsubscribe();
                done(dbError); 
                return;
              }
            }
    
            // Wait for all polling cycles that should have picked up changes
            const timeToWaitForAllPolls = (NUM_DB_UPDATES * POLLING_INTERVAL_MS) + POLLING_INTERVAL_MS + 2000; // buffer
            console.log(`[test:hasyx] [HTTP] All ${NUM_DB_UPDATES} DB updates triggered. Waiting ${timeToWaitForAllPolls / 1000}s for polling ...`);
            
            setTimeout(async () => {
              subscription.unsubscribe();
              debug('[HTTP] Subscription unsubscribed.');
              
              // Restore original name (or a known state)
              try {
                 await adminHasyx.update<TestUser>({
                    table: 'users',
                    pk_columns: { id: targetUserForSubscription.id },
                    _set: { name: initialUserNames[0] ?? "Default Test User Name" }, // Use initial name if available
                });
                console.log(`[test:hasyx] [HTTP] Target user name restored.`);
              } catch (restoreError) {
                console.warn(`[test:hasyx] [HTTP] Failed to restore user name:`, restoreError)
              }
              
              // For polling, each distinct change should ideally result in one emission after the next poll.
              // The interval between these emissions should be close to POLLING_INTERVAL_MS.
              analyzeUpdateIntervals(done, POLLING_INTERVAL_MS * 0.9); // Allow some leeway (e.g., 90% of interval)
            }, timeToWaitForAllPolls);
          })();
        }).catch(setupError => {
            console.error('[test:hasyx] ❌ [HTTP] Failed to set up user for HTTP test:', setupError);
            done(setupError);
        });
    }, 30000); // Increased test timeout
  });
});
