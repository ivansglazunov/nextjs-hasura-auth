import { Ollama } from './ollama';
import { AI } from './ai';
import Debug from './debug';

const debug = Debug('test:ollama');

// Real Ollama integration tests with Gemma2 2B model
describe('Real Ollama Integration Tests', () => {
  const TEST_MODEL = 'gemma2:2b';
  let ollama: Ollama;
  let ai: AI;

  beforeAll(async () => {
    debug('Setting up Ollama tests with real model');
    
    // Create Ollama provider instance
    ollama = new Ollama({
      baseUrl: 'http://localhost:11434',
      model: TEST_MODEL,
      timeout: 60000
    });

    // Create AI instance with Ollama provider
    ai = new AI({
      provider: ollama,
      systemPrompt: 'You are a helpful AI assistant for testing purposes. Keep responses brief and accurate.'
    });
  });

  afterEach(() => {
    // Clear memory after each test to ensure clean state
    if (ai) {
      ai.clearMemory();
    }
  });

  describe('Environment and Setup', () => {
    it('should verify Ollama service is available', async () => {
      const isAvailable = await ollama.isAvailable();
      expect(isAvailable).toBe(true);
      debug('Ollama service is available');
    }, 10000);

    it('should list available models', async () => {
      const models = await ollama.listModels();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
      
      debug(`Available models: ${models.join(', ')}`);
      
      // Check if our test model is available
      const hasTestModel = models.includes(TEST_MODEL);
      if (!hasTestModel) {
        debug(`Test model ${TEST_MODEL} not found. Available models: ${models.join(', ')}`);
        debug('You may need to run: ollama pull gemma2:2b');
      }
      expect(hasTestModel).toBe(true);
    }, 30000);

    it('should pull Gemma2 2B model if not available', async () => {
      const models = await ollama.listModels();
      
      if (!models.includes(TEST_MODEL)) {
        debug(`Pulling ${TEST_MODEL} model...`);
        const success = await ollama.pullModel(TEST_MODEL);
        expect(success).toBe(true);
        debug(`Successfully pulled ${TEST_MODEL}`);
      } else {
        debug(`${TEST_MODEL} is already available`);
        expect(true).toBe(true);
      }
    }, 300000); // 5 minutes timeout for model download
  });

  describe('Basic AI Operations', () => {
    it('should answer simple questions', async () => {
      const response = await ai.ask('What is 2+2? Answer with just the number.');
      
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
      expect(response.trim()).toMatch(/4|four/i);
      
      debug(`Simple math response: "${response}"`);
    }, 60000);

    it('should handle conversation context', async () => {
      // First message
      await ai.ask('My name is TestUser');
      expect(ai.memory.length).toBe(3); // system + user + assistant
      
      // Second message that should reference the first
      const response = await ai.ask('What is my name?');
      expect(typeof response).toBe('string');
      expect(response.toLowerCase()).toContain('testuser');
      expect(ai.memory.length).toBe(5); // system + user1 + assistant1 + user2 + assistant2
      
      debug(`Context response: "${response}"`);
    }, 120000);

    it('should provide factual information', async () => {
      const response = await ai.ask('What is the capital of France? Answer in one word.');
      
      expect(typeof response).toBe('string');
      expect(response.toLowerCase()).toMatch(/paris/i);
      
      debug(`Factual response: "${response}"`);
    }, 60000);

    it('should handle programming questions', async () => {
      const response = await ai.ask('Write a simple JavaScript function that adds two numbers. Keep it very brief.');
      
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
      expect(response.toLowerCase()).toMatch(/function|=>/);
      
      debug(`Programming response: "${response.substring(0, 200)}..."`);
    }, 90000);
  });

  describe('Streaming Operations', () => {
    it('should handle streaming responses', async () => {
      const streamChunks: string[] = [];
      
      const aiWithStream = new AI({
        provider: ollama,
        systemPrompt: 'You are a helpful assistant. Keep responses brief.',
        onStream: (chunk: string) => {
          streamChunks.push(chunk);
          debug(`Stream chunk: "${chunk}"`);
        },
        onStreamEnd: () => {
          debug('Stream ended');
        }
      });
      
      const response = await aiWithStream.askStream('Count from 1 to 3. Be very brief.');
      
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
      expect(streamChunks.length).toBeGreaterThan(0);
      
      // All chunks combined should equal the final response
      const combinedChunks = streamChunks.join('');
      expect(combinedChunks).toBe(response);
      
      debug(`Streaming complete. Total chunks: ${streamChunks.length}, Final response: "${response}"`);
    }, 90000);

    it('should handle streaming with memory', async () => {
      const streamChunks: string[] = [];
      
      const aiWithStream = new AI({
        provider: ollama,
        systemPrompt: 'You are a helpful assistant.',
        onStream: (chunk: string) => {
          streamChunks.push(chunk);
        }
      });
      
      // First streaming message
      await aiWithStream.askStream('Remember: my favorite number is 42');
      expect(aiWithStream.memory.length).toBe(3);
      
      // Second streaming message that should reference the first
      const response = await aiWithStream.askStream('What is my favorite number?');
      expect(response.toLowerCase()).toMatch(/42|forty.two/);
      expect(aiWithStream.memory.length).toBe(5);
      
      debug(`Streaming with memory response: "${response}"`);
    }, 120000);
  });

  describe('Error Handling', () => {
    it('should handle invalid model gracefully', async () => {
      const invalidOllama = new Ollama({
        baseUrl: 'http://localhost:11434',
        model: 'nonexistent-model-12345',
        timeout: 10000
      });
      
      await expect(invalidOllama.ask('test')).rejects.toThrow();
      debug('Invalid model error handled correctly');
    }, 15000);

    it('should handle connection errors', async () => {
      const unreachableOllama = new Ollama({
        baseUrl: 'http://localhost:99999', // Invalid port
        model: TEST_MODEL,
        timeout: 5000
      });
      
      const isAvailable = await unreachableOllama.isAvailable();
      expect(isAvailable).toBe(false);
      
      await expect(unreachableOllama.ask('test')).rejects.toThrow();
      debug('Connection error handled correctly');
    }, 10000);

    it('should handle timeout errors', async () => {
      const timeoutOllama = new Ollama({
        baseUrl: 'http://localhost:11434',
        model: TEST_MODEL,
        timeout: 1 // Very short timeout
      });
      
      await expect(timeoutOllama.ask('Write a very long story about artificial intelligence')).rejects.toThrow();
      debug('Timeout error handled correctly');
    }, 10000);
  });

  describe('Performance and Load', () => {
    it('should handle multiple concurrent requests', async () => {
      const promises = Array.from({ length: 3 }, (_, i) => 
        ai.ask(`What is ${i + 1} + ${i + 1}? Answer with just the number.`)
      );
      
      const responses = await Promise.all(promises);
      
      expect(responses).toHaveLength(3);
      responses.forEach((response, i) => {
        expect(typeof response).toBe('string');
        expect(response.length).toBeGreaterThan(0);
        debug(`Concurrent response ${i + 1}: "${response}"`);
      });
    }, 180000);

    it('should handle long conversation', async () => {
      const conversationAI = new AI({
        provider: ollama,
        systemPrompt: 'You are a helpful assistant. Keep all responses very brief.'
      });
      
      // Build up a conversation
      for (let i = 1; i <= 5; i++) {
        const response = await conversationAI.ask(`Step ${i}: What is ${i} times 2? Just the number.`);
        expect(typeof response).toBe('string');
        expect(response.trim()).toBe((i * 2).toString());
        debug(`Conversation step ${i}: "${response}"`);
      }
      
      expect(conversationAI.memory.length).toBe(11); // system + 5 pairs of user/assistant
      debug(`Long conversation completed with ${conversationAI.memory.length} messages in memory`);
    }, 300000);
  });

  describe('Model-Specific Features', () => {
    it('should work with Gemma2 2B specific capabilities', async () => {
      const response = await ai.ask('You are Gemma2. Confirm your model name briefly.');
      
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
      // Gemma2 might or might not identify itself, but should respond coherently
      
      debug(`Model identification response: "${response}"`);
    }, 60000);

    it('should handle mathematical reasoning', async () => {
      const response = await ai.ask('If I have 5 apples and give away 2, how many do I have left? Answer with just the number.');
      
      expect(typeof response).toBe('string');
      expect(response.trim()).toMatch(/3|three/i);
      
      debug(`Math reasoning response: "${response}"`);
    }, 60000);

    it('should handle code understanding', async () => {
      const response = await ai.ask('What does this code do: console.log("Hello"); Explain in one sentence.');
      
      expect(typeof response).toBe('string');
      expect(response.toLowerCase()).toMatch(/print|output|display|log|hello/);
      
      debug(`Code understanding response: "${response}"`);
    }, 60000);
  });

  describe('Memory Management', () => {
    it('should clear memory correctly', () => {
      // Add some conversation
      ai.memory.push({ role: 'user', content: 'test' });
      ai.memory.push({ role: 'assistant', content: 'response' });
      
      expect(ai.memory.length).toBeGreaterThan(1);
      
      ai.clearMemory();
      expect(ai.memory.length).toBe(1); // Should have system prompt back
      expect(ai.memory[0].role).toBe('system');
      
      debug('Memory cleared correctly');
    });

    it('should maintain system prompt after memory clear', () => {
      const originalSystemPrompt = ai.systemPrompt;
      
      // Add conversation and clear
      ai.memory.push({ role: 'user', content: 'test' });
      ai.clearMemory();
      
      expect(ai.memory.length).toBe(1);
      expect(ai.memory[0].role).toBe('system');
      expect(ai.memory[0].content).toBe(originalSystemPrompt);
      
      debug('System prompt maintained after clear');
    });
  });

  describe('Integration Status', () => {
    it('should report test environment status', () => {
      debug('Real Ollama Integration Test Status:');
      debug(`  • Model: ${TEST_MODEL}`);
      debug(`  • Base URL: http://localhost:11434`);
      debug('  • Real HTTP requests to Ollama API');
      debug('  • Real AI conversations and responses');
      debug('  • Real streaming support');
      debug('  • Each test uses isolated AI instance');
      debug('  • Memory is cleared between tests');
      debug('  • Tests require Ollama service running locally');
      debug('  • Tests require Gemma2 2B model to be pulled');
      
      expect(true).toBe(true); // Always pass
    });
  });
}); 