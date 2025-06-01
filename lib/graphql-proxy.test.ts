import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import Debug from 'debug';

describe('[DEBUG] closeConnections validation', () => {
  it('should handle invalid WebSocket close codes correctly', () => {
    // Mock WebSocket objects
    const mockClient = {
      readyState: 1, // OPEN
      close: jest.fn()
    };
    
    const mockHasuraWs = {
      readyState: 1, // OPEN  
      close: jest.fn()
    };
    
    // Simulate the closeConnections function logic
    const closeConnections = (code: number | string = 1000, reason = 'Closing connection') => {
      let closeCode: number;
      
      if (typeof code === 'number') {
        // Validate that the code is in the valid range for WebSocket close codes
        if (code >= 1000 && code <= 4999) {
          closeCode = code;
        } else {
          closeCode = 1000; // Default close code for normal closure
        }
      } else if (typeof code === 'string') {
        const parsedCode = parseInt(code, 10);
        if (!isNaN(parsedCode) && parsedCode >= 1000 && parsedCode <= 4999) {
          closeCode = parsedCode;
        } else {
          closeCode = 1000; // Default close code for normal closure
        }
      } else {
        closeCode = 1000; // Default close code for normal closure
      }
      
      const closeReason = typeof reason === 'string' ? reason : 'Closing connection';
      
      mockClient.close(closeCode, closeReason);
      mockHasuraWs.close(closeCode, closeReason);
      
      return { closeCode, closeReason };
    };
    
    // Test various invalid codes
    const testCases = [
      { input: undefined, expected: 1000 },
      { input: null, expected: 1000 },
      { input: 'invalid', expected: 1000 },
      { input: 999, expected: 1000 }, // Below valid range
      { input: 5000, expected: 1000 }, // Above valid range
      { input: 1001, expected: 1001 }, // Valid code
      { input: '1002', expected: 1002 }, // Valid string code
      { input: '999', expected: 1000 }, // Invalid string code
      { input: 'abc', expected: 1000 }, // Non-numeric string
    ];
    
    testCases.forEach(({ input, expected }) => {
      jest.clearAllMocks();
      const result = closeConnections(input as any, 'test reason');
      
      expect(result.closeCode).toBe(expected);
      expect(mockClient.close).toHaveBeenCalledWith(expected, 'test reason');
      expect(mockHasuraWs.close).toHaveBeenCalledWith(expected, 'test reason');
    });
  });
});

describe('[DEBUG] Hasura Permissions Diagnosis', () => {
  it('should test anonymous role subscription permissions for users table', async () => {
    const wsUrl = 'ws://localhost:3003/api/graphql';
    const debug = Debug('test:permissions');
    
    debug('=== TESTING ANONYMOUS ROLE PERMISSIONS ===');
    
    // Test direct Hasura connection first
    const directHasuraWs = 'wss://hasura.deep.foundation/v1/graphql';
    debug(`Testing direct Hasura connection: ${directHasuraWs}`);
    
    try {
      const directWs = new WebSocket(directHasuraWs, 'graphql-transport-ws', {
        headers: {
          'Authorization': `Bearer ${await generateJWT('test-anon-user', {
            'x-hasura-allowed-roles': ['anonymous'],
            'x-hasura-default-role': 'anonymous',
            'x-hasura-user-id': 'test-anon-user'
          })}`
        }
      });

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          directWs.close();
          reject(new Error('Direct Hasura connection timeout'));
        }, 10000);

        directWs.on('open', () => {
          debug('✅ Direct Hasura WebSocket connected');
          directWs.send(JSON.stringify({ type: 'connection_init', payload: {} }));
        });

        directWs.on('message', (data: Buffer) => {
          const message = JSON.parse(data.toString());
          debug(`📬 Direct Hasura message:`, message);
          
          if (message.type === 'connection_ack') {
            debug('🤝 Direct Hasura connection acknowledged');
            
            // Test subscription
            const subscriptionQuery = {
              id: 'test-subscription',
              type: 'subscribe',
              payload: {
                query: `subscription TestUsers {
                  users {
                    id
                    __typename
                  }
                }`
              }
            };
            
            debug(`📤 Sending subscription to direct Hasura:`, subscriptionQuery);
            directWs.send(JSON.stringify(subscriptionQuery));
          } else if (message.type === 'error') {
            debug(`❌ Direct Hasura error:`, message);
            clearTimeout(timeout);
            directWs.close();
            resolve(message);
          } else if (message.type === 'next' || message.type === 'data') {
            debug(`✅ Direct Hasura data received:`, message);
            clearTimeout(timeout);
            directWs.close();
            resolve(message);
          } else if (message.type === 'complete') {
            debug(`✅ Direct Hasura subscription completed`);
            clearTimeout(timeout);
            directWs.close();
            resolve(message);
          }
        });

        directWs.on('error', (error) => {
          debug(`❌ Direct Hasura WebSocket error:`, error);
          clearTimeout(timeout);
          reject(error);
        });
      });

    } catch (error) {
      debug(`❌ Direct Hasura test failed:`, error);
    }

    // Now test through proxy
    debug(`Testing through proxy: ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl, 'graphql-transport-ws');
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Proxy test timeout'));
      }, 10000);

      ws.on('open', () => {
        debug('✅ Proxy WebSocket connected');
        ws.send(JSON.stringify({ type: 'connection_init', payload: {} }));
      });

      ws.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());
        debug(`📬 Proxy message:`, message);
        
        if (message.type === 'connection_ack') {
          debug('🤝 Proxy connection acknowledged');
          
          // Test subscription
          const subscriptionQuery = {
            id: 'test-subscription',
            type: 'subscribe',
            payload: {
              query: `subscription TestUsers {
                users {
                  id
                  __typename
                }
              }`
            }
          };
          
          debug(`📤 Sending subscription to proxy:`, subscriptionQuery);
          ws.send(JSON.stringify(subscriptionQuery));
        } else if (message.type === 'error') {
          debug(`❌ Proxy error:`, message);
          clearTimeout(timeout);
          ws.close();
          resolve(message);
        } else if (message.type === 'next' || message.type === 'data') {
          debug(`✅ Proxy data received:`, message);
          clearTimeout(timeout);
          ws.close();
          resolve(message);
        } else if (message.type === 'complete') {
          debug(`✅ Proxy subscription completed`);
          clearTimeout(timeout);
          ws.close();
          resolve(message);
        }
      });

      ws.on('error', (error) => {
        debug(`❌ Proxy WebSocket error:`, error);
        clearTimeout(timeout);
        reject(error);
      });
    });
  }, 30000);

  it('should test admin role subscription permissions for users table', async () => {
    const wsUrl = 'ws://localhost:3003/api/graphql';
    const debug = Debug('test:permissions:admin');
    
    debug('=== TESTING ADMIN ROLE PERMISSIONS ===');
    
    // Test with admin secret via proxy
    const ws = new WebSocket(wsUrl, 'graphql-transport-ws', {
      headers: {
        'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET
      }
    });
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Admin test timeout'));
      }, 10000);

      ws.on('open', () => {
        debug('✅ Admin WebSocket connected');
        ws.send(JSON.stringify({ type: 'connection_init', payload: {} }));
      });

      ws.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());
        debug(`📬 Admin message:`, message);
        
        if (message.type === 'connection_ack') {
          debug('🤝 Admin connection acknowledged');
          
          // Test subscription
          const subscriptionQuery = {
            id: 'test-subscription',
            type: 'subscribe',
            payload: {
              query: `subscription TestUsers {
                users {
                  id
                  name
                  email
                  __typename
                }
              }`
            }
          };
          
          debug(`📤 Sending subscription with admin role:`, subscriptionQuery);
          ws.send(JSON.stringify(subscriptionQuery));
        } else if (message.type === 'error') {
          debug(`❌ Admin error:`, message);
          clearTimeout(timeout);
          ws.close();
          resolve(message);
        } else if (message.type === 'next' || message.type === 'data') {
          debug(`✅ Admin data received:`, message);
          clearTimeout(timeout);
          ws.close();
          resolve(message);
        } else if (message.type === 'complete') {
          debug(`✅ Admin subscription completed`);
          clearTimeout(timeout);
          ws.close();
          resolve(message);
        }
      });

      ws.on('error', (error) => {
        debug(`❌ Admin WebSocket error:`, error);
        clearTimeout(timeout);
        reject(error);
      });
    });
  }, 15000);
}); 