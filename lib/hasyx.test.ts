import dotenv from 'dotenv';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ApolloError, gql } from '@apollo/client';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
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
      ws: false, 
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
    });
  });
  describe('Hasyx Subscription Rate Limiting Tests', () => {
    let subHasyx: Hasyx; 
    const subscriptionResults: any[] = [];
    const updateTimes: number[] = [];
    
    
    let targetUserForSubscription: TestUser;
    beforeAll(async () => {
      debug('🧪 Setting up Hasyx client for subscription tests (WS-enabled)...');
      if (testUsersData.length === 0) {
        console.error("[test:hasyx] ❌ No test users available for subscription tests. Outer beforeAll might have failed.");
        throw new Error("No test users for subscription tests.");
      }
      targetUserForSubscription = testUsersData[0]; 
      
      console.log(`[test:hasyx] 📡 WebSocket URL: ${HASURA_URL.replace(/^http/, 'ws').replace(/^https/, 'wss')}`);
      console.log(`[test:hasyx] 🔑 Using admin secret: ${ADMIN_SECRET ? ADMIN_SECRET.substring(0, 5) + '...' : 'undefined'}`);
      console.log(`[test:hasyx] 🚀 Creating Apollo client for WebSocket...`);
      
      const subApolloClient = createApolloClient({
        url: HASURA_URL,
        secret: ADMIN_SECRET, 
        ws: true, 
      }) as HasyxApolloClient;
      
      
      
      
      
      
      
      debug(`✓ Apollo client options: url=${subApolloClient._options.url}, ws=${subApolloClient._options.ws}, secret=${subApolloClient._options.secret ? '✓ Set' : 'undefined'}`);
      subHasyx = new Hasyx(subApolloClient, generate);
      debug('✅ WS-enabled Hasyx client for subscriptions is ready.');
    }, 30000); 
    beforeEach(() => {
      subscriptionResults.length = 0;
      updateTimes.length = 0;
      
      
      
      
    });
    
    afterAll(async () => {
      
      if (subHasyx && subHasyx.apolloClient && subHasyx.apolloClient.terminate) {
        debug('ttempting to terminate WebSocket client...');
        subHasyx.apolloClient.terminate();
        debug('WebSocket client termination called.');
      }
      debug('✅ Subscription test Hasyx client cleaned up (attempted).');
    });
    
    function analyzeUpdateIntervals(doneFn: jest.DoneCallback, expectedMinInterval: number = 950) {
      
      debug(`📊 Analyzing update intervals. Raw updateTimes: ${JSON.stringify(updateTimes.map(t => new Date(t).toISOString()))}`);
      if (updateTimes.length < 2) {
        const errorMessage = `[test:hasyx] ⚠️ Insufficient updates to analyze throttling: received ${updateTimes.length} updates. Expected at least 2.`;
        console.error(errorMessage);
        
        
        
        if (updateTimes.length === 0 && expectedMinInterval > 0) { 
             doneFn(new Error("No updates received by subscription."));
             return;
        }
        if (updateTimes.length === 1 && expectedMinInterval > 0) {
             doneFn(new Error("Only one update received, cannot calculate interval."));
             return;
        }
        
        
        doneFn(new Error(errorMessage));
        return;
      }
      const intervals: number[] = [];
      for (let i = 1; i < updateTimes.length; i++) {
        intervals.push(updateTimes[i] - updateTimes[i-1]);
      }
      
      
      debug(`📊 Calculated intervals (ms): [${intervals.join(', ')}]`);
      
      
      if (intervals.length === 0) {
        const errorMessage = `[test:hasyx] ⚠️ No intervals calculated, though ${updateTimes.length} updates were received. This indicates an issue.`;
        console.error(errorMessage);
        doneFn(new Error(errorMessage));
        return;
      }
      
      const minInterval = Math.min(...intervals);
      
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
      const DB_UPDATE_INTERVAL_MS = 200; 
      const THROTTLE_INTERVAL_MS = 1000; 
      const originalName = targetUserForSubscription.name;
      const subscription = subHasyx.subscribe<TestUser>({
        table: 'users',
        pk_columns: { id: targetUserForSubscription.id },
        returning: ['id', 'name'], 
        pollingInterval: THROTTLE_INTERVAL_MS, 
        ws: true 
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
            done(dbError); 
            return;
          }
        }
        
        
        
        
        const timeToWaitForAllMessages = 
            (NUM_DB_UPDATES * DB_UPDATE_INTERVAL_MS) + 
            (NUM_DB_UPDATES * THROTTLE_INTERVAL_MS) + 
            2000; 
            console.log(`[test:hasyx] [WS] All ${NUM_DB_UPDATES} DB updates triggered. Waiting ${timeToWaitForAllMessages / 1000}s for throttled messages...`);
        
        setTimeout(async () => {
          subscription.unsubscribe();
          debug('[WS] Subscription unsubscribed.');
          
          
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
          
          
          
          if(updateTimes.length < 2 && NUM_DB_UPDATES > 1) {
             console.warn(`[test:hasyx] [WS] Received only ${updateTimes.length} updates after ${NUM_DB_UPDATES} DB changes. This might indicate an issue or very effective throttling / debouncing.`);
          }
          analyzeUpdateIntervals(done, 950); 
        }, timeToWaitForAllMessages);
      })();
    }, 25000); 
    
    it('should throttle subscription updates according to pollingInterval in HTTP interval mode', (done) => {
      debug('🧪 Testing REAL subscription rate limiting in HTTP INTERVAL mode (explicit ws: false)');
      expect(targetUserForSubscription).toBeDefined();
      expect(subHasyx).toBeDefined();
      const NUM_DB_UPDATES = 3; 
      const POLLING_INTERVAL_MS = 1500; 
      const originalName = targetUserForSubscription.name + " http poll"; 
      
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
            pollingInterval: POLLING_INTERVAL_MS, 
            ws: false 
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
    
          
          (async () => {
            for (let i = 0; i < NUM_DB_UPDATES; i++) {
              
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
    
            
            const timeToWaitForAllPolls = (NUM_DB_UPDATES * POLLING_INTERVAL_MS) + POLLING_INTERVAL_MS + 2000; 
            console.log(`[test:hasyx] [HTTP] All ${NUM_DB_UPDATES} DB updates triggered. Waiting ${timeToWaitForAllPolls / 1000}s for polling ...`);
            
            setTimeout(async () => {
              subscription.unsubscribe();
              debug('[HTTP] Subscription unsubscribed.');
              
              
              try {
                 await adminHasyx.update<TestUser>({
                    table: 'users',
                    pk_columns: { id: targetUserForSubscription.id },
                    _set: { name: initialUserNames[0] ?? "Default Test User Name" }, 
                });
                console.log(`[test:hasyx] [HTTP] Target user name restored.`);
              } catch (restoreError) {
                console.warn(`[test:hasyx] [HTTP] Failed to restore user name:`, restoreError)
              }
              
              
              
              analyzeUpdateIntervals(done, POLLING_INTERVAL_MS * 0.9); 
            }, timeToWaitForAllPolls);
          })();
        }).catch(setupError => {
            console.error('[test:hasyx] ❌ [HTTP] Failed to set up user for HTTP test:', setupError);
            done(setupError);
        });
    }, 30000); 
  });
});
