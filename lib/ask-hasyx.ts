#!/usr/bin/env node

import dotenv from 'dotenv';
import path from 'path';
import readline from 'readline';
import Debug from 'hasyx/lib/debug';

// Load environment variables from .env file in current working directory
// This ensures that when using npx hasyx from a child project,
// the .env is loaded from the user's current directory, not from hasyx package directory
dotenv.config({ path: path.join(process.cwd(), '.env') });

import { AI, AIOptions } from 'hasyx/lib/ai';
import { printMarkdown } from 'hasyx/lib/markdown-terminal';
import { execDo, execContext, ExecResult } from 'hasyx/lib/exec';
import { execTsDo, execTsContext } from 'hasyx/lib/exec-tsx';
import { terminalDo, terminalContext } from 'hasyx/lib/terminal';

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

export interface AskHasyxOptions extends AIOptions {
  askOptions?: AskOptions;
  outputHandlers?: OutputHandlers;
}

export class AskHasyx extends AI {
  public askOptions: AskOptions;
  public outputHandlers: OutputHandlers;
  private isReplMode: boolean = false;
  public context: string;
  public engines: {
    exec?: typeof execDo;
    execTs?: typeof execTsDo;
    terminal?: typeof terminalDo;
  };

  constructor(options: AskHasyxOptions) {
    const { askOptions = {}, outputHandlers = {}, ...aiOptions } = options;

    const defaultAskOptions: AskOptions = { exec: true, execTs: true, terminal: true };
    const finalAskOptions = { ...defaultAskOptions, ...askOptions };

    const contextParts: string[] = [];
    if (finalAskOptions.exec) contextParts.push(execContext);
    if (finalAskOptions.execTs) contextParts.push(execTsContext);
    if (finalAskOptions.terminal) contextParts.push(terminalContext);

    // Enhanced system prompt with code execution instructions
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
    
    const finalSystemPrompt = aiOptions.systemPrompt || defaultSystemPrompt;

    // Create proper AIOptions for the new AI constructor
    const finalAiOptions: AIOptions = {
      provider: aiOptions.provider!, // Provider is required now
      systemPrompt: finalSystemPrompt,
      onResponse: aiOptions.onResponse,
      onStream: aiOptions.onStream,
      onStreamEnd: aiOptions.onStreamEnd
    };
    
    super(finalAiOptions);

    this.askOptions = finalAskOptions;
    this.outputHandlers = outputHandlers;
    this.context = contextParts.join('\n\n');
    
    this.engines = {};
    if (this.askOptions.exec) this.engines.exec = execDo;
    if (this.askOptions.execTs) this.engines.execTs = execTsDo;
    if (this.askOptions.terminal) this.engines.terminal = terminalDo;
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
   * Parse and execute code blocks in AI response
   */
  private async executeCodeBlocks(response: string): Promise<string> {
    debug('Executing code blocks in response:', response.substring(0, 200) + '...');
    
    // Regex to match code execution patterns like: > 😈uuid/do/exec/js
    const codeBlockRegex = />\s*😈([^/]+)\/do\/(exec|terminal)\/(js|tsx|bash)\s*\n```(?:js|tsx|bash)\s*([\s\S]*?)```/g;
    
    let processedResponse = response;
    let match;
    
    while ((match = codeBlockRegex.exec(response)) !== null) {
      const [fullMatch, uuid, operation, format, code] = match;
      debug('Found code block:', { uuid, operation, format, code: code.substring(0, 50) + '...' });
      
      try {
        if (this.outputHandlers.onCodeFound) {
          await this.outputHandlers.onCodeFound(code, format as 'js' | 'tsx' | 'terminal');
        } else if (this.isReplMode) {
          this.defaultOutput(`📋 Найден ${format.toUpperCase()} код для выполнения:`);
          const displayFormat = format === 'bash' ? 'bash' : format;
          await printMarkdown(`\`\`\`${displayFormat}\n${code}\n\`\`\``);
        }

        if (this.outputHandlers.onCodeExecuting) {
          this.outputHandlers.onCodeExecuting(code, format as 'js' | 'tsx' | 'terminal');
        } else if (this.isReplMode) {
          this.defaultOutput(`⚡ Выполняется ${format.toUpperCase()} код...`);
        }

        let execResult: ExecResult | any;
        let formattedResult: string;

        if (format === 'js' && this.askOptions.exec && this.engines.exec) {
          execResult = await this.engines.exec.exec(code);
          formattedResult = this.formatResult(execResult);
        } else if (format === 'tsx' && this.askOptions.execTs && this.engines.execTs) {
          execResult = await this.engines.execTs.exec(code);
          formattedResult = this.formatResult(execResult);
        } else if (format === 'bash' && this.askOptions.terminal && this.engines.terminal) {
          execResult = await this.engines.terminal.exec(code, 'bash');
          formattedResult = this.formatResult(execResult);
        } else {
          throw new Error(`${format} execution is disabled or not supported`);
        }

        if (this.outputHandlers.onCodeResult) {
          await this.outputHandlers.onCodeResult(formattedResult);
        } else if (this.isReplMode) {
          this.defaultOutput(`✅ Результат выполнения:`);
          await printMarkdown(`\`\`\`\n${formattedResult}\n\`\`\``);
        }

        // Replace the code block with execution result in the response
        processedResponse = processedResponse.replace(fullMatch, 
          `\`\`\`${format}\n${code}\n\`\`\`\n\n**Результат выполнения:**\n\`\`\`\n${formattedResult}\n\`\`\``
        );

      } catch (error) {
        const errorMessage = `Error: ${error instanceof Error ? error.message : String(error)}`;
        
        if (this.outputHandlers.onCodeResult) {
          await this.outputHandlers.onCodeResult(errorMessage);
        } else if (this.isReplMode) {
          this.defaultOutput(`❌ Ошибка выполнения:`);
          await printMarkdown(`\`\`\`\n${errorMessage}\n\`\`\``);
        }

        // Replace with error in the response
        processedResponse = processedResponse.replace(fullMatch, 
          `\`\`\`${format}\n${code}\n\`\`\`\n\n**Ошибка выполнения:**\n\`\`\`\n${errorMessage}\n\`\`\``
        );
      }
    }

    return processedResponse;
  }

  private formatResult(result: any): string {
    // Handle new { result, logs } format from exec/exec-tsx
    if (result && typeof result === 'object' && 'result' in result && 'logs' in result) {
      const execResult = result as ExecResult;
      const formattedResult = this.formatSingleResult(execResult.result);
      
      if (execResult.logs && execResult.logs.length > 0) {
        const formattedLogs = execResult.logs.map(log => 
          `[${log.level.toUpperCase()}] ${log.args.map(arg => this.formatSingleResult(arg, true)).join(' ')}`
        ).join('\n');
        return `Result:\n${formattedResult}\n\nLogs:\n${formattedLogs}`;
      }
      return formattedResult;
    }
    
    // Handle terminal results or other direct results
    return this.formatSingleResult(result);
  }

  private formatSingleResult(result: any, isLogArg: boolean = false): string {
    if (result === undefined) return 'undefined';
    if (result === null) return 'null';
    if (typeof result === 'string') return result;
    if (typeof result === 'number' || typeof result === 'boolean') return String(result);
    if (result instanceof Error) return `Error: ${result.message}`;
    if (typeof result === 'function') return `[Function: ${result.name || 'anonymous'}]`;
    if (typeof result === 'object') {
      try {
        // For log arguments, use more compact format. For main results, pretty print.
        return JSON.stringify(result, null, isLogArg ? 0 : 2);
      } catch {
        return String(result);
      }
    }
    return String(result);
  }

  /**
   * Ask a question with beautiful streaming output and code execution (for non-REPL usage)
   */
  async askWithBeautifulOutput(question: string): Promise<string> {
    debug('Processing question with beautiful output:', question);
    
    try {
      // Get AI response
      let response = await this.ask(question);
      
      // Execute code blocks in response
      const processedResponse = await this.executeCodeBlocks(response);
      
      // Check if any code was executed (results added to response)
      const hasExecutionResults = processedResponse.includes('**Результат выполнения:**') || processedResponse.includes('**Ошибка выполнения:**');
      
      let finalResponse = processedResponse;
      
      // If code was executed, send results back to AI for analysis (up to 3 iterations)
      if (hasExecutionResults) {
        debug('Code execution results detected, sending back to AI for analysis');
        
        for (let iteration = 0; iteration < 3; iteration++) {
          try {
            // Send the results back to AI for analysis
            const analysisResponse = await this.ask(`Проанализируй результаты выполнения кода выше и ответь пользователю:\n\n${finalResponse}`);
            
            // Execute any new code blocks in the analysis
            const analysisProcessed = await this.executeCodeBlocks(analysisResponse);
            
            // If AI provided additional analysis, append it
            if (analysisResponse.trim() && !analysisResponse.includes('```')) {
              finalResponse += '\n\n' + analysisProcessed;
              break; // AI provided text analysis, we're done
            } else if (analysisProcessed.includes('**Результат выполнения:**')) {
              // AI executed more code, continue iteration
              finalResponse = analysisProcessed;
              debug(`Code execution iteration ${iteration + 1} completed`);
            } else {
              break; // No more code to execute
            }
          } catch (iterationError) {
            debug(`Error in iteration ${iteration + 1}:`, iterationError);
            break; // Stop iterations on error
          }
        }
      }
      
      // Render final response as markdown for beautiful output
      await printMarkdown(finalResponse);
      
      return finalResponse;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.defaultError(`❌ Error: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Interactive REPL mode for terminal interaction
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

        debug('Processing REPL question:', question);
        
        try {
          this.defaultOutput('🧠 AI думает...');
          
          // Get AI response
          let response = await this.ask(question);
          
          // Execute code blocks in response
          let processedResponse = await this.executeCodeBlocks(response);
          
          // Check if any code was executed (results added to response)
          const hasExecutionResults = processedResponse.includes('**Результат выполнения:**') || processedResponse.includes('**Ошибка выполнения:**');
          
          let finalResponse = processedResponse;
          
          // If code was executed, send results back to AI for analysis (up to 3 iterations)
          if (hasExecutionResults) {
            debug('Code execution results detected in REPL, sending back to AI for analysis');
            
            for (let iteration = 0; iteration < 3; iteration++) {
              try {
                // Send the results back to AI for analysis
                const analysisResponse = await this.ask(`Проанализируй результаты выполнения кода выше и ответь пользователю:\n\n${finalResponse}`);
                
                // Execute any new code blocks in the analysis
                const analysisProcessed = await this.executeCodeBlocks(analysisResponse);
                
                // If AI provided additional analysis, append it
                if (analysisResponse.trim() && !analysisResponse.includes('```')) {
                  finalResponse += '\n\n' + analysisProcessed;
                  break; // AI provided text analysis, we're done
                } else if (analysisProcessed.includes('**Результат выполнения:**')) {
                  // AI executed more code, continue iteration
                  finalResponse = analysisProcessed;
                  debug(`REPL code execution iteration ${iteration + 1} completed`);
                } else {
                  break; // No more code to execute
                }
              } catch (iterationError) {
                debug(`Error in REPL iteration ${iteration + 1}:`, iterationError);
                break; // Stop iterations on error
              }
            }
          }
          
          // Print the final response
          await printMarkdown(finalResponse);
          
          this.defaultOutput('💭 Ответ завершен');
          rl.prompt();
          
        } catch (error) {
          debug('Error in REPL:', error);
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
      this.isReplMode = false;
    }
  }

  /**
   * Override askStream to support callback options
   */
  async askStream(
    message: string, 
    options: { 
      addToMemory?: boolean; 
      onStream?: (chunk: string) => void; 
      onStreamEnd?: () => void 
    } = { addToMemory: true }
  ): Promise<string> {
    // Use super.askStream for simple case
    if (!options.onStream && !options.onStreamEnd) {
      return await super.askStream(message, { addToMemory: options.addToMemory });
    }
    
    // For custom streaming callbacks, we need to manually handle the stream
    const userMessage = { role: 'user' as const, content: message };
    const messages = [...this.memory, userMessage];
    
    try {
      const stream = await (this as any).provider.askStream(messages);
      const reader = stream.getReader();
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        fullResponse += value;
        if (options.onStream) {
          options.onStream(value);
        }
      }

      if (options.onStreamEnd) {
        options.onStreamEnd();
      }

      if (options.addToMemory !== false) {
        this.memory.push(userMessage);
        this.memory.push({ role: 'assistant', content: fullResponse });
      }

      return fullResponse;
    } catch (error) {
      throw error;
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