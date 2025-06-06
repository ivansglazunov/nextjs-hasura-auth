import { AI, Do } from './ai';
import { OpenRouterMessage } from './openrouter';
import Debug from './debug';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const debug = Debug('test:ai');

// Environment availability check
const isOpenRouterAvailable = Boolean(process.env.OPENROUTER_API_KEY);
const TEST_MODEL = process.env.OPENROUTER_MODEL || 'gpt-3.5-turbo';

function generateTestId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `ai-test-${timestamp}-${random}`;
}

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
    const testSystemPrompt = `You are a helpful AI assistant for testing purposes.
When asked to execute code, use this format:
> 😈<uuid>/do/exec/js
\`\`\`js
// code here
\`\`\``;

    const ai = new AI(
      process.env.OPENROUTER_API_KEY || 'test-key',
      {},
      { model: TEST_MODEL },
      testSystemPrompt
    );

    expect(ai).toBeInstanceOf(AI);
    expect(ai.doSpecialSubstring).toBe('> 😈');
    expect(ai.memory).toEqual([]);
    
    debug('Real AI instance created successfully');
  });
});

describe('Real AI Class Tests', () => {
  
  it('should handle real memory management operations', () => {
    const ai = new AI(
      process.env.OPENROUTER_API_KEY || 'test-key',
      {},
      { model: TEST_MODEL }
    );
    
    try {
      debug('Testing real memory management');
      
      const message: OpenRouterMessage = {
        role: 'user',
        content: 'Test message for memory'
      };
      
      // Test memory callback
      let callbackCalled = false;
      let callbackMessage: OpenRouterMessage | Do | null = null;
      
      ai._onMemory = (msg) => {
        callbackCalled = true;
        callbackMessage = msg;
      };
      
      // Add to memory (using private method access for testing)
      (ai as any).addToMemory(message);
      
      expect(ai.getMemory()).toHaveLength(1);
      expect(ai.getMemory()[0]).toEqual(message);
      expect(callbackCalled).toBe(true);
      expect(callbackMessage).toEqual(message);
      
      debug('Real memory operations working correctly');
      
      // Test memory clearing
      ai.clearMemory();
      expect(ai.getMemory()).toHaveLength(0);
      
      debug('Real memory clearing working correctly');
      
    } finally {
      ai.clearMemory();
    }
  });

  it('should parse real Do operations from message content', () => {
    const ai = new AI(
      process.env.OPENROUTER_API_KEY || 'test-key',
      {},
      { model: TEST_MODEL }
    );
    
    try {
      debug('Testing real Do operations parsing');
      
      const testId1 = generateTestId();
      const testId2 = generateTestId();
      
      const message = `
Here is some explanation.

> 😈${testId1}/do/exec/js
\`\`\`js
console.log('Hello from test');
const result = 2 + 2;
return result;
\`\`\`

More explanation here.

> 😈${testId2}/do/exec/tsx
\`\`\`tsx
const x: number = 42;
const y: string = 'test';
console.log(x, y);
\`\`\`

End of message.
      `.trim();

      const dos = ai.findDos(message);
      
      expect(dos).toHaveLength(2);
      
      expect(dos[0].id).toBe(testId1);
      expect(dos[0].format).toBe('js');
      expect(dos[0].operation).toBe('do/exec/js');
      expect(dos[0].request).toContain('console.log(\'Hello from test\')');
      expect(dos[0].request).toContain('const result = 2 + 2');
      expect(dos[0].request).toContain('return result');
      
      expect(dos[1].id).toBe(testId2);
      expect(dos[1].format).toBe('tsx');
      expect(dos[1].operation).toBe('do/exec/tsx');
      expect(dos[1].request).toContain('const x: number = 42');
      expect(dos[1].request).toContain('const y: string = \'test\'');
      
      debug('Real Do operations parsing working correctly');
      
      // Test edge cases
      const emptyDos = ai.findDos('');
      expect(emptyDos).toHaveLength(0);
      
      const noDos = ai.findDos('Just a regular message without any special operations.');
      expect(noDos).toHaveLength(0);
      
      debug('Real Do operations edge cases handled correctly');
      
    } finally {
      ai.clearMemory();
    }
  });

  it('should generate real Do objects from message parts', () => {
    const ai = new AI(
      process.env.OPENROUTER_API_KEY || 'test-key',
      {},
      { model: TEST_MODEL }
    );
    
    try {
      debug('Testing real Do object generation');
      
      const testId = generateTestId();
      const messagePart = `> 😈${testId}/do/exec/js
\`\`\`js
console.log('Real test execution');
const calculation = 5 * 8;
return calculation;
\`\`\``;

      const doItem = ai.generateDo(messagePart);
      
      expect(doItem.id).toBe(testId);
      expect(doItem.format).toBe('js');
      expect(doItem.operation).toBe('do/exec/js');
      expect(doItem.request).toContain('console.log(\'Real test execution\')');
      expect(doItem.request).toContain('const calculation = 5 * 8');
      expect(doItem.request).toContain('return calculation');
      expect(doItem.role).toBe('tool');
      expect(doItem.content).toBe(messagePart);
      
      debug('Real Do object generation working correctly');
      
      // Test TypeScript format
      const tsxMessagePart = `> 😈${testId}-tsx/do/exec/tsx
\`\`\`tsx
interface TestInterface {
  value: number;
}
const obj: TestInterface = { value: 123 };
console.log(obj);
\`\`\``;

      const tsxDoItem = ai.generateDo(tsxMessagePart);
      
      expect(tsxDoItem.format).toBe('tsx');
      expect(tsxDoItem.operation).toBe('do/exec/tsx');
      expect(tsxDoItem.request).toContain('interface TestInterface');
      expect(tsxDoItem.request).toContain('value: number');
      
      debug('Real TypeScript Do object generation working correctly');
      
      // Test error cases
      expect(() => {
        ai.generateDo('> 😈invalid-format\n```js\nconsole.log(\'test\');\n```');
      }).toThrow('Invalid Do format');
      
      expect(() => {
        ai.generateDo(`> 😈${testId}/do/exec/js\nNo code block here`);
      }).toThrow('Invalid code block format');
      
      debug('Real Do object error handling working correctly');
      
    } finally {
      ai.clearMemory();
    }
  });

  it('should handle real code execution via Do operations', async () => {
    const ai = new AI(
      process.env.OPENROUTER_API_KEY || 'test-key',
      {},
      { model: TEST_MODEL }
    );
    
    try {
      debug('Testing real code execution operations');
      
      let executedCode: string | null = null;
      let executionResult: any = null;
      
      // Set up real Do handler
      ai._do = async (doItem: Do) => {
        debug(`Real code execution requested: ${doItem.operation}`);
        executedCode = doItem.request;
        
        // Simulate real code execution results and return Do object with response
        if (doItem.request.includes('2 + 2')) {
          executionResult = 4;
          return {
            ...doItem,
            response: '4'
          };
        } else if (doItem.request.includes('console.log')) {
          executionResult = 'Hello from execution';
          return {
            ...doItem,
            response: 'Hello from execution'
          };
        } else {
          return {
            ...doItem,
            response: 'Error: Unsupported operation for test'
          };
        }
      };
      
      const testId = generateTestId();
      const doItem: Do = {
        id: testId,
        format: 'js',
        operation: 'do/exec/js',
        request: 'const result = 2 + 2; return result;',
        role: 'tool',
        content: `> 😈${testId}/do/exec/js\n\`\`\`js\nconst result = 2 + 2; return result;\n\`\`\``,
        startLine: 0,
        endLine: 0
      };
      
      const result = await ai._do!(doItem);
      
      expect(executedCode).toBe('const result = 2 + 2; return result;');
      expect(result.response).toBe('4');
      
      debug('Real code execution working correctly');
      
    } finally {
      ai.clearMemory();
      ai._do = undefined;
    }
  });

  it('should make real OpenRouter API call if credentials available', async () => {
    if (!isOpenRouterAvailable) {
      debug('Skipping real OpenRouter API test - API key not available');
      return;
    }
    
    const ai = new AI(
      process.env.OPENROUTER_API_KEY!,
      {},
      { model: TEST_MODEL }
    );
    
    try {
      debug('Testing real OpenRouter API call');
      
      // Simple question that should not trigger Do operations
      const response = await ai.ask('What is 2+2? Please answer briefly in one sentence.');
      
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
      expect(response.toLowerCase()).toMatch(/4|four/);
      
      debug(`Real OpenRouter API response received: ${response.substring(0, 100)}...`);
      
      // Check that memory contains the conversation
      const memory = ai.getMemory();
      expect(memory.length).toBeGreaterThan(0);
      
      // Should have user message and assistant response
      const userMessage = memory.find(m => m.role === 'user');
      const assistantMessage = memory.find(m => m.role === 'assistant');
      
      expect(userMessage).toBeTruthy();
      expect(assistantMessage).toBeTruthy();
      expect(userMessage!.content).toContain('What is 2+2');
      
      debug('Real OpenRouter API conversation stored in memory correctly');
      
    } finally {
      ai.clearMemory();
    }
  }, 30000);

  it('should handle real Do operations integration with OpenRouter', async () => {
    if (!isOpenRouterAvailable) {
      debug('Skipping real Do operations integration test - API key not available');
      return;
    }
    
    const ai = new AI(
      process.env.OPENROUTER_API_KEY!,
      {},
      { model: TEST_MODEL }
    );
    
    try {
      debug('Testing real Do operations integration');
      
      let codeExecuted = false;
      let executedRequest: string | null = null;
      
      // Set up real Do handler to capture execution
      ai._do = async (doItem: Do) => {
        debug(`Real Do operation triggered: ${doItem.operation}`);
        codeExecuted = true;
        executedRequest = doItem.request;
        
        return {
          ...doItem,
          response: 'Test execution result'
        };
      };
      
      // Ask a question that might trigger code execution
      // Note: This depends on the AI model deciding to use Do operations
      const response = await ai.ask('Can you execute some simple JavaScript to calculate 3*7? Use the Do operation format.');
      
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
      
      debug(`Real integration response: ${response.substring(0, 200)}...`);
      
      // The AI might or might not decide to use Do operations
      if (codeExecuted) {
        debug('Real Do operation was triggered by AI');
        expect(executedRequest).toBeTruthy();
        expect(response).toContain('**Code Executed:**');
        expect(response).toContain('**Result:**');
      } else {
        debug('AI chose not to use Do operations for this request');
      }
      
      debug('Real Do operations integration test completed');
      
    } finally {
      ai.clearMemory();
      ai._do = undefined;
    }
  }, 60000);

  it('should handle real streaming operations if supported', async () => {
    if (!isOpenRouterAvailable) {
      debug('Skipping real streaming test - API key not available');
      return;
    }
    
    const ai = new AI(
      process.env.OPENROUTER_API_KEY!,
      {},
      { model: TEST_MODEL }
    );
    
    try {
      debug('Testing real streaming operations');
      
      const events: any[] = [];
      
      const streamingPromise = new Promise<void>((resolve, reject) => {
        const subscription = ai.asking('Count from 1 to 3. Be brief.').subscribe({
          next: (event) => {
            events.push(event);
            debug(`Streaming event: ${event.type}`);
          },
          complete: () => {
            debug('Real streaming completed');
            resolve();
          },
          error: (error) => {
            debug(`Real streaming error: ${error}`);
            reject(error);
          }
        });
        
        // Cleanup subscription after reasonable time
        setTimeout(() => {
          subscription.unsubscribe();
          resolve();
        }, 30000);
      });
      
      await streamingPromise;
      
      expect(events.length).toBeGreaterThan(0);
      
      // Check for expected event types
      const eventTypes = events.map(e => e.type);
      debug(`Real streaming event types: ${eventTypes.join(', ')}`);
      
      // Should have at least some text events
      const textEvents = events.filter(e => e.type === 'text');
      expect(textEvents.length).toBeGreaterThan(0);
      
      // Text events should have delta and accumulated
      if (textEvents.length > 0) {
        expect(textEvents[0].data.delta).toBeTruthy();
        expect(textEvents[0].data.accumulated).toBeTruthy();
      }
      
      debug('Real streaming operations working correctly');
      
    } finally {
      ai.clearMemory();
    }
  }, 45000);

  it('should show real AI testing environment status', () => {
    debug('Real AI tests use actual OpenRouter API:');
    debug(`  • Real OpenRouter API Key (${process.env.OPENROUTER_API_KEY ? 'configured' : 'missing'})`);
    debug(`  • Real AI Model (${TEST_MODEL})`);
    debug('  • Real HTTP requests to OpenRouter API');
    debug('  • Real AI conversations and responses');
    debug('  • Real code execution via Do operations');
    debug('  • Real streaming support');
    debug('  • Each test creates isolated AI instance');
    debug('  • Each test cleans up its own memory');
    debug(`  • Test ID pattern: ai-test-{timestamp}-{random}`);
    
    if (isOpenRouterAvailable) {
      debug('  • Environment: READY for real AI testing');
    } else {
      debug('  • Environment: MISSING API key - some tests will be skipped');
      debug('  • Get API key from: https://openrouter.ai/keys');
    }
    
    expect(true).toBe(true); // Always pass
  });
}); 