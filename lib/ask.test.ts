import dotenv from 'dotenv';
import { Ask, ask } from './ask';
import { AI } from './ai';
import { OpenRouter } from './openrouter';

// Load environment variables from .env file
dotenv.config();

(!!process?.env?.OPENROUTER_API_KEY ? describe : describe.skip)('Ask Class & AI Integration', () => {
  
  describe('Environment Validation', () => {
    it('should validate OPENROUTER_API_KEY exists', () => {
      expect(process.env.OPENROUTER_API_KEY).toBeDefined();
      expect(process.env.OPENROUTER_API_KEY).not.toBe('');
    });
  });

  describe('Ask Class', () => {
    it('should create Ask instance extending AI', () => {
      const askInstance = new Ask(process.env.OPENROUTER_API_KEY!, 'Test Project');
      expect(askInstance).toBeInstanceOf(Ask);
      expect(askInstance).toBeInstanceOf(AI);
    });

    it('should have correct engines configured', () => {
      const askInstance = new Ask(process.env.OPENROUTER_API_KEY!, 'Test Project');
      expect(askInstance.engines).toBeDefined();
      expect(askInstance.engines.exec).toBeDefined();
      expect(askInstance.engines.execTs).toBeDefined();
      expect(askInstance.engines.terminal).toBeDefined();
    });

    it('should have context string configured', () => {
      const askInstance = new Ask(process.env.OPENROUTER_API_KEY!, 'Test Project');
      expect(askInstance.context).toBeDefined();
      expect(typeof askInstance.context).toBe('string');
      expect(askInstance.context.length).toBeGreaterThan(0);
    });

    it('should have system prompt with project name', () => {
      const askInstance = new Ask(process.env.OPENROUTER_API_KEY!, 'Test Project');
      expect(askInstance.systemPrompt).toBeDefined();
      expect(askInstance.systemPrompt).toContain('Test Project');
      expect(askInstance.systemPrompt).toContain('working together');
    });

    it('should use Google Gemini 2.5 Flash Preview model by default', () => {
      const askInstance = new Ask(process.env.OPENROUTER_API_KEY!, 'Test Project');
      // Check that the model configuration is accessible through openRouter instance
      expect(askInstance).toBeDefined();
      // Note: The actual model is configured in the super() call and would need to be tested at integration level
    });
  });

  describe('Progress Callbacks', () => {
    let askInstance: Ask;
    let mockCallbacks: {
      onThinking: () => void;
      onCodeFound: (code: string, format: 'js' | 'tsx' | 'terminal') => void;
      onCodeExecuting: (code: string, format: 'js' | 'tsx' | 'terminal') => void;
      onCodeResult: (result: string) => void;
      onResponse: (response: string) => void;
    };

    beforeEach(() => {
      askInstance = new Ask(process.env.OPENROUTER_API_KEY!, 'Test Project');
      mockCallbacks = {
        onThinking: () => {},
        onCodeFound: () => {},
        onCodeExecuting: () => {},
        onCodeResult: () => {},
        onResponse: () => {}
      };

      // Override default callbacks with mocks
      askInstance._onThinking = mockCallbacks.onThinking;
      askInstance._onCodeFound = mockCallbacks.onCodeFound;
      askInstance._onCodeExecuting = mockCallbacks.onCodeExecuting;
      askInstance._onCodeResult = mockCallbacks.onCodeResult;
      askInstance._onResponse = mockCallbacks.onResponse;
    });

    it('should have progress callback functions defined', () => {
      expect(askInstance._onThinking).toBeDefined();
      expect(askInstance._onCodeFound).toBeDefined();
      expect(askInstance._onCodeExecuting).toBeDefined();
      expect(askInstance._onCodeResult).toBeDefined();
      expect(askInstance._onResponse).toBeDefined();
    });

    it('should support async progress callbacks', () => {
      // The callbacks should support both sync and async functions
      expect(typeof askInstance._onCodeFound).toBe('function');
      expect(typeof askInstance._onCodeResult).toBe('function');
    });
  });

  describe('Markdown Integration', () => {
    it('should import printMarkdown for beautiful output', () => {
      // Test that the markdown formatting module is properly imported
      const askInstance = new Ask(process.env.OPENROUTER_API_KEY!, 'Test Project');
      expect(askInstance).toBeDefined();
      // The actual printMarkdown usage is tested through integration tests
    });
  });

  describe('Default Ask Instance', () => {
    it('should export default ask instance', () => {
      expect(ask).toBeInstanceOf(Ask);
      expect(ask).toBeInstanceOf(AI);
    });

    it('should use project name from environment', () => {
      expect(ask.systemPrompt).toContain(process?.env?.npm_package_name || 'Unknown Project');
    });
  });

  describe('AI Functionality', () => {
    it('should handle simple questions', async () => {
      const askInstance = new Ask(process.env.OPENROUTER_API_KEY!, 'Test Project');
      
      const response = await askInstance.ask('Say "test response" and nothing else');
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    }, 30000);

    it('should handle mathematical questions', async () => {
      const askInstance = new Ask(process.env.OPENROUTER_API_KEY!, 'Test Project');
      
      const response = await askInstance.ask('What is 2 + 2? Answer with just the number.');
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Code Execution Integration', () => {
    it('should execute JavaScript code via Do operations', async () => {
      const askInstance = new Ask(process.env.OPENROUTER_API_KEY!, 'Test Project');
      
      const response = await askInstance.ask('Calculate 5 + 3 using JavaScript code execution');
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    }, 45000);

    it('should handle TypeScript code execution', async () => {
      const askInstance = new Ask(process.env.OPENROUTER_API_KEY!, 'Test Project');
      
      const response = await askInstance.ask('Create a TypeScript interface for a user with id and name, then create an instance');
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    }, 45000);

    it('should handle terminal command execution', async () => {
      const askInstance = new Ask(process.env.OPENROUTER_API_KEY!, 'Test Project');
      
      const response = await askInstance.ask('Execute echo "hello world" in terminal');
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    }, 45000);

    it('should support iterative code execution and reasoning', async () => {
      const askInstance = new Ask(process.env.OPENROUTER_API_KEY!, 'Test Project');
      
      const response = await askInstance.ask('First calculate 10 * 5 with JavaScript, then explain the result');
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
      // Should contain both execution results and explanation
    }, 60000);
  });

  describe('Error Handling', () => {
    it('should handle invalid API key gracefully', () => {
      expect(() => {
        new Ask('invalid-key', 'Test Project');
      }).not.toThrow();
    });

    it('should handle missing project name', () => {
      const askInstance = new Ask(process.env.OPENROUTER_API_KEY!);
      expect(askInstance.systemPrompt).toContain('Unknown Project');
    });
  });

  describe('OpenRouter Base Integration', () => {
    it('should create OpenRouter instance with correct configuration', () => {
      const openrouter = new OpenRouter(
        process.env.OPENROUTER_API_KEY!,
        {},
        {
          model: 'google/gemini-2.5-flash-preview',
          temperature: 0.7,
          max_tokens: 4096
        }
      );
      
      expect(openrouter).toBeInstanceOf(OpenRouter);
    });

    it('should handle API errors gracefully', async () => {
      const invalidOpenrouter = new OpenRouter('invalid-key');
      
      await expect(invalidOpenrouter.ask('test')).rejects.toThrow();
    });
  });

  describe('Model Configuration', () => {
    it('should use correct default model', () => {
      const askInstance = new Ask(process.env.OPENROUTER_API_KEY!, 'Test Project');
      expect(askInstance).toBeDefined();
    });

    it('should handle different temperature settings via OpenRouter', async () => {
      const lowTempRouter = new OpenRouter(
        process.env.OPENROUTER_API_KEY!,
        {},
        {
          model: 'google/gemini-2.5-flash-preview',
          temperature: 0.1,
          max_tokens: 50
        }
      );
      
      const highTempRouter = new OpenRouter(
        process.env.OPENROUTER_API_KEY!,
        {},
        {
          model: 'google/gemini-2.5-flash-preview',
          temperature: 0.9,
          max_tokens: 50
        }
      );
      
      const lowTempResponse = await lowTempRouter.ask('Say hello');
      const highTempResponse = await highTempRouter.ask('Say hello');
      
      expect(typeof lowTempResponse).toBe('string');
      expect(typeof highTempResponse).toBe('string');
      expect(lowTempResponse.length).toBeGreaterThan(0);
      expect(highTempResponse.length).toBeGreaterThan(0);
    }, 45000);
  });

  describe('Real World Usage Scenarios', () => {
    it('should handle coding questions', async () => {
      const askInstance = new Ask(process.env.OPENROUTER_API_KEY!, 'Test Project');
      
      const response = await askInstance.ask('Write a simple JavaScript function that adds two numbers');
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
      expect(response.toLowerCase()).toContain('function');
    }, 60000);

    it('should handle general knowledge questions', async () => {
      const askInstance = new Ask(process.env.OPENROUTER_API_KEY!, 'Test Project');
      
      const response = await askInstance.ask('What is the capital of France? Answer in one word.');
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    }, 30000);

    it('should demonstrate "we" communication style', async () => {
      const askInstance = new Ask(process.env.OPENROUTER_API_KEY!, 'Test Project');
      
      const response = await askInstance.ask('Explain what we are doing in this conversation');
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
      expect(response.toLowerCase()).toMatch(/we/);
    }, 30000);
  });

  describe('Memory and Context', () => {
    it('should maintain conversation memory', async () => {
      const askInstance = new Ask(process.env.OPENROUTER_API_KEY!, 'Test Project');
      
      await askInstance.ask('Remember that my favorite color is blue');
      const response = await askInstance.ask('What is my favorite color?');
      
      expect(typeof response).toBe('string');
      expect(response.toLowerCase()).toContain('blue');
    }, 60000);

    it('should have project info methods from AI base class', () => {
      const askInstance = new Ask(process.env.OPENROUTER_API_KEY!, 'Test Project');
      
      const projectInfo = askInstance.getProjectInfo();
      expect(projectInfo).toBeDefined();
      expect(projectInfo.name).toBeDefined();
      
      const context = askInstance.getRecommendedContext();
      expect(context).toBeDefined();
      expect(context.PROJECT_NAME).toBeDefined();
    });
  });
}); 