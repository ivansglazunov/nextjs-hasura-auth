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

const debug = Debug('hasyx:ask-hasyx');

export interface AskOptions {
  exec?: boolean;
  execTs?: boolean;
  terminal?: boolean;
}

export interface OutputHandlers {
  onThinking?: () => void | Promise<void>;
  onCodeFound?: (code: string, format: 'js' | 'tsx' | 'terminal') => void | Promise<void>;
  onCodeExecuting?: (code: string, format: 'js' | 'tsx' | 'terminal') => void | Promise<void>;
  onCodeResult?: (result: string) => void | Promise<void>;
  onResponse?: (response: string) => void | Promise<void>;
  onOutput?: (message: string) => void | Promise<void>;
  onError?: (error: string) => void | Promise<void>;
  onWelcome?: (enabledEngines: string[]) => void | Promise<void>;
  onGoodbye?: () => void | Promise<void>;
}

export class AskHasyx extends AI {
  public context: string;
  public engines: {
    exec?: typeof execDo;
    execTs?: typeof execTsDo;
    terminal?: typeof terminalDo;
  };
  private isReplMode: boolean = false;
  public askOptions: AskOptions;
  public outputHandlers: OutputHandlers;

  constructor(
    token: string, 
    context: any = {}, 
    options: any = {}, 
    systemPrompt?: string, 
    askOptions: AskOptions = {},
    outputHandlers: OutputHandlers = {}
  ) {
    // Set default ask options
    const defaultAskOptions: AskOptions = {
      exec: true,
      execTs: true,
      terminal: true
    };
    
    const finalAskOptions = { ...defaultAskOptions, ...askOptions };

    // Build context string based on enabled engines
    const contextParts: string[] = [];
    if (finalAskOptions.exec) {
      contextParts.push(execContext);
    }
    if (finalAskOptions.execTs) {
      contextParts.push(execTsContext);
    }
    if (finalAskOptions.terminal) {
      contextParts.push(terminalContext);
    }

    // Default system prompt if none provided
    const defaultSystemPrompt = `You are an AI assistant for development projects.

We are working together on this project. When we need to execute code, analyze data, or perform operations, we use the available execution environments.

${contextParts.join('\n\n')}

**Communication Guidelines:**
- Always use "we" when referring to our work together ("we implemented", "we will try", "we observed", "we succeeded", "we agree", "we made a mistake")
- Execute code ONLY when calculations, demonstrations, or verification are actually needed
- For simple questions, conversations, or general knowledge - respond directly without code execution
- Use proper error handling and provide helpful explanations
- Keep responses focused and practical

**IMPORTANT CODE EXECUTION RULES:**
${finalAskOptions.terminal ? '- When you need to execute terminal commands, you MUST use the exact format: > 😈<uuid>/do/terminal/bash followed by ```bash' : ''}
${finalAskOptions.exec ? '- When you need to execute JavaScript, you MUST use the exact format: > 😈<uuid>/do/exec/js followed by ```js' : ''}
${finalAskOptions.execTs ? '- When you need to execute TypeScript, you MUST use the exact format: > 😈<uuid>/do/exec/tsx followed by ```tsx' : ''}
- NEVER use \`\`\`terminal - always use \`\`\`bash for terminal commands
- Always generate a unique UUID for each operation
- Only execute code when it's actually necessary to answer the question

**Important:** Don't separate yourself from the user - we are working together as a team. Only execute code when it's actually necessary to answer the question.`;

    // Use provided system prompt or default
    const finalSystemPrompt = systemPrompt || defaultSystemPrompt;

    // Set default AI options
    const defaultOptions = {
      model: 'google/gemini-2.5-flash-preview',
      temperature: 0.1,
      max_tokens: 2048
    };
    
    const finalOptions = { ...defaultOptions, ...options };

    super(token, context, finalOptions, finalSystemPrompt);

    this.askOptions = finalAskOptions;
    this.outputHandlers = outputHandlers;
    this.context = contextParts.join('\n\n');
    
    // Initialize engines based on options
    this.engines = {};
    if (finalAskOptions.exec) {
      this.engines.exec = execDo;
    }
    if (finalAskOptions.execTs) {
      this.engines.execTs = execTsDo;
    }
    if (finalAskOptions.terminal) {
      this.engines.terminal = terminalDo;
    }

    // Setup progress callbacks with overridable handlers
    this._onThinking = () => {
      if (this.outputHandlers.onThinking) {
        this.outputHandlers.onThinking();
      } else if (this.isReplMode) {
        this.defaultOutput('🧠 AI думает...');
      }
    };

    this._onCodeFound = async (code: string, format: 'js' | 'tsx' | 'terminal') => {
      if (this.outputHandlers.onCodeFound) {
        await this.outputHandlers.onCodeFound(code, format);
      } else if (this.isReplMode) {
        this.defaultOutput(`📋 Найден ${format.toUpperCase()} код для выполнения:`);
        const displayFormat = format === 'terminal' ? 'bash' : format;
        await printMarkdown(`\`\`\`${displayFormat}\n${code}\n\`\`\``);
      }
    };

    this._onCodeExecuting = (code: string, format: 'js' | 'tsx' | 'terminal') => {
      if (this.outputHandlers.onCodeExecuting) {
        this.outputHandlers.onCodeExecuting(code, format);
      } else if (this.isReplMode) {
        this.defaultOutput(`⚡ Выполняется ${format.toUpperCase()} код...`);
      }
    };

    this._onCodeResult = async (result: string) => {
      if (this.outputHandlers.onCodeResult) {
        await this.outputHandlers.onCodeResult(result);
      } else if (this.isReplMode) {
        this.defaultOutput(`✅ Результат выполнения:`);
        await printMarkdown(`\`\`\`\n${result}\n\`\`\``);
      }
    };

    this._onResponse = (response: string) => {
      if (this.outputHandlers.onResponse) {
        this.outputHandlers.onResponse(response);
      } else if (this.isReplMode) {
        this.defaultOutput(`💭 AI ответил (${response.length} символов)`);
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
          if (!this.askOptions.exec || !this.engines.exec) {
            throw new Error('JavaScript execution is disabled');
          }
          // Update exec context with current AI results
          this.engines.exec.updateContext({ 
            ...this.engines.exec.getContext(), 
            results: this.results 
          });
          result = await this.engines.exec.exec(doItem.request);
        } else if (doItem.operation.startsWith('do/exec/tsx')) {
          if (!this.askOptions.execTs || !this.engines.execTs) {
            throw new Error('TypeScript execution is disabled');
          }
          // Update execTs context with current AI results
          this.engines.execTs.updateContext({ 
            ...this.engines.execTs.getContext(), 
            results: this.results 
          });
          result = await this.engines.execTs.exec(doItem.request);
        } else if (doItem.operation.startsWith('do/terminal/')) {
          if (!this.askOptions.terminal || !this.engines.terminal) {
            throw new Error('Terminal execution is disabled');
          }
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

  // Default output handler - can be overridden
  protected defaultOutput(message: string): void {
    if (this.outputHandlers.onOutput) {
      this.outputHandlers.onOutput(message);
    } else {
      console.log(message);
    }
  }

  // Default error handler - can be overridden  
  protected defaultError(error: string): void {
    if (this.outputHandlers.onError) {
      this.outputHandlers.onError(error);
    } else {
      console.error(error);
    }
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
              this.defaultOutput('🧠 AI думает...');
              break;
              
            case 'iteration':
              if (event.data.iteration > 1) {
                this.defaultOutput(`🔄 Итерация ${event.data.iteration}: ${event.data.reason}`);
              }
              break;
              
            case 'text':
              // For non-REPL mode, we can buffer text for markdown rendering
              accumulatedText += event.data.delta;
              break;
              
            case 'code_found':
              this.defaultOutput(`📋 Найден ${event.data.format.toUpperCase()} код для выполнения:`);
              const displayFormat = event.data.format === 'terminal' ? 'bash' : event.data.format;
              this.defaultOutput(`\`\`\`${displayFormat}`);
              this.defaultOutput(event.data.code);
              this.defaultOutput('```');
              break;
              
            case 'code_executing':
              this.defaultOutput(`⚡ Выполняется ${event.data.format.toUpperCase()} код...`);
              break;
              
            case 'code_result':
              const status = event.data.success ? '✅' : '❌';
              this.defaultOutput(`${status} Результат выполнения:`);
              this.defaultOutput('```');
              this.defaultOutput(event.data.result);
              this.defaultOutput('```');
              break;
              
            case 'complete':
              finalResponse = event.data.finalResponse;
              this.defaultOutput(`💭 Завершено (${event.data.iterations} итераций)`);
              break;
              
            case 'error':
              this.defaultError(`❌ Ошибка в итерации ${event.data.iteration}: ${event.data.error.message}`);
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
    this.isReplMode = true;
    
    // Build enabled engines list for welcome message
    const enabledEngines: string[] = [];
    if (this.askOptions.exec) enabledEngines.push('JavaScript');
    if (this.askOptions.execTs) enabledEngines.push('TypeScript');
    if (this.askOptions.terminal) enabledEngines.push('Terminal');

    // Use output handler for welcome or default console output
    if (this.outputHandlers.onWelcome) {
      await this.outputHandlers.onWelcome(enabledEngines);
    } else {
      this.defaultOutput('🤖 Ask AI anything. Type your question and press Enter. Use Ctrl+C to exit.');
      this.defaultOutput('💡 Responses with code, formatting, or markdown will be beautifully rendered!');
      if (enabledEngines.length > 0) {
        this.defaultOutput(`😈 AI can execute code automatically! Enabled engines: ${enabledEngines.join(', ')}`);
      }
    }

    try {
      if (this._do) {
        // Code execution is available - this is handled in welcome message above
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
                  this.defaultOutput('🧠 AI думает...');
                  break;
                  
                case 'iteration':
                  if (event.data.iteration > 1) {
                    this.defaultOutput(`🔄 Итерация ${event.data.iteration}: ${event.data.reason}`);
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
                    this.defaultOutput('');
                  }
                  this.defaultOutput(`📋 Найден ${event.data.format.toUpperCase()} код для выполнения:`);
                  const displayFormat = event.data.format === 'terminal' ? 'bash' : event.data.format;
                  this.defaultOutput(`\`\`\`${displayFormat}`);
                  this.defaultOutput(event.data.code);
                  this.defaultOutput('```');
                  responseBuffer = ''; // Reset buffer after code block
                  break;
                  
                case 'code_executing':
                  this.defaultOutput(`⚡ Выполняется ${event.data.format.toUpperCase()} код...`);
                  break;
                  
                case 'code_result':
                  const status = event.data.success ? '✅' : '❌';
                  this.defaultOutput(`${status} Результат выполнения:`);
                  this.defaultOutput('```');
                  this.defaultOutput(event.data.result);
                  this.defaultOutput('```');
                  break;
                  
                case 'complete':
                  // Ensure we end with a newline
                  if (responseBuffer && !responseBuffer.endsWith('\n')) {
                    this.defaultOutput('');
                  }
                  this.defaultOutput(`💭 Завершено (${event.data.iterations} итераций)`);
                  break;
                  
                case 'error':
                  this.defaultError(`❌ Ошибка в итерации ${event.data.iteration}: ${event.data.error.message}`);
                  break;
              }
            },
            complete: () => {
              this.defaultOutput('');
              rl.prompt();
            },
            error: (error) => {
              this.defaultError(`❌ Ошибка стриминга: ${error.message}`);
              rl.prompt();
            }
          });
          
        } catch (error) {
          debug('Error in streaming REPL:', error);
          this.defaultError(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
          rl.prompt();
        }
      });

      rl.on('close', () => {
        debug('REPL closed');
        if (this.outputHandlers.onGoodbye) {
          this.outputHandlers.onGoodbye();
        } else {
          this.defaultOutput('\n👋 Goodbye!');
        }
        process.exit(0);
      });

      rl.on('SIGINT', () => {
        debug('SIGINT received in REPL');
        if (this.outputHandlers.onGoodbye) {
          this.outputHandlers.onGoodbye();
        } else {
          this.defaultOutput('\n👋 Goodbye!');
        }
        process.exit(0);
      });
    } finally {
      this.isReplMode = false; // Disable progress callbacks when exiting REPL
    }
  }
}

/**
 * Ensures OPENROUTER_API_KEY is available, setting it up interactively if needed
 */
export async function ensureOpenRouterApiKey(outputHandler?: (message: string) => void) {
  const output = outputHandler || console.log;
  const error = outputHandler ? outputHandler : console.error;
  
  if (!process?.env?.OPENROUTER_API_KEY) {
    output('🔑 OpenRouter API Key not found. Let\'s set it up...');
    
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
          error('❌ OPENROUTER_API_KEY is still not available. Please check your .env file.');
          process.exit(1);
        }
        
        output('✅ OpenRouter API Key configured successfully!');
        
      } finally {
        rl.close();
      }
    } catch (err) {
      error(`❌ Failed to configure OpenRouter API Key: ${err}`);
      process.exit(1);
    }
  }
} 