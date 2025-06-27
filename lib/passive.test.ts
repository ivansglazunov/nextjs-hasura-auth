import { PassiveClient } from './passive';
import { API_URL } from './url';
import 'mock-local-storage';

const ONE_DAY_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const MANUAL_TESTING = !!+process?.env?.MANUAL_TESTING!;

// Only run these tests if MANUAL_TESTING environment variable is set
(MANUAL_TESTING ? describe : describe.skip)('Passive Authentication Manual Testing', function(this: any) {

  it('should authenticate via Google OAuth with passive mode', async () => {
    const jwt = await new Promise<string>((resolve) => {
      const passiveClient = new PassiveClient({
        onDone: (jwt: string) => {
          resolve(jwt);
        }
      });

      console.log('\n🔗 Google OAuth Authentication Instructions:');
      console.log('1. Set NEXT_PUBLIC_PASSIVE_AUTH=1 in your environment');
      console.log('2. Open http://localhost:3000 in your browser');
      console.log('3. Click on "Sign in with Google" button');
      console.log('4. Complete Google authentication in the popup');
      console.log(`5. The passive client will detect completion with ID: ${passiveClient.id}`);
      console.log('\nWaiting for authentication to complete...\n');
      
      // For testing, we can manually check the passive ID
      console.log(`📋 Manual test: Use passive ID "${passiveClient.id}" to check auth_passive table`);
      console.log(`🔍 Test URL: curl -s "http://localhost:3000/api/auth_passive?passive=${passiveClient.id}"`);

      passiveClient.start();
    });

    expect(typeof jwt).toBe('string');
    expect(jwt.length).toBeGreaterThan(0);
  }, ONE_DAY_TIMEOUT);

  it('should authenticate via Yandex OAuth with passive mode', async () => {
    const jwt = await new Promise<string>((resolve) => {
      const passiveClient = new PassiveClient({
        onDone: (jwt: string) => {
          resolve(jwt);
        }
      });

      const authUrl = `${API_URL}/api/auth/signin/yandex?callbackUrl=${encodeURIComponent(`/?passive=${passiveClient.id}`)}`;
      
      console.log('\n🔗 Yandex OAuth Authentication URL:');
      console.log(authUrl);
      console.log('\nOpen this URL in your browser to authenticate with Yandex');
      console.log('Waiting for authentication to complete...\n');

      passiveClient.start();
    });

    expect(typeof jwt).toBe('string');
    expect(jwt.length).toBeGreaterThan(0);
  }, ONE_DAY_TIMEOUT);

  it('should authenticate via GitHub OAuth with passive mode', async () => {
    const jwt = await new Promise<string>((resolve) => {
      const passiveClient = new PassiveClient({
        onDone: (jwt: string) => {
          resolve(jwt);
        }
      });

      const authUrl = `${API_URL}/api/auth/signin/github?callbackUrl=${encodeURIComponent(`/?passive=${passiveClient.id}`)}`;
      
      console.log('\n🔗 GitHub OAuth Authentication URL:');
      console.log(authUrl);
      console.log('\nOpen this URL in your browser to authenticate with GitHub');
      console.log('Waiting for authentication to complete...\n');

      passiveClient.start();
    });

    expect(typeof jwt).toBe('string');
    expect(jwt.length).toBeGreaterThan(0);
  }, ONE_DAY_TIMEOUT);

  it('should authenticate via Facebook OAuth with passive mode', async () => {
    const jwt = await new Promise<string>((resolve) => {
      const passiveClient = new PassiveClient({
        onDone: (jwt: string) => {
          resolve(jwt);
        }
      });

      const authUrl = `${API_URL}/api/auth/signin/facebook?callbackUrl=${encodeURIComponent(`/?passive=${passiveClient.id}`)}`;
      
      console.log('\n🔗 Facebook OAuth Authentication URL:');
      console.log(authUrl);
      console.log('\nOpen this URL in your browser to authenticate with Facebook');
      console.log('Waiting for authentication to complete...\n');

      passiveClient.start();
    });

    expect(typeof jwt).toBe('string');
    expect(jwt.length).toBeGreaterThan(0);
  }, ONE_DAY_TIMEOUT);

  it('should authenticate via VK OAuth with passive mode', async () => {
    const jwt = await new Promise<string>((resolve) => {
      const passiveClient = new PassiveClient({
        onDone: (jwt: string) => {
          resolve(jwt);
        }
      });

      const authUrl = `${API_URL}/api/auth/signin/vk?callbackUrl=${encodeURIComponent(`/?passive=${passiveClient.id}`)}`;
      
      console.log('\n🔗 VK OAuth Authentication URL:');
      console.log(authUrl);
      console.log('\nOpen this URL in your browser to authenticate with VK');
      console.log('Waiting for authentication to complete...\n');

      passiveClient.start();
    });

    expect(typeof jwt).toBe('string');
    expect(jwt.length).toBeGreaterThan(0);
  }, ONE_DAY_TIMEOUT);

  it('should authenticate via Telegram with passive mode', async () => {
    const jwt = await new Promise<string>((resolve) => {
      const passiveClient = new PassiveClient({
        onDone: (jwt: string) => {
          resolve(jwt);
        }
      });

      const authUrl = `${API_URL}/api/auth/signin/telegram?callbackUrl=${encodeURIComponent(`/?passive=${passiveClient.id}`)}`;
      
      console.log('\n🔗 Telegram Authentication URL:');
      console.log(authUrl);
      console.log('\nOpen this URL in your browser to authenticate with Telegram');
      console.log('Waiting for authentication to complete...\n');

      passiveClient.start();
    });

    expect(typeof jwt).toBe('string');
    expect(jwt.length).toBeGreaterThan(0);
  }, ONE_DAY_TIMEOUT);

  it('should authenticate via Credentials with passive mode (using main page)', async () => {
    const jwt = await new Promise<string>((resolve) => {
      const passiveClient = new PassiveClient({
        onDone: (jwt: string) => {
          resolve(jwt);
        }
      });

      // For credentials, point to diagnostics page where the credentials form is located
      const authUrl = `${API_URL}/hasyx/diagnostics?passive=${passiveClient.id}`;
      
      console.log('\n🔗 Credentials Authentication URL:');
      console.log(authUrl);
      console.log('\n📋 Instructions:');
      console.log('1. Make sure NEXT_PUBLIC_PASSIVE_AUTH=1 is set');
      console.log('2. Open the URL above in your browser');
      console.log('3. Use the standard credentials form on diagnostics page');
      console.log('4. Enter: test@example.com / 123456');
      console.log('\nWaiting for authentication to complete...\n');

      passiveClient.start();
    });

    expect(typeof jwt).toBe('string');
    expect(jwt.length).toBeGreaterThan(0);
  }, ONE_DAY_TIMEOUT);

  // Test basic auth_passive endpoint functionality
  it('should return "lost" status for non-existent passive ID', async () => {
    const response = await fetch(`${API_URL}/api/auth_passive?passive=non-existent-id`);
    const data = await response.json();
    
    expect(data.status).toBe('lost');
  });

  // Test auth_passive endpoint error handling
  it('should return error for missing passive parameter', async () => {
    const response = await fetch(`${API_URL}/api/auth_passive`);
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing passive parameter');
  });
}); 