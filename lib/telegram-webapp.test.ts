import { validateTelegramInitData, parseInitData } from './telegram-miniapp-server';
import Debug from './debug';

const debug = Debug('telegram-webapp:test');

describe('Telegram WebApp Integration', () => {
  // Generate unique test identifier to avoid conflicts
  const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  it('should validate telegram initData correctly', async () => {
    debug(`Starting test: ${testId}`);
    
    // Mock environment for test
    const originalEnv = process.env.TELEGRAM_LOGIN_BOT_TOKEN;
    
    try {
      // Set test bot token
      process.env.TELEGRAM_LOGIN_BOT_TOKEN = 'test_bot_token_for_validation';
      
      // Test data that should fail validation (no real telegram signature)
      const invalidInitData = 'user=%7B%22id%22%3A123456%2C%22first_name%22%3A%22Test%22%7D&auth_date=1234567890&hash=invalid_hash';
      
      const isValid = await validateTelegramInitData(invalidInitData);
      
      // Should be false because we don't have a real Telegram signature
      expect(isValid).toBe(false);
      
      debug(`Test ${testId}: Validation correctly rejected invalid data`);
      
    } finally {
      // Restore original environment
      if (originalEnv !== undefined) {
        process.env.TELEGRAM_LOGIN_BOT_TOKEN = originalEnv;
      } else {
        delete process.env.TELEGRAM_LOGIN_BOT_TOKEN;
      }
    }
  });

  it('should parse telegram initData correctly', async () => {
    debug(`Starting parse test: ${testId}`);
    
    try {
      // Valid initData format for testing
      const testInitData = 'user=%7B%22id%22%3A123456789%2C%22first_name%22%3A%22John%22%2C%22last_name%22%3A%22Doe%22%2C%22username%22%3A%22johndoe%22%2C%22language_code%22%3A%22en%22%2C%22is_premium%22%3Atrue%7D&auth_date=1640995200&hash=test_hash&query_id=test_query_id';
      
      const parsed = parseInitData(testInitData);
      
      expect(parsed).toBeDefined();
      expect(parsed?.user).toBeDefined();
      expect(parsed?.user?.id).toBe(123456789);
      expect(parsed?.user?.first_name).toBe('John');
      expect(parsed?.user?.last_name).toBe('Doe');
      expect(parsed?.user?.username).toBe('johndoe');
      expect(parsed?.user?.language_code).toBe('en');
      expect(parsed?.user?.is_premium).toBe(true);
      expect(parsed?.auth_date).toBe(1640995200);
      expect(parsed?.hash).toBe('test_hash');
      expect(parsed?.query_id).toBe('test_query_id');
      
      debug(`Test ${testId}: Parse test completed successfully`);
      
    } catch (error) {
      debug(`Test ${testId}: Parse test failed:`, error);
      throw error;
    }
  });

  it('should handle invalid initData gracefully', async () => {
    debug(`Starting invalid data test: ${testId}`);
    
    try {
      // Test empty string
      const emptyResult = parseInitData('');
      expect(emptyResult).toBeNull();
      
      // Test malformed data
      const invalidResult = parseInitData('invalid_data_format');
      expect(invalidResult).toBeNull();
      
      // Test missing required fields
      const missingHashResult = parseInitData('user=%7B%22id%22%3A123%7D&auth_date=1640995200');
      expect(missingHashResult).toBeNull();
      
      const missingAuthDateResult = parseInitData('user=%7B%22id%22%3A123%7D&hash=test_hash');
      expect(missingAuthDateResult).toBeNull();
      
      debug(`Test ${testId}: Invalid data handling test completed successfully`);
      
    } catch (error) {
      debug(`Test ${testId}: Invalid data test failed:`, error);
      throw error;
    }
  });

  it('should validate environment variables requirement', async () => {
    debug(`Starting environment test: ${testId}`);
    
    const originalEnv = process.env.TELEGRAM_LOGIN_BOT_TOKEN;
    
    try {
      // Remove bot token
      delete process.env.TELEGRAM_LOGIN_BOT_TOKEN;
      
      const testInitData = 'user=%7B%22id%22%3A123%7D&auth_date=1640995200&hash=test_hash';
      const isValid = await validateTelegramInitData(testInitData);
      
      // Should be false when bot token is not set
      expect(isValid).toBe(false);
      
      debug(`Test ${testId}: Environment test completed successfully`);
      
    } finally {
      // Restore original environment
      if (originalEnv !== undefined) {
        process.env.TELEGRAM_LOGIN_BOT_TOKEN = originalEnv;
      }
    }
  });

  it('should handle user data extraction correctly', async () => {
    debug(`Starting user data test: ${testId}`);
    
    try {
      // Test with minimal user data
      const minimalUserData = 'user=%7B%22id%22%3A987654321%2C%22first_name%22%3A%22Alice%22%7D&auth_date=1640995200&hash=test_hash';
      const parsed = parseInitData(minimalUserData);
      
      expect(parsed?.user?.id).toBe(987654321);
      expect(parsed?.user?.first_name).toBe('Alice');
      expect(parsed?.user?.last_name).toBeUndefined();
      expect(parsed?.user?.username).toBeUndefined();
      expect(parsed?.user?.is_premium).toBeUndefined();
      
      // Test with complete user data
      const completeUserData = 'user=%7B%22id%22%3A111222333%2C%22first_name%22%3A%22Bob%22%2C%22last_name%22%3A%22Smith%22%2C%22username%22%3A%22bobsmith%22%2C%22photo_url%22%3A%22https%3A//example.com/photo.jpg%22%2C%22language_code%22%3A%22ru%22%2C%22is_premium%22%3Afalse%7D&auth_date=1640995200&hash=test_hash';
      const parsedComplete = parseInitData(completeUserData);
      
      expect(parsedComplete?.user?.id).toBe(111222333);
      expect(parsedComplete?.user?.first_name).toBe('Bob');
      expect(parsedComplete?.user?.last_name).toBe('Smith');
      expect(parsedComplete?.user?.username).toBe('bobsmith');
      expect(parsedComplete?.user?.photo_url).toBe('https://example.com/photo.jpg');
      expect(parsedComplete?.user?.language_code).toBe('ru');
      expect(parsedComplete?.user?.is_premium).toBe(false);
      
      debug(`Test ${testId}: User data test completed successfully`);
      
    } catch (error) {
      debug(`Test ${testId}: User data test failed:`, error);
      throw error;
    }
  });
}); 