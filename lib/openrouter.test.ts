import dotenv from 'dotenv';
import { OpenRouter } from './openrouter';

// Load environment variables from .env file
dotenv.config();

describe('OpenRouter', () => {
  const testToken = process.env.OPENROUTER_API_KEY || 'test-token-123';
  const hasRealToken = !!process.env.OPENROUTER_API_KEY;
  
  // Helper to skip tests that require real API calls when no token is available
  const describeWithToken = hasRealToken ? describe : describe.skip;
  const itWithToken = hasRealToken ? it : it.skip;

  describe('Constructor and Basic Setup', () => {
    it('should throw error if no token provided', () => {
      expect(() => new OpenRouter('')).toThrow('OpenRouter API token is required');
    });

    it('should initialize with default options', () => {
      const openrouter = new OpenRouter(testToken);
      
      expect(openrouter).toBeInstanceOf(OpenRouter);
      expect(openrouter.context).toEqual({});
    });

    it('should initialize with custom context and options', () => {
      const customContext = { testVar: 'testValue' };
      const customOptions = { model: 'anthropic/claude-3-haiku', temperature: 0.5 };
      
      const openrouter = new OpenRouter(testToken, customContext, customOptions);
      
      expect(openrouter.context).toEqual(customContext);
      expect(openrouter.getContext()).toEqual(customContext);
    });
  });

  describe('Context Management', () => {
    it('should update context correctly', () => {
      const openrouter = new OpenRouter(testToken);
      
      openrouter.updateContext({ newVar: 'newValue' });
      expect(openrouter.getContext()).toEqual({ newVar: 'newValue' });
    });

    it('should clear context correctly', () => {
      const openrouter = new OpenRouter(testToken, { initialVar: 'value' });
      
      openrouter.clearContext();
      expect(openrouter.getContext()).toEqual({});
    });

    it('should maintain context between executions', async () => {
      const openrouter = new OpenRouter(testToken);
      
      // Set a variable in context manually
      openrouter.updateContext({ x: 42 });
      
      // Use the variable in execution
      const result = await openrouter.exec('x + 8');
      
      expect(result).toBe(50);
    });
  });

  describe('JavaScript Execution', () => {
    it('should execute JavaScript code', async () => {
      const openrouter = new OpenRouter(testToken);
      
      const result = await openrouter.exec('2 + 2');
      expect(result).toBe(4);
    });

    it('should support context extension', async () => {
      const openrouter = new OpenRouter(testToken);
      
      const result = await openrouter.exec('y + 5', { y: 15 });
      expect(result).toBe(20);
    });

    it('should support async code execution', async () => {
      const openrouter = new OpenRouter(testToken);
      
      const result = await openrouter.exec(`
        const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
        await delay(10);
        return 'async result';
      `);
      expect(result).toBe('async result');
    });
  });

  describe('Message Creation Helpers', () => {
    it('should create system message correctly', () => {
      const message = OpenRouter.systemMessage('You are a helpful assistant');
      expect(message).toEqual({
        role: 'system',
        content: 'You are a helpful assistant'
      });
    });

    it('should create user message correctly', () => {
      const message = OpenRouter.userMessage('Hello, how are you?');
      expect(message).toEqual({
        role: 'user',
        content: 'Hello, how are you?'
      });
    });

    it('should create assistant message correctly', () => {
      const message = OpenRouter.assistantMessage('I am doing well, thank you!');
      expect(message).toEqual({
        role: 'assistant',
        content: 'I am doing well, thank you!'
      });
    });

    it('should create tool message correctly', () => {
      const message = OpenRouter.toolMessage('Function result: 42', 'call_123', 'calculate');
      expect(message).toEqual({
        role: 'tool',
        content: 'Function result: 42',
        tool_call_id: 'call_123',
        name: 'calculate'
      });
    });

    it('should create conversation from mixed inputs', () => {
      const conversation = OpenRouter.conversation(
        'Hello',
        OpenRouter.systemMessage('You are helpful'),
        OpenRouter.assistantMessage('Hi there!')
      );
      
      expect(conversation).toEqual([
        { role: 'user', content: 'Hello' },
        { role: 'system', content: 'You are helpful' },
        { role: 'assistant', content: 'Hi there!' }
      ]);
    });
  });

  // Real API tests - only run if token is available
  if (hasRealToken) {
    describe('Real API Integration', () => {
      it('should send simple string message', async () => {
        const openrouter = new OpenRouter(testToken);
        
        const response = await openrouter.ask('Say "test successful" and nothing else');
        expect(typeof response).toBe('string');
        expect(response.length).toBeGreaterThan(0);
      }, 30000);

      it('should send single message object', async () => {
        const openrouter = new OpenRouter(testToken);
        
        const message = OpenRouter.userMessage('What is 2+2? Answer with just the number.');
        const response = await openrouter.ask(message);
        expect(typeof response).toBe('string');
        expect(response.trim()).toContain('4');
      }, 30000);

      it('should send array of messages', async () => {
        const openrouter = new OpenRouter(testToken);
        
        const messages = [
          OpenRouter.systemMessage('You are a math tutor. Be concise.'),
          OpenRouter.userMessage('What is 5 * 3?')
        ];
        const response = await openrouter.ask(messages);
        expect(typeof response).toBe('string');
        expect(response).toContain('15');
      }, 30000);

      it('should handle askWithExec without code blocks', async () => {
        const openrouter = new OpenRouter(testToken);
        
        const result = await openrouter.askWithExec('Just say hello, no code needed');
        expect(result.response).toBeTruthy();
        expect(result.execResults).toBeUndefined();
      }, 30000);

      it('should handle askWithExec with code blocks', async () => {
        const openrouter = new OpenRouter(testToken);
        
        const result = await openrouter.askWithExec(
          'Calculate 10 * 5 using JavaScript. Put the calculation in a code block.'
        );
        expect(result.response).toBeTruthy();
        expect(result.execResults).toBeDefined();
      }, 30000);

      it('should preserve context across askWithExec calls', async () => {
        const openrouter = new OpenRouter(testToken);
        
        // First call sets a variable
        await openrouter.askWithExec('Set a variable x to 100 in JavaScript code');
        
        // Second call should be able to use that variable
        const result = await openrouter.askWithExec('Use the variable x and multiply it by 2 in JavaScript');
        expect(result.execResults).toBeDefined();
      }, 45000);

      it('should pass custom options to API call', async () => {
        const openrouter = new OpenRouter(testToken);
        
        const response = await openrouter.ask(
          'Say exactly "custom options test"',
          { 
            model: 'anthropic/claude-3-haiku',
            temperature: 0.1,
            max_tokens: 50
          }
        );
        expect(typeof response).toBe('string');
        expect(response.length).toBeGreaterThan(0);
      }, 30000);
    });
  } else {
    console.log('⚠️  OpenRouter API tests skipped - set OPENROUTER_API_KEY to run full tests');
  }

  // Tests for error handling (don't require real API)
  describe('Error Handling', () => {
    it('should handle code execution errors in askWithExec', async () => {
      const openrouter = new OpenRouter(testToken);
      
      // This should not throw, but handle the error gracefully
      const result = await openrouter.askWithExec('Execute this invalid JavaScript: ```javascript\nthis.is.invalid.syntax\n```');
      expect(result.response).toBeTruthy();
      // execResults might be undefined or contain error info
    });

    it('should handle API errors gracefully', async () => {
      const openrouter = new OpenRouter('invalid-token');
      
      await expect(openrouter.ask('test')).rejects.toThrow();
    });

    it('should handle empty response from API', async () => {
      const openrouter = new OpenRouter(testToken);
      
      // This test depends on the API behavior, might need adjustment
      const response = await openrouter.ask('');
      expect(typeof response).toBe('string');
    });

    it('should handle multiple code blocks in askWithExec', async () => {
      const openrouter = new OpenRouter(testToken);
      
      const message = `
        Here are two calculations:
        \`\`\`javascript
        const a = 5 + 3;
        \`\`\`
        
        \`\`\`javascript
        const b = 10 * 2;
        \`\`\`
      `;
      
      const result = await openrouter.askWithExec(message);
      expect(result.response).toBeTruthy();
      expect(result.execResults).toBeDefined();
    });
  });
}); 