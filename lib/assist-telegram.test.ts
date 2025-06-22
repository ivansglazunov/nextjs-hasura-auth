import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { configureTelegramBot } from './assist-telegram';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock the url module
jest.mock('./url', () => ({
  API_URL: 'https://example.com'
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('assist-telegram webhook configuration', () => {
  let testEnvPath: string;
  let mockRl: any;

  beforeEach(() => {
    // Create temporary test environment
    const tempDir = path.join(__dirname, '..', 'temp-test-assist-telegram');
    fs.ensureDirSync(tempDir);
    testEnvPath = path.join(tempDir, '.env.test');

    // Create mock readline interface
    mockRl = {
      question: jest.fn(),
      close: jest.fn(),
    };

    // Reset fetch mock
    mockFetch.mockReset();
  });

  afterEach(() => {
    // Clean up temporary test files
    const tempDir = path.dirname(testEnvPath);
    if (fs.existsSync(tempDir)) {
      fs.removeSync(tempDir);
    }
  });

  it('should set webhook when user agrees and token is provided', async () => {
    // Setup initial .env with bot token
    fs.writeFileSync(testEnvPath, 'TELEGRAM_BOT_TOKEN=123456789:ABCDEF\nTELEGRAM_BOT_NAME=test_bot\n');

    // Mock user interactions - need to say yes to reconfigure to get to webhook question
    mockRl.question.mockImplementation((question: string, callback: (answer: string) => void) => {
      if (question.includes('Do you want to reconfigure')) {
        callback('yes'); // Yes, reconfigure to access webhook options
      } else if (question.includes('Do you want to change it')) {
        callback('no'); // Keep current token and bot name
      } else if (question.includes('Do you want to set this application as the webhook URL')) {
        callback('yes'); // Yes, set webhook
      } else {
        callback('no'); // Default to no for other questions
      }
    });

    // Mock successful webhook API response
    (mockFetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, description: 'Webhook was set' })
    });

    // Run the configuration
    await configureTelegramBot(mockRl, testEnvPath);

    // Verify webhook API was called with correct URL
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bot123456789:ABCDEF/setWebhook?url=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Ftelegram_bot'
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should not set webhook when user declines', async () => {
    // Setup initial .env with bot token
    fs.writeFileSync(testEnvPath, 'TELEGRAM_BOT_TOKEN=123456789:ABCDEF\nTELEGRAM_BOT_NAME=test_bot\n');

    // Mock user interactions
    mockRl.question.mockImplementation((question: string, callback: (answer: string) => void) => {
      if (question.includes('Do you want to reconfigure')) {
        callback('no'); // Don't reconfigure existing settings
      } else if (question.includes('Do you want to set this application as the webhook URL')) {
        callback('no'); // No, don't set webhook
      } else {
        callback('no'); // Default to no for other questions
      }
    });

    // Run the configuration
    await configureTelegramBot(mockRl, testEnvPath);

    // Verify webhook API was not called
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should handle webhook API errors gracefully', async () => {
    // Setup initial .env with bot token
    fs.writeFileSync(testEnvPath, 'TELEGRAM_BOT_TOKEN=123456789:ABCDEF\nTELEGRAM_BOT_NAME=test_bot\n');

    // Mock user interactions - need to say yes to reconfigure to get to webhook question
    mockRl.question.mockImplementation((question: string, callback: (answer: string) => void) => {
      if (question.includes('Do you want to reconfigure')) {
        callback('yes'); // Yes, reconfigure to access webhook options
      } else if (question.includes('Do you want to change it')) {
        callback('no'); // Keep current token and bot name
      } else if (question.includes('Do you want to set this application as the webhook URL')) {
        callback('yes'); // Yes, set webhook
      } else {
        callback('no'); // Default to no for other questions
      }
    });

    // Mock failed webhook API response
    (mockFetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: false, description: 'Bad webhook URL' })
    });

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Run the configuration
    await configureTelegramBot(mockRl, testEnvPath);

    // Verify error was logged
    expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to set webhook:', 'Bad webhook URL');

    consoleSpy.mockRestore();
  });
}); 