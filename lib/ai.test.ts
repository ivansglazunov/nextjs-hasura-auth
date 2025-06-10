import { AI } from './ai';
import { OpenRouter } from './openrouter';
import Debug from './debug';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const debug = Debug('test:ai');

// Environment availability check
const isOpenRouterAvailable = Boolean(process.env.OPENROUTER_API_KEY);
const TEST_MODEL = process.env.OPENROUTER_MODEL || 'gpt-3.5-turbo';

describe('[DEBUG] Real AI Environment Check', () => {
  it('should verify OpenRouter API key availability for real AI tests', () => {
    debug(`OpenRouter environment check: ${isOpenRouterAvailable ? 'available' : 'missing API key'}`);
    debug(`OpenRouter API key: ${process.env.OPENROUTER_API_KEY ? 'configured' : 'missing'}`);
    debug(`Test model: ${TEST_MODEL}`);
    
    if (!isOpenRouterAvailable) {
      debug('To run real AI tests, set OPENROUTER_API_KEY environment variable');
      debug('Get API key from: https://openrouter.ai/keys');
    }
    
    expect(typeof isOpenRouterAvailable).toBe('boolean');
  });

  it('should test AI instance creation without API calls', () => {
    const provider = new OpenRouter({
      token: process.env.OPENROUTER_API_KEY || 'test-key',
      model: TEST_MODEL
    });

    const ai = new AI({
      provider,
      systemPrompt: 'You are a helpful AI assistant for testing purposes.'
    });

    expect(ai).toBeInstanceOf(AI);
    expect(ai.memory).toHaveLength(1);
    expect(ai.memory[0].role).toBe('system');
    
    debug('Real AI instance created successfully');
  });
});

describe('Real AI Class Tests', () => {
  
  it('should handle real memory management operations', () => {
    const provider = new OpenRouter({
      token: process.env.OPENROUTER_API_KEY || 'test-key',
      model: TEST_MODEL
    });

    const ai = new AI({
      provider,
      systemPrompt: 'Test system prompt'
    });
    
    try {
      debug('Testing real memory management');
      
      // Check initial memory has system message
      expect(ai.memory).toHaveLength(1);
      expect(ai.memory[0].role).toBe('system');
      expect(ai.memory[0].content).toBe('Test system prompt');
      
      debug('Real memory operations working correctly');
      
      // Test memory clearing
      ai.clearMemory();
      expect(ai.memory).toHaveLength(1); // Should have system prompt back
      expect(ai.memory[0].role).toBe('system');
      
      debug('Real memory clearing working correctly');
      
    } finally {
      ai.clearMemory();
    }
  });

  it('should make real OpenRouter API call if credentials available', async () => {
    if (!isOpenRouterAvailable) {
      debug('Skipping real OpenRouter API test - API key not available');
      return;
    }
    
    const provider = new OpenRouter({
      token: process.env.OPENROUTER_API_KEY!,
      model: TEST_MODEL
    });

    const ai = new AI({
      provider
    });
    
    try {
      debug('Testing real OpenRouter API call');
      
      // Simple question
      const response = await ai.ask('What is 2+2? Please answer briefly in one sentence.');
      
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
      expect(response.toLowerCase()).toMatch(/4|four/);
      
      debug(`Real OpenRouter API response received: ${response.substring(0, 100)}...`);
      
      // Check that memory contains the conversation
      expect(ai.memory.length).toBeGreaterThan(1);
      
      // Should have user message and assistant response
      const userMessage = ai.memory.find(m => m.role === 'user');
      const assistantMessage = ai.memory.find(m => m.role === 'assistant');
      
      expect(userMessage).toBeTruthy();
      expect(assistantMessage).toBeTruthy();
      expect(userMessage!.content).toContain('What is 2+2');
      
      debug('Real OpenRouter API conversation stored in memory correctly');
      
    } finally {
      ai.clearMemory();
    }
  }, 30000);

  it('should handle real streaming operations if supported', async () => {
    if (!isOpenRouterAvailable) {
      debug('Skipping real streaming test - API key not available');
      return;
    }
    
    const provider = new OpenRouter({
      token: process.env.OPENROUTER_API_KEY!,
      model: TEST_MODEL
    });

    const streamChunks: string[] = [];
    const ai = new AI({
      provider,
      onStream: (chunk: string) => {
        streamChunks.push(chunk);
      },
      onStreamEnd: () => {
        debug('Stream ended');
      }
    });
    
    try {
      debug('Testing real streaming operations');
      
      const response = await ai.askStream('Count from 1 to 3. Be brief.');
      
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
      expect(streamChunks.length).toBeGreaterThan(0);
      
      // All chunks combined should equal the final response
      const combinedChunks = streamChunks.join('');
      expect(combinedChunks).toBe(response);
      
      debug('Real streaming operations working correctly');
      
    } finally {
      ai.clearMemory();
    }
  }, 45000);

  it('should handle conversation memory correctly', async () => {
    if (!isOpenRouterAvailable) {
      debug('Skipping conversation memory test - API key not available');
      return;
    }
    
    const provider = new OpenRouter({
      token: process.env.OPENROUTER_API_KEY!,
      model: TEST_MODEL
    });

    const ai = new AI({
      provider,
      systemPrompt: 'You are a helpful assistant. Remember information from previous messages.'
    });
    
    try {
      debug('Testing conversation memory');
      
      // First message
      await ai.ask('My name is TestUser');
      expect(ai.memory.length).toBe(3); // system + user + assistant
      
      // Second message that should reference the first
      const response = await ai.ask('What is my name?');
      expect(typeof response).toBe('string');
      expect(response.toLowerCase()).toContain('testuser');
      expect(ai.memory.length).toBe(5); // system + user1 + assistant1 + user2 + assistant2
      
      debug('Conversation memory working correctly');
      
    } finally {
      ai.clearMemory();
    }
  }, 60000);

  it('should show real AI testing environment status', () => {
    debug('Real AI tests use actual OpenRouter API:');
    debug(`  • Real OpenRouter API Key (${process.env.OPENROUTER_API_KEY ? 'configured' : 'missing'})`);
    debug(`  • Real AI Model (${TEST_MODEL})`);
    debug('  • Real HTTP requests to OpenRouter API');
    debug('  • Real AI conversations and responses');
    debug('  • Real streaming support');
    debug('  • Each test creates isolated AI instance');
    debug('  • Each test cleans up its own memory');
    
    if (isOpenRouterAvailable) {
      debug('  • Environment: READY for real AI testing');
    } else {
      debug('  • Environment: MISSING API key - some tests will be skipped');
      debug('  • Get API key from: https://openrouter.ai/keys');
    }
    
    expect(true).toBe(true); // Always pass
  });
}); 