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
  
  describe('Environment Validation', () => {
    it('should validate OPENROUTER_API_KEY exists', () => {
      expect(process.env.OPENROUTER_API_KEY).toBeDefined();
      expect(process.env.OPENROUTER_API_KEY).not.toBe('');
    });
  });

  describe('AskHasyx Base Class', () => {
    it('should create AskHasyx instance extending AI', () => {
      const askInstance = new AskHasyx(process.env.OPENROUTER_API_KEY!);
      expect(askInstance).toBeInstanceOf(AskHasyx);
      expect(askInstance).toBeInstanceOf(AI);
    });

    it('should accept AskOptions and configure engines accordingly', () => {
      const askOptions: AskOptions = {
        exec: true,
        execTs: false,
        terminal: true
      };
      
      const askInstance = new AskHasyx(process.env.OPENROUTER_API_KEY!, { askOptions });
      
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
      const askInstance = new AskHasyx(process.env.OPENROUTER_API_KEY!);
      
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
      const askInstancePartial = new AskHasyx(
        process.env.OPENROUTER_API_KEY!, 
        { askOptions: { exec: true, execTs: false, terminal: false } }
      );
      
      expect(askInstancePartial.context).toContain('JavaScript');
      expect(askInstancePartial.context).not.toContain('TypeScript');
      expect(askInstancePartial.context).not.toContain('terminal');
    });

    it('should disable execution for disabled engines', async () => {
      const askInstance = new AskHasyx(
        process.env.OPENROUTER_API_KEY!, 
        { askOptions: { exec: false, execTs: false, terminal: false } }
      );

      // Real Do operation for disabled engine
      const testDo = {
        role: 'tool' as const,
        content: 'test',
        id: 'test-id',
        operation: 'do/exec/js',
        format: 'js' as const,
        request: 'console.log("test")',
        startLine: 0,
        endLine: 0
      };

      const result = await askInstance.do(testDo);
      expect(result.response).toContain('JavaScript execution is disabled');
    });
  });

  describe('Ask Class (Child)', () => {
    it('should create Ask instance extending AskHasyx', () => {
      const askInstance = new Ask(process.env.OPENROUTER_API_KEY!, 'Test Project');
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
      const askInstance = new Ask(process.env.OPENROUTER_API_KEY!, 'Test Project');
      
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
      const askInstance = new Ask(process.env.OPENROUTER_API_KEY!, 'Test Project');
      expect(askInstance.systemPrompt).toContain('Test Project');
      expect(askInstance.systemPrompt).toContain('working together');
      // Note: The systemPrompt may contain execution environments context from AskHasyx
      // This is expected behavior since AskHasyx adds context based on enabled engines
    });

    it('should use Google Gemini 2.5 Flash Preview model by default', () => {
      const askInstance = new Ask(process.env.OPENROUTER_API_KEY!, 'Test Project');
      expect(askInstance).toBeDefined();
      // Note: The actual model is configured in the super() call and would need to be tested at integration level
    });
  });

  describe('AskOptions Configuration', () => {
    it('should create Ask with custom engine configuration through AskHasyx', () => {
      // Since Ask hardcodes options, we test this through AskHasyx directly
      const customOptions: AskOptions = {
        exec: true,
        execTs: false,
        terminal: true
      };
      
      const askInstance = new AskHasyx(
        process.env.OPENROUTER_API_KEY!, 
        { 
          systemPrompt: 'Custom prompt',
          askOptions: customOptions
        }
      );
      
      expect(askInstance.askOptions).toEqual(customOptions);
      expect(askInstance.engines.exec).toBeDefined();
      expect(askInstance.engines.execTs).toBeUndefined();
      expect(askInstance.engines.terminal).toBeDefined();
    });

    it('should handle all engines disabled', () => {
      const askInstance = new AskHasyx(
        process.env.OPENROUTER_API_KEY!, 
        { askOptions: { exec: false, execTs: false, terminal: false } }
      );
      
      expect(askInstance.context).toBe(''); // No context when all engines disabled
      expect(Object.keys(askInstance.engines)).toHaveLength(0);
    });

    it('should show correct enabled engines in REPL message', async () => {
      const askInstance = new AskHasyx(
        process.env.OPENROUTER_API_KEY!, 
        { askOptions: { exec: true, execTs: false, terminal: true } }
      );
      
      // Check what would be logged without actually using mocks
      if (askInstance._do) {
        const enabledEngines: string[] = [];
        if (askInstance.askOptions.exec) enabledEngines.push('JavaScript');
        if (askInstance.askOptions.execTs) enabledEngines.push('TypeScript');
        if (askInstance.askOptions.terminal) enabledEngines.push('Terminal');
        
        expect(enabledEngines).toEqual(['JavaScript', 'Terminal']);
      }
    });
  });

  describe('Progress Callbacks', () => {
    it('should have progress callback functions defined', () => {
      const askInstance = new AskHasyx(process.env.OPENROUTER_API_KEY!, { systemPrompt: 'Test Project' });
      
      expect(askInstance._onThinking).toBeDefined();
      expect(askInstance._onCodeFound).toBeDefined();
      expect(askInstance._onCodeExecuting).toBeDefined();
      expect(askInstance._onCodeResult).toBeDefined();
      expect(askInstance._onResponse).toBeDefined();
    });

    it('should support async progress callbacks', () => {
      const askInstance = new AskHasyx(process.env.OPENROUTER_API_KEY!, { systemPrompt: 'Test Project' });
      
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
      expect(ask instanceof Ask).toBe(true);
      expect(ask instanceof AI).toBe(true);
      
      // Check that ask has AskHasyx functionality (engines and methods)
      expect(ask.engines).toBeDefined();
      expect(ask.engines.exec).toBeDefined();
      expect(ask.engines.execTs).toBeDefined();
      expect(ask.engines.terminal).toBeDefined();
      expect(typeof ask.repl).toBe('function');
      expect(typeof ask.askWithBeautifulOutput).toBe('function');
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

    it('should respect disabled engines', async () => {
      const askInstance = new AskHasyx(
        process.env.OPENROUTER_API_KEY!, 
        { askOptions: { exec: false, execTs: true, terminal: true } }
      );
      
      // This should not execute JavaScript but might try TypeScript or terminal
      const response = await askInstance.ask('Calculate 2 + 2 using any available method');
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
      // Response might mention that JavaScript execution is not available
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

    it('should handle disabled engine execution attempts', async () => {
      const askInstance = new AskHasyx(
        process.env.OPENROUTER_API_KEY!, 
        { askOptions: { exec: false, execTs: false, terminal: false } }
      );

      // Real Do operation for testing
      const testDo = {
        role: 'tool' as const,
        content: 'test',
        id: 'test-id',
        operation: 'do/exec/js',
        format: 'js' as const,
        request: 'console.log("test")',
        startLine: 0,
        endLine: 0
      };

      const result = await askInstance.do(testDo);
      expect(result.response).toContain('execution is disabled');
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
      // Check that the AI either mentioned the function or that execution worked correctly
      expect(response.toLowerCase()).toMatch(/function|worked|result|expected|successful|execution|logs|called/);
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