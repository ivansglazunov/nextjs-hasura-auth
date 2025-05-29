import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { AI, Do } from './ai';
import { OpenRouterMessage } from './openrouter';

// Skip tests if no API key is provided
const skipIfNoApiKey = process.env.OPENROUTER_API_KEY ? describe : describe.skip;

describe('AI Class', () => {
  let ai: AI;

  beforeEach(() => {
    const systemPrompt = `You are a helpful AI assistant with code execution capabilities.

🪬 You can execute JavaScript and TypeScript code using special Do operations.
When you need to run code, use this format:

> 🪬<uuid>/do/exec/js
\`\`\`js
// your code here
\`\`\`

> 🪬<uuid>/do/exec/tsx  
\`\`\`tsx
// your TypeScript code here
\`\`\`

Always provide helpful explanations and make your responses clear and informative.`;

    ai = new AI('test-key', {}, { model: 'test-model' }, systemPrompt);
  });

  afterEach(() => {
    ai.clearMemory();
    ai._do = undefined; // Clear any custom handlers
  });

  describe('Constructor', () => {
    it('should create AI instance with correct properties', () => {
      expect(ai).toBeInstanceOf(AI);
      expect(ai.doSpecialSubstring).toBe('> 🪬');
      expect(ai.memory).toEqual([]);
      expect(ai._onMemory).toBeUndefined();
      expect(ai._do).toBeUndefined();
    });
  });

  describe('Memory Management', () => {
    it('should add messages to memory', () => {
      const message: OpenRouterMessage = {
        role: 'user',
        content: 'Test message'
      };

      // Access private method through any cast for testing
      (ai as any).addToMemory(message);

      expect(ai.getMemory()).toHaveLength(1);
      expect(ai.getMemory()[0]).toEqual(message);
    });

    it('should call _onMemory callback when set', () => {
      let callbackCalled = false;
      let callbackMessage: OpenRouterMessage | Do | null = null;

      ai._onMemory = (message) => {
        callbackCalled = true;
        callbackMessage = message;
      };

      const message: OpenRouterMessage = {
        role: 'user',
        content: 'Test message'
      };

      (ai as any).addToMemory(message);

      expect(callbackCalled).toBe(true);
      expect(callbackMessage).toEqual(message);
    });

    it('should clear memory', () => {
      const message: OpenRouterMessage = {
        role: 'user',
        content: 'Test message'
      };

      (ai as any).addToMemory(message);
      expect(ai.getMemory()).toHaveLength(1);

      ai.clearMemory();
      expect(ai.getMemory()).toHaveLength(0);
    });
  });

  describe('Do Operations Parsing', () => {
    it('should find Do operations in message', () => {
      const message = `
Here is some text.

> 🪬test-uuid-123/do/exec/js
\`\`\`js
console.log('Hello World');
\`\`\`

More text here.

> 🪬another-uuid-456/do/exec/tsx
\`\`\`tsx
const x: number = 42;
console.log(x);
\`\`\`

End of message.
      `.trim();

      const dos = ai.findDos(message);

      expect(dos).toHaveLength(2);
      
      expect(dos[0].id).toBe('test-uuid-123');
      expect(dos[0].format).toBe('js');
      expect(dos[0].operation).toBe('do/exec/js');
      expect(dos[0].request).toBe("console.log('Hello World');");
      
      expect(dos[1].id).toBe('another-uuid-456');
      expect(dos[1].format).toBe('tsx');
      expect(dos[1].operation).toBe('do/exec/tsx');
      expect(dos[1].request).toBe('const x: number = 42;\nconsole.log(x);');
    });

    it('should handle empty message', () => {
      const dos = ai.findDos('');
      expect(dos).toHaveLength(0);
    });

    it('should handle message without Do operations', () => {
      const message = 'Just a regular message without any special operations.';
      const dos = ai.findDos(message);
      expect(dos).toHaveLength(0);
    });

    it('should handle malformed Do operations', () => {
      const message = `
> 🪬invalid-format
\`\`\`js
console.log('test');
\`\`\`
      `.trim();

      const dos = ai.findDos(message);
      expect(dos).toHaveLength(0);
    });
  });

  describe('generateDo', () => {
    it('should generate Do object from valid message part', () => {
      const messagePart = `> 🪬test-uuid-123/do/exec/js
\`\`\`js
console.log('Hello World');
\`\`\``;

      const doItem = ai.generateDo(messagePart);

      expect(doItem.id).toBe('test-uuid-123');
      expect(doItem.format).toBe('js');
      expect(doItem.operation).toBe('do/exec/js');
      expect(doItem.request).toBe("console.log('Hello World');");
      expect(doItem.role).toBe('tool');
      expect(doItem.content).toBe(messagePart);
    });

    it('should generate Do object for TypeScript', () => {
      const messagePart = `> 🪬tsx-uuid-456/do/exec/tsx
\`\`\`tsx
const x: number = 42;
console.log(x);
\`\`\``;

      const doItem = ai.generateDo(messagePart);

      expect(doItem.id).toBe('tsx-uuid-456');
      expect(doItem.format).toBe('tsx');
      expect(doItem.operation).toBe('do/exec/tsx');
      expect(doItem.request).toBe('const x: number = 42;\nconsole.log(x);');
    });

    it('should throw error for invalid format', () => {
      const messagePart = `> 🪬invalid-format
\`\`\`js
console.log('test');
\`\`\``;

      expect(() => ai.generateDo(messagePart)).toThrow('Invalid Do format');
    });

    it('should throw error for missing code block', () => {
      const messagePart = `> 🪬test-uuid/do/exec/js
No code block here`;

      expect(() => ai.generateDo(messagePart)).toThrow('Invalid code block format');
    });
  });

  describe('removeDo', () => {
    it('should remove Do operations from message', () => {
      const message = `Line 0
Line 1
> 🪬test-uuid/do/exec/js
\`\`\`js
console.log('test');
\`\`\`
Line 6
Line 7`;

      const dos: Do[] = [{
        role: 'tool',
        content: '',
        id: 'test-uuid',
        operation: 'do/exec/js',
        format: 'js',
        request: '',
        startLine: 2,
        endLine: 5
      }];

      const result = ai.removeDo(message, dos);
      const expectedLines = ['Line 0', 'Line 1', 'Line 6', 'Line 7'];
      
      expect(result).toBe(expectedLines.join('\n'));
    });

    it('should return original message if no dos provided', () => {
      const message = 'Original message';
      const result = ai.removeDo(message, []);
      expect(result).toBe(message);
    });

    it('should handle multiple Do operations', () => {
      const message = `Line 0
> 🪬uuid1/do/exec/js
\`\`\`js
code1
\`\`\`
Line 5
> 🪬uuid2/do/exec/tsx
\`\`\`tsx
code2
\`\`\`
Line 9`;

      const dos: Do[] = [
        {
          role: 'tool',
          content: '',
          id: 'uuid1',
          operation: 'do/exec/js',
          format: 'js',
          request: '',
          startLine: 1,
          endLine: 4
        },
        {
          role: 'tool',
          content: '',
          id: 'uuid2',
          operation: 'do/exec/tsx',
          format: 'tsx',
          request: '',
          startLine: 6,
          endLine: 9
        }
      ];

      const result = ai.removeDo(message, dos);
      expect(result).toBe('Line 0\nLine 5\nLine 9');
    });
  });

  describe('contextMemory', () => {
    it('should generate context messages with system prompt', () => {
      const userMessages: OpenRouterMessage[] = [
        { role: 'user', content: 'Test question' }
      ];

      const contextMessages = ai.contextMemory(userMessages);

      expect(contextMessages).toHaveLength(2);
      expect(contextMessages[0].role).toBe('system');
      expect(contextMessages[0].content).toContain('You are a helpful AI assistant');
      expect(contextMessages[0].content).toContain('🪬');
      expect(contextMessages[1]).toEqual(userMessages[0]);
    });

    it('should include recent memory in context', () => {
      // Add some messages to memory
      const memoryMessages: OpenRouterMessage[] = [
        { role: 'user', content: 'Previous question' },
        { role: 'assistant', content: 'Previous answer' }
      ];

      memoryMessages.forEach(msg => (ai as any).addToMemory(msg));

      const userMessages: OpenRouterMessage[] = [
        { role: 'user', content: 'Current question' }
      ];

      const contextMessages = ai.contextMemory(userMessages);

      expect(contextMessages).toHaveLength(4); // system + 2 memory + 1 current
      expect(contextMessages[1].content).toBe('Previous question');
      expect(contextMessages[2].content).toBe('Previous answer');
      expect(contextMessages[3].content).toBe('Current question');
    });

    it('should limit memory to last 10 messages', () => {
      // Add 15 messages to memory
      for (let i = 0; i < 15; i++) {
        (ai as any).addToMemory({
          role: 'user',
          content: `Message ${i}`
        });
      }

      const userMessages: OpenRouterMessage[] = [
        { role: 'user', content: 'Current question' }
      ];

      const contextMessages = ai.contextMemory(userMessages);

      // Should be: system + 10 recent memory + 1 current = 12 total
      expect(contextMessages).toHaveLength(12);
      
      // Check that it includes the last 10 memory messages (5-14)
      expect(contextMessages[1].content).toBe('Message 5');
      expect(contextMessages[10].content).toBe('Message 14');
      expect(contextMessages[11].content).toBe('Current question');
    });
  });

  describe('Real Code Execution', () => {
    /*
    it('should execute JavaScript Do operation with real exec engine', async () => {
      // Setup real execution handler
      const { AskExec } = await import('./ask-exec');
      const askExec = new AskExec({ autoConfirm: true });
      askExec.setupAI(ai);

      const doItem: Do = {
        role: 'tool',
        content: '',
        id: 'test-uuid',
        operation: 'do/exec/js',
        format: 'js',
        request: '2 + 2',
        startLine: 0,
        endLine: 0
      };

      const result = await ai.do(doItem);

      expect(result.id).toBe('test-uuid');
      expect(result.response).toBe('4');
    });

    it('should execute TypeScript Do operation with real exec-tsx engine', async () => {
      // Setup real execution handler
      const { AskExec } = await import('./ask-exec');
      const askExec = new AskExec({ autoConfirm: true });
      askExec.setupAI(ai);

      const doItem: Do = {
        role: 'tool',
        content: '',
        id: 'test-uuid',
        operation: 'do/exec/tsx',
        format: 'tsx',
        request: '42 * 2',
        startLine: 0,
        endLine: 0
      };

      const result = await ai.do(doItem);

      expect(result.id).toBe('test-uuid');
      expect(result.response).toBe('84');
    });

    it('should handle execution errors in real environment', async () => {
      // Setup real execution handler
      const { AskExec } = await import('./ask-exec');
      const askExec = new AskExec({ autoConfirm: true });
      askExec.setupAI(ai);

      const doItem: Do = {
        role: 'tool',
        content: '',
        id: 'test-uuid',
        operation: 'do/exec/js',
        format: 'js',
        request: 'throw new Error("Test error");',
        startLine: 0,
        endLine: 0
      };

      const result = await ai.do(doItem);

      expect(result.id).toBe('test-uuid');
      expect(result.response).toContain('Error: Test error');
    });
    */

    it('should use custom _do handler when provided', async () => {
      const customResult: Do = {
        role: 'tool',
        content: 'Custom response',
        id: 'test-uuid',
        operation: 'do/exec/js',
        format: 'js',
        request: 'test',
        response: 'Custom execution result',
        startLine: 0,
        endLine: 0
      };

      ai._do = async (doItem: Do) => {
        return customResult;
      };

      const doItem: Do = {
        role: 'tool',
        content: '',
        id: 'test-uuid',
        operation: 'do/exec/js',
        format: 'js',
        request: 'return "test";',
        startLine: 0,
        endLine: 0
      };

      const result = await ai.do(doItem);

      expect(result).toEqual(customResult);
    });

    it('should return error message when no handler is configured', async () => {
      // Create fresh AI instance without handler
      const freshAI = new AI('test-token', {}, {});
      
      const doItem: Do = {
        role: 'tool',
        content: 'original content',
        id: 'test-uuid',
        operation: 'do/exec/js',
        format: 'js',
        request: 'console.log("hello")',
        startLine: 0,
        endLine: 0
      };

      const result = await freshAI.do(doItem);

      expect(result.response).toBe('Code execution not available - no handler configured');
      expect(result.content).toBe('original content');
      expect(result.id).toBe('test-uuid');
    });
  });

  describe('Ask Method with Mocked Responses', () => {
    it('should execute single Do operation and include results in response', async () => {
      // Mock response with single Do operation
      (ai as any).openRouter.ask = async () => {
        return `Let me calculate 2+2:

> 🪬test-uuid/do/exec/js
\`\`\`js
2 + 2
\`\`\`

This should return 4.`;
      };

      const response = await ai.ask('Calculate 2+2');

      // Should contain the original text (without Do operation)
      expect(response).toContain('Let me calculate 2+2');
      expect(response).toContain('This should return 4');
      
      // Should NOT contain the Do operation itself
      expect(response).not.toContain('> 🪬test-uuid/do/exec/js');
      
      // Should contain execution results
      expect(response).toContain('**Code Executed:**');
      expect(response).toContain('**Result:**');
      expect(response).toContain('2 + 2');
      expect(response).toContain('4');
    });

    /*
    it('should handle iterative execution with mocked responses', async () => {
      // Setup real execution handler for code execution
      const { AskExec } = await import('./ask-exec');
      const askExec = new AskExec({ autoConfirm: true });
      askExec.setupAI(ai);

      let callCount = 0;
      const mockResponses = [
        // First response with Do operation
        `Let me try to get system info:

> 🪬test-uuid-1/do/exec/js
\`\`\`js
navigator.platform
\`\`\`

This should work in browser.`,
        
        // Second response after getting error result
        `I see that navigator is not available. Let me try Node.js approach:

> 🪬test-uuid-2/do/exec/js
\`\`\`js
process.platform
\`\`\`

This should work in Node.js environment.`,
        
        // Final response without Do operations
        `Perfect! Based on the execution results, we are running in a Node.js environment on the ${process.platform} platform.`
      ];

      // Mock the OpenRouter ask method to return different responses
      (ai as any).openRouter.ask = async () => {
        const response = mockResponses[callCount];
        callCount++;
        return response;
      };

      const response = await ai.ask('Get system information, try browser APIs first then Node.js APIs');

      // Should contain all parts of the conversation from all iterations
      expect(response).toContain('Let me try to get system info');
      expect(response).toContain('Node.js environment');
      
      // Should contain execution results from all iterations
      expect(response).toContain('**Code Executed:**');
      expect(response).toContain('**Result:**');
      expect(response).toContain('Error: ReferenceError: navigator is not defined');
      expect(response).toContain(process.platform);
      
      // All 3 calls should be made (max iterations)
      expect(callCount).toBe(3);
    });
    */

    it('should stop after max iterations', async () => {
      let callCount = 0;
      
      // Mock responses that always contain Do operations
      (ai as any).openRouter.ask = async () => {
        callCount++;
        return `Iteration ${callCount}:

> 🪬test-uuid-${callCount}/do/exec/js
\`\`\`js
return ${callCount};
\`\`\`

Let me continue...`;
      };

      const response = await ai.ask('Keep executing code');

      // Current implementation should make 3 calls (max iterations)
      expect(callCount).toBe(3);
      
      // Should contain results from all iterations
      expect(response).toContain('Iteration 1');
      expect(response).toContain('Iteration 2');
      expect(response).toContain('Iteration 3');
      
      // Should contain execution results
      expect(response).toContain('**Code Executed:**');
      expect(response).toContain('**Result:**');
    }, 10000); // Increase timeout for multiple iterations

    it('should handle simple questions without code execution', async () => {
      // Mock response without Do operations
      (ai as any).openRouter.ask = async () => {
        return 'Simple response without Do operations';
      };

      const response = await ai.ask('Simple question');

      expect(response).toBe('Simple response without Do operations');
      expect(response).not.toContain('**Code Executed:**');
    });
  });

  skipIfNoApiKey('Real AI Integration Tests', () => {
    let realAi: AI;

    beforeEach(() => {
      if (!process.env.OPENROUTER_API_KEY) {
        throw new Error('OPENROUTER_API_KEY is required for integration tests');
      }
      realAi = new AI(
        process.env.OPENROUTER_API_KEY,
        {},
        {
          model: 'google/gemini-2.5-flash-preview',
          temperature: 0.1,
          max_tokens: 2000
        }
      );
    });

    afterEach(() => {
      realAi.clearMemory();
    });

    it('should execute real AI request with code execution and show results', async () => {
      const response = await realAi.ask('Calculate 5 * 7 using JavaScript code. Show me the calculation.');

      // Should contain the response text
      expect(response).toBeTruthy();
      expect(typeof response).toBe('string');
      
      // If AI used code execution, should contain execution results
      if (response.includes('**Code Executed:**')) {
        expect(response).toContain('**Result:**');
        expect(response).toContain('35'); // 5 * 7 = 35
      }
    }, 60000); // 60 second timeout for real API calls with iterations

    it('should handle iterative code execution when first approach fails', async () => {
      const response = await realAi.ask('Get information about the current environment. Try browser APIs first, then Node.js APIs if that fails.');

      expect(response).toBeTruthy();
      expect(typeof response).toBe('string');
      
      // Should contain some environment information
      expect(response.toLowerCase()).toMatch(/node|environment|platform|process/);
    }, 60000);

    it('should handle multiple code executions in one request', async () => {
      const response = await realAi.ask('Calculate both 3 + 4 and 10 - 2 using JavaScript. Show both calculations.');

      expect(response).toBeTruthy();
      expect(typeof response).toBe('string');
      
      // If AI used code execution, should contain results
      if (response.includes('**Code Executed:**')) {
        expect(response).toContain('**Result:**');
        // Should contain both results
        expect(response).toContain('7'); // 3 + 4 = 7
        expect(response).toContain('8'); // 10 - 2 = 8
      }
    }, 60000);

    it('should work with TypeScript code execution', async () => {
      const response = await realAi.ask('Create a TypeScript interface for a Product with name and price, then calculate total for 3 products at $10 each.');

      expect(response).toBeTruthy();
      expect(typeof response).toBe('string');
      
      // If AI used TypeScript execution, should contain execution results
      if (response.includes('**Code Executed:**')) {
        expect(response).toContain('**Result:**');
        expect(response).toContain('30'); // 3 * 10 = 30
      }
    }, 60000);

    it('should handle simple questions without code execution', async () => {
      const response = await realAi.ask('What is the capital of France?');

      expect(response).toBeTruthy();
      expect(typeof response).toBe('string');
      expect(response.toLowerCase()).toContain('paris');
      
      // Should not contain code execution blocks for simple questions
      expect(response).not.toContain('**Code Executed:**');
    }, 60000);
  });
}); 