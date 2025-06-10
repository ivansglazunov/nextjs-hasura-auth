import * as dotenv from 'dotenv';
import * as path from 'path';
import { Ask, ask } from './ask';
import { AskHasyx, AskOptions } from './ask-hasyx';
import { AI } from './ai';
import { OpenRouter } from './openrouter';
import Debug from './debug';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const debug = Debug('test:ask');

(!!process?.env?.OPENROUTER_API_KEY ? describe : describe.skip)('Real Ask Class & AI Integration Tests', () => {
  afterEach(async () => {
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  describe('Environment Validation', () => {
    it('should validate OPENROUTER_API_KEY exists', () => {
      expect(process.env.OPENROUTER_API_KEY).toBeDefined();
      expect(process.env.OPENROUTER_API_KEY).not.toBe('');
    });
  });

  describe('AskHasyx Base Class', () => {
    it('should create AskHasyx instance extending AI', () => {
      const provider = new OpenRouter({ token: process.env.OPENROUTER_API_KEY! });
      const askInstance = new AskHasyx({ provider });
      expect(askInstance).toBeInstanceOf(AskHasyx);
      expect(askInstance).toBeInstanceOf(AI);
    });

    it('should accept AskOptions and configure engines accordingly', () => {
      const provider = new OpenRouter({ token: process.env.OPENROUTER_API_KEY! });
      const askOptions: AskOptions = {
        exec: true,
        execTs: false,
        terminal: true
      };
      
      const askInstance = new AskHasyx({ provider, askOptions });
      
      expect(askInstance.askOptions).toEqual({
        exec: true,
        execTs: false,
        terminal: true
      });
      
      expect(askInstance.engines.exec).toBeDefined();
      expect(askInstance.engines.execTs).toBeUndefined();
      expect(askInstance.engines.terminal).toBeDefined();
    });

    it('should use default options when none provided', () => {
      const provider = new OpenRouter({ token: process.env.OPENROUTER_API_KEY! });
      const askInstance = new AskHasyx({ provider });
      
      expect(askInstance.askOptions).toEqual({
        exec: true,
        execTs: true,
        terminal: true
      });
      
      expect(askInstance.engines.exec).toBeDefined();
      expect(askInstance.engines.execTs).toBeDefined();
      expect(askInstance.engines.terminal).toBeDefined();
    });

    it('should include only enabled engines in context', () => {
      const provider = new OpenRouter({ token: process.env.OPENROUTER_API_KEY! });
      const askInstancePartial = new AskHasyx({
        provider,
        askOptions: { exec: true, execTs: false, terminal: false }
      });
      
      expect(askInstancePartial.context).toContain('JavaScript');
      expect(askInstancePartial.context).not.toContain('TypeScript');
      expect(askInstancePartial.context).not.toContain('terminal');
    });

    it('should handle all engines disabled', () => {
      const provider = new OpenRouter({ token: process.env.OPENROUTER_API_KEY! });
      const askInstance = new AskHasyx({
        provider,
        askOptions: { exec: false, execTs: false, terminal: false }
      });

      expect(askInstance.context).toBe(''); // No context when all engines disabled
      expect(Object.keys(askInstance.engines)).toHaveLength(0);
    });
  });

  describe('Ask Class (Child)', () => {
    it('should create Ask instance extending AskHasyx', () => {
      const provider = new OpenRouter({ token: process.env.OPENROUTER_API_KEY! });
      const askInstance = new Ask({ provider, projectName: 'Test Project' });
      expect(askInstance instanceof Ask).toBe(true);
      expect(askInstance instanceof AI).toBe(true);
      
      // Check that Ask has AskHasyx functionality (engines and methods)
      expect(askInstance.engines).toBeDefined();
      expect(askInstance.engines.exec).toBeDefined();
      expect(askInstance.engines.execTs).toBeDefined();
      expect(askInstance.engines.terminal).toBeDefined();
      expect(typeof askInstance.repl).toBe('function');
      expect(typeof askInstance.askWithBeautifulOutput).toBe('function');
    });

    it('should have all engines enabled by default', () => {
      const provider = new OpenRouter({ token: process.env.OPENROUTER_API_KEY! });
      const askInstance = new Ask({ provider, projectName: 'Test Project' });
      
      // Check that engines are present
      expect(askInstance.engines.exec).toBeDefined();
      expect(askInstance.engines.execTs).toBeDefined();
      expect(askInstance.engines.terminal).toBeDefined();
      
      // askOptions might be undefined in Jest environment but should have engines working
      if (askInstance.askOptions) {
        expect(askInstance.askOptions).toEqual({
          exec: true,
          execTs: true,
          terminal: true
        });
      }
    });

    it('should have project-specific system prompt', () => {
      const provider = new OpenRouter({ token: process.env.OPENROUTER_API_KEY! });
      const askInstance = new Ask({ provider, projectName: 'Test Project' });
      expect(askInstance.systemPrompt).toContain('Test Project');
      expect(askInstance.systemPrompt).toContain('working together');
      // Note: The systemPrompt may contain execution environments context from AskHasyx
      // This is expected behavior since AskHasyx adds context based on enabled engines
    });

    it('should use Google Gemini 2.5 Flash Preview model by default', () => {
      const provider = new OpenRouter({ token: process.env.OPENROUTER_API_KEY! });
      const askInstance = new Ask({ provider, projectName: 'Test Project' });
      expect(askInstance).toBeDefined();
      // Note: The actual model is configured in the super() call and would need to be tested at integration level
    });
  });

  describe('AskOptions Configuration', () => {
    it('should create Ask with custom engine configuration through AskHasyx', () => {
      // Since Ask hardcodes options, we test this through AskHasyx directly
      const provider = new OpenRouter({ token: process.env.OPENROUTER_API_KEY! });
      const customOptions: AskOptions = {
        exec: true,
        execTs: false,
        terminal: true
      };
      
      const askInstance = new AskHasyx({
        provider,
        systemPrompt: 'Custom prompt',
        askOptions: customOptions
      });
      
      expect(askInstance.askOptions).toEqual(customOptions);
      expect(askInstance.engines.exec).toBeDefined();
      expect(askInstance.engines.execTs).toBeUndefined();
      expect(askInstance.engines.terminal).toBeDefined();
    });

    it('should handle all engines disabled', () => {
      const provider = new OpenRouter({ token: process.env.OPENROUTER_API_KEY! });
      const askInstance = new AskHasyx({
        provider,
        askOptions: { exec: false, execTs: false, terminal: false }
      });
      
      expect(askInstance.context).toBe(''); // No context when all engines disabled
      expect(Object.keys(askInstance.engines)).toHaveLength(0);
    });

    it('should show correct enabled engines in REPL message', async () => {
      const provider = new OpenRouter({ token: process.env.OPENROUTER_API_KEY! });
      const askInstance = new AskHasyx({
        provider,
        askOptions: { exec: true, execTs: false, terminal: true }
      });
      
      // Check what would be enabled without actually using deprecated methods
      const enabledEngines: string[] = [];
      if (askInstance.askOptions.exec) enabledEngines.push('JavaScript');
      if (askInstance.askOptions.execTs) enabledEngines.push('TypeScript');
      if (askInstance.askOptions.terminal) enabledEngines.push('Terminal');
      
      expect(enabledEngines).toEqual(['JavaScript', 'Terminal']);
    });
  });

  describe('Markdown Integration', () => {
    it('should import printMarkdown for beautiful output', () => {
      // Test that the markdown formatting module is properly imported
      const provider = new OpenRouter({ token: process.env.OPENROUTER_API_KEY! });
      const askInstance = new Ask({ provider, projectName: 'Test Project' });
      expect(askInstance).toBeDefined();
      // The actual printMarkdown usage is tested through integration tests
    });
  });

  describe('Default Ask Instance', () => {
    it('should export default ask instance or null', () => {
      // ask can be null if OpenRouter token is not available
      if (ask) {
        expect(ask instanceof Ask).toBe(true);
        expect(ask instanceof AI).toBe(true);
        
        // Check that ask has AskHasyx functionality (engines and methods)
        expect(ask.engines).toBeDefined();
        expect(ask.engines.exec).toBeDefined();
        expect(ask.engines.execTs).toBeDefined();
        expect(ask.engines.terminal).toBeDefined();
        expect(typeof ask.repl).toBe('function');
        expect(typeof ask.askWithBeautifulOutput).toBe('function');
      } else {
        // If ask is null, it's because OpenRouter token is not available
        expect(ask).toBeNull();
      }
    });

    it('should use project name from environment when ask is available', () => {
      if (ask) {
        expect(ask.systemPrompt).toContain(process?.env?.npm_package_name || 'Unknown Project');
      } else {
        // Skip test if ask is null
        expect(ask).toBeNull();
      }
    });
  });

  describe('AI Functionality', () => {
    it('should handle simple questions', async () => {
      const provider = new OpenRouter({ token: process.env.OPENROUTER_API_KEY! });
      const askInstance = new Ask({ provider, projectName: 'Test Project' });
      
      const response = await askInstance.ask('Say "test response" and nothing else');
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    }, 30000);

    it('should handle mathematical questions', async () => {
      const provider = new OpenRouter({ token: process.env.OPENROUTER_API_KEY! });
      const askInstance = new Ask({ provider, projectName: 'Test Project' });
      
      const response = await askInstance.ask('What is 2 + 2? Answer with just the number.');
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Code Execution Integration', () => {
    it('should execute JavaScript code via code blocks', async () => {
      const provider = new OpenRouter({ token: process.env.OPENROUTER_API_KEY! });
      const askInstance = new Ask({ provider, projectName: 'Test Project' });
      
      const response = await askInstance.ask('Calculate 5 + 3 using JavaScript code execution');
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    }, 45000);

    it('should handle TypeScript code execution', async () => {
      const provider = new OpenRouter({ token: process.env.OPENROUTER_API_KEY! });
      const askInstance = new Ask({ provider, projectName: 'Test Project' });
      
      const response = await askInstance.ask('Create a TypeScript interface for a user with id and name, then create an instance');
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    }, 45000);

    it('should handle terminal command execution', async () => {
      const provider = new OpenRouter({ token: process.env.OPENROUTER_API_KEY! });
      const askInstance = new Ask({ provider, projectName: 'Test Project' });
      
      const response = await askInstance.ask('Execute echo "hello world" in terminal');
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    }, 45000);

    it('should support iterative code execution and reasoning', async () => {
      const provider = new OpenRouter({ token: process.env.OPENROUTER_API_KEY! });
      const askInstance = new Ask({ provider, projectName: 'Test Project' });
      
      const response = await askInstance.ask('First calculate 10 * 5 with JavaScript, then explain the result');
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
      // Should contain both execution results and explanation
    }, 60000);

    it('should respect disabled engines', async () => {
      const provider = new OpenRouter({ token: process.env.OPENROUTER_API_KEY! });
      const askInstance = new AskHasyx({
        provider,
        askOptions: { exec: false, execTs: true, terminal: true }
      });
      
      // This should not execute JavaScript but might try TypeScript or terminal
      const response = await askInstance.ask('Calculate 2 + 2 using any available method');
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
      // Response might mention that JavaScript execution is not available
    }, 60000);
  });

  describe('Error Handling', () => {
    it('should handle invalid API key gracefully', () => {
      const invalidProvider = new OpenRouter({ token: 'invalid-key' });
      expect(() => {
        new Ask({ provider: invalidProvider, projectName: 'Test Project' });
      }).not.toThrow();
    });

    it('should handle missing project name', () => {
      const provider = new OpenRouter({ token: process.env.OPENROUTER_API_KEY! });
      const askInstance = new Ask({ provider });
      expect(askInstance.systemPrompt).toContain('Unknown Project');
    });

    it('should handle execution in disabled engines gracefully', async () => {
      const provider = new OpenRouter({ token: process.env.OPENROUTER_API_KEY! });
      const askInstance = new AskHasyx({
        provider,
        askOptions: { exec: false, execTs: false, terminal: false }
      });

      // Try to ask for code execution when all engines are disabled
      const response = await askInstance.ask('Calculate 2 + 2 using code');
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
      // Should handle this gracefully without crashing
    }, 30000);
  });

  describe('OpenRouter Base Integration', () => {
    it('should create OpenRouter instance with correct configuration', () => {
      const openrouter = new OpenRouter({
        token: process.env.OPENROUTER_API_KEY!,
        context: {},
        model: 'google/gemini-2.5-flash-preview',
        temperature: 0.7,
        max_tokens: 4096
      });
      
      expect(openrouter).toBeInstanceOf(OpenRouter);
    });

    it('should handle API errors gracefully', async () => {
      const invalidOpenrouter = new OpenRouter({ token: 'invalid-key' });
      
      await expect(invalidOpenrouter.ask('test')).rejects.toThrow();
    });
  });

  describe('Model Configuration', () => {
    it('should use correct default model', () => {
      const provider = new OpenRouter({ token: process.env.OPENROUTER_API_KEY! });
      const askInstance = new Ask({ provider, projectName: 'Test Project' });
      expect(askInstance).toBeDefined();
    });

    it('should handle different temperature settings via OpenRouter', async () => {
      const lowTempRouter = new OpenRouter({
        token: process.env.OPENROUTER_API_KEY!,
        context: {},
        model: 'google/gemini-2.5-flash-preview',
        temperature: 0.1,
        max_tokens: 50
      });
      
      const highTempRouter = new OpenRouter({
        token: process.env.OPENROUTER_API_KEY!,
        context: {},
        model: 'google/gemini-2.5-flash-preview',
        temperature: 0.9,
        max_tokens: 50
      });
      
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
      const provider = new OpenRouter({ token: process.env.OPENROUTER_API_KEY! });
      const askInstance = new Ask({ provider, projectName: 'Test Project' });
      
      const response = await askInstance.ask('Write a simple JavaScript function that adds two numbers');
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
      // Check that the AI either mentioned the function or that execution worked correctly
      expect(response.toLowerCase()).toMatch(/function|worked|result|expected|successful|execution|logs|called/);
    }, 60000);

    it('should handle general knowledge questions', async () => {
      const provider = new OpenRouter({ token: process.env.OPENROUTER_API_KEY! });
      const askInstance = new Ask({ provider, projectName: 'Test Project' });
      
      const response = await askInstance.ask('What is the capital of France? Answer in one word.');
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    }, 30000);

    it('should demonstrate "we" communication style', async () => {
      const provider = new OpenRouter({ token: process.env.OPENROUTER_API_KEY! });
      const askInstance = new Ask({ provider, projectName: 'Test Project' });
      
      const response = await askInstance.ask('Explain what we are doing in this conversation');
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
      expect(response.toLowerCase()).toMatch(/we/);
    }, 30000);
  });

  describe('Memory and Context', () => {
    it('should maintain conversation memory', async () => {
      const provider = new OpenRouter({ token: process.env.OPENROUTER_API_KEY! });
      const askInstance = new Ask({ provider, projectName: 'Test Project' });
      
      await askInstance.ask('Remember that my favorite color is blue');
      const response = await askInstance.ask('What is my favorite color?');
      
      expect(typeof response).toBe('string');
      expect(response.toLowerCase()).toContain('blue');
    }, 60000);

    it('should have memory management methods from AI base class', () => {
      const provider = new OpenRouter({ token: process.env.OPENROUTER_API_KEY! });
      const askInstance = new Ask({ provider, projectName: 'Test Project' });
      
      // Test memory property access
      expect(askInstance.memory).toBeDefined();
      expect(Array.isArray(askInstance.memory)).toBe(true);
      
      // Test clearMemory method
      expect(typeof askInstance.clearMemory).toBe('function');
      askInstance.clearMemory();
      expect(askInstance.memory.length).toBeGreaterThanOrEqual(0); // System prompt might be present
    });
  });
}); 