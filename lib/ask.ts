#!/usr/bin/env node

import dotenv from 'dotenv';
import path from 'path';
import readline from 'readline';
import Debug from 'hasyx/lib/debug';

// Load environment variables from .env file in current working directory
// This ensures that when using npx hasyx from a child project,
// the .env is loaded from the user's current directory, not from hasyx package directory
dotenv.config({ path: path.join(process.cwd(), '.env') });

import { AI, Do } from 'hasyx/lib/ai';
import { execDo, execContext } from 'hasyx/lib/exec';
import { execTsDo, execTsContext } from 'hasyx/lib/exec-tsx';
import { terminalDo, terminalContext } from 'hasyx/lib/terminal';
import { printMarkdown } from 'hasyx/lib/markdown-terminal';

const debug = Debug('hasyx:ask');

export class Ask extends AI {
  public context: string;
  public engines: {
    exec: typeof execDo;
    execTs: typeof execTsDo;
    terminal: typeof terminalDo;
  };
  private isReplMode: boolean = false;

  constructor(token: string, projectName: string = 'Unknown Project') {
    // System prompt in English but addressing both AI and user as "we"
    const systemPrompt = `You are an AI assistant for the "${projectName}" project.

We are working together on this project. When we need to execute code, analyze data, or perform operations, we use the available execution environments.

${execContext}

${execTsContext}

${terminalContext}

**Communication Guidelines:**
- Always use "we" when referring to our work together ("we implemented", "we will try", "we observed", "we succeeded", "we agree", "we made a mistake")
- Execute code ONLY when calculations, demonstrations, or verification are actually needed
- For simple questions, conversations, or general knowledge - respond directly without code execution
- Use proper error handling and provide helpful explanations
- Keep responses focused and practical

**IMPORTANT CODE EXECUTION RULES:**
- When you need to execute terminal commands, you MUST use the exact format: > 🪬<uuid>/do/terminal/bash followed by \`\`\`bash
- When you need to execute JavaScript, you MUST use the exact format: > 🪬<uuid>/do/exec/js followed by \`\`\`js  
- When you need to execute TypeScript, you MUST use the exact format: > 🪬<uuid>/do/exec/tsx followed by \`\`\`tsx
- NEVER use \`\`\`terminal - always use \`\`\`bash for terminal commands
- Always generate a unique UUID for each operation
- Only execute code when it's actually necessary to answer the question

**Important:** Don't separate yourself from the user - we are working together as a team. Only execute code when it's actually necessary to answer the question.`;

    super(token, {}, {
      model: 'google/gemini-2.5-flash-preview',
      temperature: 0.1,
      max_tokens: 2048
    }, systemPrompt);

    this.context = [execContext, execTsContext, terminalContext].join('\n\n');
    
    this.engines = {
      exec: execDo,
      execTs: execTsDo,
      terminal: terminalDo
    };

    // Setup real-time progress callbacks for transparency (only in REPL mode)
    this._onThinking = () => {
      if (this.isReplMode) {
        console.log('🧠 AI думает...');
      }
    };

    this._onCodeFound = async (code: string, format: 'js' | 'tsx' | 'terminal') => {
      if (this.isReplMode) {
        console.log(`📋 Найден ${format.toUpperCase()} код для выполнения:`);
        const displayFormat = format === 'terminal' ? 'bash' : format;
        await printMarkdown(`\`\`\`${displayFormat}\n${code}\n\`\`\``);
      }
    };

    this._onCodeExecuting = (code: string, format: 'js' | 'tsx' | 'terminal') => {
      if (this.isReplMode) {
        console.log(`⚡ Выполняется ${format.toUpperCase()} код...`);
      }
    };

    this._onCodeResult = async (result: string) => {
      if (this.isReplMode) {
        console.log(`✅ Результат выполнения:`);
        await printMarkdown(`\`\`\`\n${result}\n\`\`\``);
      }
    };

    this._onResponse = (response: string) => {
      if (this.isReplMode) {
        console.log(`💭 AI ответил (${response.length} символов)`);
      }
    };

    // Setup Do handler
    this._do = async (doItem: Do): Promise<Do> => {
      try {
        // Notify that code execution is starting
        if (this._onCodeExecuting) {
          this._onCodeExecuting(doItem.request, doItem.format);
        }

        let result: any;

        if (doItem.operation.startsWith('do/exec/js')) {
          // Update exec context with current AI results
          this.engines.exec.updateContext({ 
            ...this.engines.exec.getContext(), 
            results: this.results 
          });
          result = await this.engines.exec.exec(doItem.request);
        } else if (doItem.operation.startsWith('do/exec/tsx')) {
          // Update execTs context with current AI results
          this.engines.execTs.updateContext({ 
            ...this.engines.execTs.getContext(), 
            results: this.results 
          });
          result = await this.engines.execTs.exec(doItem.request);
        } else if (doItem.operation.startsWith('do/terminal/')) {
          const shell = doItem.operation.split('/')[2]; // Extract shell type
          result = await this.engines.terminal.exec(doItem.request, shell);
        } else {
          throw new Error(`Unknown operation: ${doItem.operation}`);
        }

        // Format result for AI
        doItem.response = this.formatResult(result);
        
        // Notify about execution result
        if (this._onCodeResult) {
          await this._onCodeResult(doItem.response);
        }
        
        return doItem;
      } catch (error) {
        const errorMessage = `Error: ${error instanceof Error ? error.message : String(error)}`;
        doItem.response = errorMessage;
        
        // Notify about execution result (even if it's an error)
        if (this._onCodeResult) {
          await this._onCodeResult(errorMessage);
        }
        
        return doItem;
      }
    };
  }

  private formatResult(result: any): string {
    if (result === undefined) return 'undefined';
    if (result === null) return 'null';
    if (typeof result === 'string') return result;
    if (typeof result === 'number' || typeof result === 'boolean') return String(result);
    if (result instanceof Error) return `Error: ${result.message}`;
    if (typeof result === 'function') return `[Function: ${result.name || 'anonymous'}]`;
    if (typeof result === 'object') {
      try {
        return JSON.stringify(result, null, 2);
      } catch {
        return String(result);
      }
    }
    return String(result);
  }

  /**
   * Ask a question with beautiful streaming output (for non-REPL usage)
   */
  async askWithBeautifulOutput(question: string): Promise<string> {
    debug('Processing question with beautiful output:', question);
    
    return new Promise((resolve, reject) => {
      let accumulatedText = '';
      let finalResponse = '';
      
      this.asking(question).subscribe({
        next: (event) => {
          switch (event.type) {
            case 'thinking':
              console.log('🧠 AI думает...');
              break;
              
            case 'iteration':
              if (event.data.iteration > 1) {
                console.log(`🔄 Итерация ${event.data.iteration}: ${event.data.reason}`);
              }
              break;
              
            case 'text':
              // For non-REPL mode, we can buffer text for markdown rendering
              accumulatedText += event.data.delta;
              break;
              
            case 'code_found':
              console.log(`📋 Найден ${event.data.format.toUpperCase()} код для выполнения:`);
              const displayFormat = event.data.format === 'terminal' ? 'bash' : event.data.format;
              console.log(`\`\`\`${displayFormat}`);
              console.log(event.data.code);
              console.log('```');
              break;
              
            case 'code_executing':
              console.log(`⚡ Выполняется ${event.data.format.toUpperCase()} код...`);
              break;
              
            case 'code_result':
              const status = event.data.success ? '✅' : '❌';
              console.log(`${status} Результат выполнения:`);
              console.log('```');
              console.log(event.data.result);
              console.log('```');
              break;
              
            case 'complete':
              finalResponse = event.data.finalResponse;
              console.log(`💭 Завершено (${event.data.iterations} итераций)`);
              break;
              
            case 'error':
              console.error(`❌ Ошибка в итерации ${event.data.iteration}:`, event.data.error.message);
              break;
          }
        },
        complete: async () => {
          try {
            // Render accumulated text as markdown for beautiful output
            if (accumulatedText) {
              await printMarkdown(accumulatedText);
            }
            resolve(finalResponse || accumulatedText);
          } catch (error) {
            reject(error);
          }
        },
        error: (error) => {
          reject(error);
        }
      });
    });
  }

  /**
   * Interactive REPL mode for terminal interaction with streaming support
   */
  async repl(): Promise<void> {
    this.isReplMode = true; // Enable progress callbacks for REPL
    
    try {
      console.log('🤖 Ask AI anything. Type your question and press Enter. Use Ctrl+C to exit.');
      console.log('💡 Responses with code, formatting, or markdown will be beautifully rendered!');
      console.log('🚀 Real-time streaming enabled!');
      if (this._do) {
        console.log('🪬 AI can execute code automatically!');
      }
      
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: '> '
      });

      rl.prompt();

      rl.on('line', async (input) => {
        const question = input.trim();
        
        if (!question) {
          rl.prompt();
          return;
        }

        debug('Processing REPL question with streaming:', question);
        
        try {
          let accumulatedText = '';
          let responseBuffer = '';
          
          // Use new streaming method
          this.asking(question).subscribe({
            next: (event) => {
              switch (event.type) {
                case 'thinking':
                  console.log('🧠 AI думает...');
                  break;
                  
                case 'iteration':
                  if (event.data.iteration > 1) {
                    console.log(`🔄 Итерация ${event.data.iteration}: ${event.data.reason}`);
                  }
                  break;
                  
                case 'text':
                  // Print text in real-time without newlines
                  process.stdout.write(event.data.delta);
                  accumulatedText += event.data.delta;
                  responseBuffer += event.data.delta;
                  break;
                  
                case 'code_found':
                  // Add newline before code block if needed
                  if (responseBuffer && !responseBuffer.endsWith('\n')) {
                    console.log('');
                  }
                  console.log(`📋 Найден ${event.data.format.toUpperCase()} код для выполнения:`);
                  const displayFormat = event.data.format === 'terminal' ? 'bash' : event.data.format;
                  console.log(`\`\`\`${displayFormat}`);
                  console.log(event.data.code);
                  console.log('```');
                  responseBuffer = ''; // Reset buffer after code block
                  break;
                  
                case 'code_executing':
                  console.log(`⚡ Выполняется ${event.data.format.toUpperCase()} код...`);
                  break;
                  
                case 'code_result':
                  const status = event.data.success ? '✅' : '❌';
                  console.log(`${status} Результат выполнения:`);
                  console.log('```');
                  console.log(event.data.result);
                  console.log('```');
                  break;
                  
                case 'complete':
                  // Ensure we end with a newline
                  if (responseBuffer && !responseBuffer.endsWith('\n')) {
                    console.log('');
                  }
                  console.log(`💭 Завершено (${event.data.iterations} итераций)`);
                  break;
                  
                case 'error':
                  console.error(`❌ Ошибка в итерации ${event.data.iteration}:`, event.data.error.message);
                  break;
              }
            },
            complete: () => {
              console.log('');
              rl.prompt();
            },
            error: (error) => {
              console.error('❌ Ошибка стриминга:', error.message);
              rl.prompt();
            }
          });
          
        } catch (error) {
          debug('Error in streaming REPL:', error);
          console.error('❌ Error:', error instanceof Error ? error.message : String(error));
          rl.prompt();
        }
      });

      rl.on('close', () => {
        debug('REPL closed');
        console.log('\n👋 Goodbye!');
        process.exit(0);
      });

      rl.on('SIGINT', () => {
        debug('SIGINT received in REPL');
        console.log('\n👋 Goodbye!');
        process.exit(0);
      });
    } finally {
      this.isReplMode = false; // Disable progress callbacks when exiting REPL
    }
  }
}

export const ask = new Ask(
  process?.env?.OPENROUTER_API_KEY || 'dummy-key-for-testing',
  process?.env?.npm_package_name || 'Unknown Project'
);

/**
 * Ensures OPENROUTER_API_KEY is available, setting it up interactively if needed
 */
async function ensureOpenRouterApiKey() {
  if (!process?.env?.OPENROUTER_API_KEY) {
    console.log('🔑 OpenRouter API Key not found. Let\'s set it up...');
    
    try {
      const { configureOpenRouter } = await import('./assist-openrouter');
      const { createRlInterface } = await import('./assist-common');
      
      const rl = createRlInterface();
      const envPath = path.join(process.cwd(), '.env');
      
      try {
        await configureOpenRouter(rl, envPath);
        
        // Reload environment variables
        const envResult = dotenv.config({ path: envPath });
        if (envResult.error) {
          console.debug('Warning: Could not reload .env file:', envResult.error);
        }
        
        // Check if the key is now available
        if (!process?.env?.OPENROUTER_API_KEY) {
          console.error('❌ OPENROUTER_API_KEY is still not available. Please check your .env file.');
          process.exit(1);
        }
        
        console.log('✅ OpenRouter API Key configured successfully!');
        
        // Recreate Ask instance with the new API key
        const newAsk = new Ask(
          process.env.OPENROUTER_API_KEY,
          process?.env?.npm_package_name || 'Unknown Project'
        );
        
        // Copy settings from old instance
        Object.assign(ask, newAsk);
        
      } finally {
        rl.close();
      }
    } catch (error) {
      console.error('❌ Failed to configure OpenRouter API Key:', error);
      process.exit(1);
    }
  }
}

// Run REPL if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  (async () => {
    // Ensure OpenRouter API Key is configured
    await ensureOpenRouterApiKey();
    
    // Start REPL
    ask.repl().catch((error) => {
      console.error('❌ Error in ask REPL:', error);
      process.exit(1);
    });
  })();
} 