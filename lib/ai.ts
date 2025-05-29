import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { OpenRouter, OpenRouterMessage, OpenRouterOptions } from './openrouter';
import { printMarkdown } from './markdown-terminal';
import Debug from './debug';

const debug = Debug('hasyx:ai');

export interface Do extends OpenRouterMessage {
  id: string;
  operation: string;
  format: 'js' | 'tsx' | 'terminal';
  request: string;
  response?: string;
  startLine: number;
  endLine: number;
}

export interface ProjectInfo {
  name: string;
  version?: string;
  description?: string;
  features?: string[];
}

export class AI {
  private openRouter: OpenRouter;
  
  public doSpecialSubstring = `> 🪬`;
  public memory: (OpenRouterMessage | Do)[] = [];
  public systemPrompt?: string;
  
  // Callbacks for external handling
  public _onMemory?: (message: OpenRouterMessage | Do) => void;
  public _do?: (doItem: Do) => Promise<Do>;
  public _onThinking?: () => void;
  public _onCodeFound?: (code: string, format: 'js' | 'tsx' | 'terminal') => void | Promise<void>;
  public _onCodeExecuting?: (code: string, format: 'js' | 'tsx' | 'terminal') => void;
  public _onCodeResult?: (result: string) => void | Promise<void>;
  public _onResponse?: (response: string) => void;

  constructor(
    token: string,
    context: any = {},
    options: OpenRouterOptions = {},
    systemPrompt?: string
  ) {
    this.openRouter = new OpenRouter(token, context, options);
    this.systemPrompt = systemPrompt;
    
    debug('AI instance created');
  }

  /**
   * Interactive REPL mode for terminal interaction
   */
  async repl(): Promise<void> {
    console.log('🤖 Ask AI anything. Type your question and press Enter. Use Ctrl+C to exit.');
    console.log('💡 Responses with code, formatting, or markdown will be beautifully rendered!');
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

      debug('Processing REPL question:', question);
      try {
        const response = await this.ask(question);
        
        // Always use markdown formatting for beautiful output
        await printMarkdown(response);
      } catch (error) {
        debug('Error in REPL:', error);
        console.error('❌ Error:', error instanceof Error ? error.message : String(error));
      }
      
      rl.prompt();
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
  }

  /**
   * Check if text contains markdown formatting
   */
  private hasMarkdownFormatting(text: string): boolean {
    const markdownPatterns = [
      /```[\s\S]*?```/,           // Code blocks
      /`[^`]+`/,                  // Inline code
      /^#{1,6}\s/m,               // Headers
      /\*\*[^*]+\*\*/,            // Bold
      /\*[^*]+\*/,                // Italic
      /\[[^\]]+\]\([^)]+\)/,      // Links
      /^\s*[-*+]\s/m,             // Lists
      /^\s*\d+\.\s/m,             // Numbered lists
      /^>\s/m,                    // Blockquotes
      /^\s*\|.*\|/m               // Tables
    ];
    
    return markdownPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Ask AI a question and get a response
   */
  async ask(question: string | OpenRouterMessage | OpenRouterMessage[]): Promise<string> {
    debug('Processing ask request');
    
    // Normalize input to messages array
    let messages: OpenRouterMessage[];
    if (typeof question === 'string') {
      messages = [{ role: 'user', content: question }];
    } else if (Array.isArray(question)) {
      messages = question;
    } else {
      messages = [question];
    }

    // Add to memory
    messages.forEach(msg => this.addToMemory(msg));

    let finalResponse = '';
    let allExecutionResults: string[] = [];
    let iterationCount = 0;
    const maxIterations = 3;

    while (iterationCount < maxIterations) {
      iterationCount++;
      
      try {
        // Make request to OpenRouter
        debug(`AI iteration ${iterationCount}/${maxIterations}`);
        
        // Notify that AI is thinking
        if (this._onThinking) {
          this._onThinking();
        }
        
        // Get context with memory
        const contextMessages = this.contextMemory(messages);
        
        const response = await this.openRouter.ask(contextMessages);
        debug(`AI response received (length: ${response.length})`);
        
        // Notify about response
        if (this._onResponse) {
          this._onResponse(response);
        }
        
        // Find and process Do operations
        const dos = this.findDos(response);
        debug(`Found ${dos.length} Do operations`);
        
        if (dos.length > 0) {
          // Execute all Do operations and collect results
          const executionResults: string[] = [];
          
          for (const doItem of dos) {
            debug(`Executing Do operation: ${doItem.id}`);
            const executedDo = await this.do(doItem);
            this.addToMemory(executedDo);
            
            // Format execution result for display
            if (executedDo.response) {
              // Determine the best language for the result display
              let resultLanguage = 'text';
              let codeLanguage: string = doItem.format;
              
              // Use 'bash' instead of 'terminal' for better display
              if (doItem.format === 'terminal') {
                codeLanguage = 'bash';
                resultLanguage = 'text'; // Terminal output is usually plain text
              } else if (doItem.format === 'js' || doItem.format === 'tsx') {
                // For JS/TS, try to detect if result looks like JSON
                try {
                  JSON.parse(executedDo.response);
                  resultLanguage = 'json';
                } catch {
                  // Check if it's a simple number, boolean, or text
                  if (/^\d+(\.\d+)?$/.test(executedDo.response.trim())) {
                    resultLanguage = 'javascript';
                  } else if (/^(true|false)$/.test(executedDo.response.trim())) {
                    resultLanguage = 'javascript';
                  } else {
                    resultLanguage = 'text';
                  }
                }
              }

              const resultDisplay = `
**Code Executed:**
\`\`\`${codeLanguage}
${doItem.request}
\`\`\`

**Result:**
\`\`\`${resultLanguage}
${executedDo.response}
\`\`\``;
              executionResults.push(resultDisplay);
              allExecutionResults.push(resultDisplay);
            }
          }

          // Remove Do operations from response
          const cleanResponse = this.removeDo(response, dos);
          
          // Add clean response to final response
          if (finalResponse) {
            finalResponse += '\n\n' + cleanResponse;
          } else {
            finalResponse = cleanResponse;
          }
          
          // Add execution results to final response
          if (executionResults.length > 0) {
            finalResponse += '\n\n' + executionResults.join('\n\n');
          }
          
          debug(`Clean response length: ${cleanResponse.length}`);
          debug(`Final response with execution results length: ${finalResponse.length}`);
          
          // Create assistant message with clean response (without execution results)
          const assistantMessage: OpenRouterMessage = {
            role: 'assistant',
            content: cleanResponse
          };
          this.addToMemory(assistantMessage);
          
          // Only continue if we haven't reached max iterations
          debug(`Iteration check: ${iterationCount} < ${maxIterations} = ${iterationCount < maxIterations}`);
          if (iterationCount < maxIterations) {
            // Add a follow-up message to continue the conversation
            const followUpMessage: OpenRouterMessage = {
              role: 'user',
              content: 'Continue your response based on the execution results. You can execute more code if needed, but try to provide a complete answer.'
            };
            messages = [followUpMessage];
            debug(`Continuing to iteration ${iterationCount + 1}`);
            // Continue the loop - don't break here
          } else {
            debug('Reached max iterations, stopping');
            break;
          }
        } else {
          // No Do operations found, this is the final response
          if (finalResponse) {
            finalResponse += '\n\n' + response;
          } else {
            finalResponse = response;
          }
          
          // Create assistant message
          const assistantMessage: OpenRouterMessage = {
            role: 'assistant',
            content: response
          };
          this.addToMemory(assistantMessage);
          
          debug('No Do operations found, ending iterations');
          break;
        }
      } catch (error) {
        debug('Error during AI iteration:', error);
        if (finalResponse) {
          // Return what we have so far
          break;
        } else {
          throw error;
        }
      }
    }

    debug('AI ask completed, final response length:', finalResponse.length);
    return finalResponse;
  }

  /**
   * Stream AI responses (returns Observable)
   */
  asking(question: string | OpenRouterMessage | OpenRouterMessage[]): Observable<string> {
    return new Observable<string>(observer => {
      this.ask(question)
        .then(response => {
          observer.next(response);
          observer.complete();
        })
        .catch(error => {
          observer.error(error);
        });
    });
  }

  /**
   * Generate Do object from message part
   */
  generateDo(messagePart: string): Do {
    const lines = messagePart.split('\n');
    const firstLine = lines[0];
    
    debug('Parsing Do operation from message part:', messagePart);
    
    // Extract operation and ID from first line
    // Format: > 🪬<uuid>/do/exec/js or > 🪬<uuid>/do/exec/tsx or > 🪬<uuid>/do/terminal/cmd
    const execMatch = firstLine.match(/> 🪬([^/]+)\/do\/exec\/(js|tsx)/);
    const terminalMatch = firstLine.match(/> 🪬([^/]+)\/do\/terminal\/(cmd|bash|zsh|sh)/);
    
    let id: string, format: 'js' | 'tsx' | 'terminal', operation: string;
    
    if (execMatch) {
      id = execMatch[1];
      format = execMatch[2] as 'js' | 'tsx';
      operation = `do/exec/${format}`;
    } else if (terminalMatch) {
      id = terminalMatch[1];
      format = 'terminal';
      operation = `do/terminal/${terminalMatch[2]}`;
    } else {
      debug('No standard Do format found, checking for terminal code block...');
      // Check if this is a terminal code block without proper header
      if (messagePart.includes('```terminal\n') || messagePart.includes('```bash\n') || messagePart.includes('```sh\n')) {
        id = `terminal_${Date.now()}`;
        format = 'terminal';
        operation = 'do/terminal/bash';
        debug('Found terminal code block without proper header, treating as terminal command');
      } else {
        throw new Error('Invalid Do format');
      }
    }

    // Extract code from code block
    const codeBlockStart = messagePart.indexOf('```');
    const codeBlockEnd = messagePart.lastIndexOf('```');
    
    if (codeBlockStart === -1 || codeBlockEnd === -1 || codeBlockStart === codeBlockEnd) {
      throw new Error('Invalid code block format');
    }

    const codeBlock = messagePart.substring(codeBlockStart, codeBlockEnd + 3);
    const codeLines = codeBlock.split('\n');
    const code = codeLines.slice(1, -1).join('\n'); // Remove ``` lines

    debug('Extracted code:', code);

    return {
      role: 'tool',
      content: messagePart,
      id,
      operation,
      format,
      request: code,
      startLine: 0, // Will be calculated when finding in full message
      endLine: 0    // Will be calculated when finding in full message
    };
  }

  /**
   * Find all Do operations in a message
   */
  findDos(message: string): Do[] {
    const dos: Do[] = [];
    const lines = message.split('\n');
    
    debug('Finding Do operations in message:', message);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for standard Do format
      if (line.startsWith(this.doSpecialSubstring)) {
        // Find the end of this Do operation (next ``` after the opening ```)
        let startLine = i;
        let codeBlockStart = -1;
        let codeBlockEnd = -1;
        
        // Find opening ```
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].startsWith('```')) {
            codeBlockStart = j;
            break;
          }
        }
        
        // Find closing ```
        if (codeBlockStart !== -1) {
          for (let j = codeBlockStart + 1; j < lines.length; j++) {
            if (lines[j] === '```') {
              codeBlockEnd = j;
              break;
            }
          }
        }
        
        if (codeBlockStart !== -1 && codeBlockEnd !== -1) {
          const endLine = codeBlockEnd;
          const messagePart = lines.slice(startLine, endLine + 1).join('\n');
          
          try {
            const doItem = this.generateDo(messagePart);
            doItem.startLine = startLine;
            doItem.endLine = endLine;
            dos.push(doItem);
            
            // Skip processed lines
            i = endLine;
          } catch (error) {
            debug('Error parsing Do operation:', error);
          }
        }
      } 
      // Also check for standalone terminal code blocks
      else if (line.startsWith('```terminal') || line.startsWith('```bash') || line.startsWith('```sh')) {
        let startLine = i;
        let codeBlockEnd = -1;
        
        // Find closing ```
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j] === '```') {
            codeBlockEnd = j;
            break;
          }
        }
        
        if (codeBlockEnd !== -1) {
          const endLine = codeBlockEnd;
          const messagePart = lines.slice(startLine, endLine + 1).join('\n');
          
          try {
            const doItem = this.generateDo(messagePart);
            doItem.startLine = startLine;
            doItem.endLine = endLine;
            dos.push(doItem);
            debug('Found standalone terminal code block:', doItem);
            
            // Skip processed lines
            i = endLine;
          } catch (error) {
            debug('Error parsing terminal code block:', error);
          }
        }
      }
    }
    
    debug(`Found ${dos.length} Do operations total`);
    return dos;
  }

  /**
   * Remove Do operations from message
   */
  removeDo(message: string, dos: Do[]): string {
    if (dos.length === 0) return message;
    
    const lines = message.split('\n');
    const linesToRemove = new Set<number>();
    
    dos.forEach(doItem => {
      for (let i = doItem.startLine; i <= doItem.endLine; i++) {
        linesToRemove.add(i);
      }
    });
    
    const filteredLines = lines.filter((_, index) => !linesToRemove.has(index));
    return filteredLines.join('\n').trim();
  }

  /**
   * Execute a Do operation (delegates to external handler)
   */
  async do(doItem: Do): Promise<Do> {
    debug(`Executing Do operation: ${doItem.id}`);
    
    // Notify that code was found
    if (this._onCodeFound) {
      await this._onCodeFound(doItem.request, doItem.format);
    }
    
    if (this._do) {
      // Use custom handler if provided
      debug(`Using custom _do handler for: ${doItem.id}`);
      return await this._do(doItem);
    }
    
    // Default behavior if no handler is provided
    debug(`No _do handler provided for: ${doItem.id}`);
    doItem.response = 'Code execution not available - no handler configured';
    
    return doItem;
  }

  /**
   * Add message to memory and call onMemory callback if set
   */
  private addToMemory(message: OpenRouterMessage | Do): void {
    this.memory.push(message);
    if (this._onMemory) {
      this._onMemory(message);
    }
    debug('Added to memory:', message.role, message.content?.substring(0, 100));
  }

  /**
   * Generate context messages with memory
   */
  contextMemory(yourMessages: OpenRouterMessage[]): OpenRouterMessage[] {
    // Add system message if provided
    const allMessages: OpenRouterMessage[] = [];
    
    if (this.systemPrompt) {
      allMessages.push({
        role: 'system',
        content: this.systemPrompt
      });
    }
    
    // Add relevant memory (limit to prevent context overflow)
    const recentMemory = this.memory.slice(-10); // Last 10 messages
    recentMemory.forEach(item => {
      if ('role' in item) {
        // Handle Do objects specially to include execution results
        if ('operation' in item && 'response' in item && item.response) {
          // This is a Do object with execution results - send as user message
          allMessages.push({
            role: 'user',
            content: `Execution result from previous code:\nCode: ${item.request}\nResult: ${item.response}\n\nPlease continue your response based on this result.`
          });
        } else {
          // Regular message
          allMessages.push({
            role: item.role,
            content: item.content || ''
          });
        }
      }
    });
    
    // Add current messages
    allMessages.push(...yourMessages);
    
    return allMessages;
  }

  /**
   * Clear memory
   */
  clearMemory(): void {
    this.memory = [];
    debug('Memory cleared');
  }

  /**
   * Get memory
   */
  getMemory(): (OpenRouterMessage | Do)[] {
    return [...this.memory];
  }

  /**
   * Set system prompt
   */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
    debug('System prompt updated');
  }

  /**
   * Get project information from package.json
   */
  getProjectInfo(): ProjectInfo {
    try {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        return {
          name: packageJson.name || 'Unknown Project',
          version: packageJson.version,
          description: packageJson.description,
          features: []
        };
      }
    } catch (error) {
      debug('Error reading package.json:', error);
    }
    
    return {
      name: 'Unknown Project',
      features: []
    };
  }

  /**
   * Get recommended context for code execution
   */
  getRecommendedContext(): any {
    const project = this.getProjectInfo();
    
    return {
      // Project information
      PROJECT_NAME: project.name,
      PROJECT_VERSION: project.version,
      PROJECT_DESCRIPTION: project.description,
      
      // Environment information
      NODE_ENV: process.env.NODE_ENV || 'development',
      PLATFORM: process.platform,
      ARCH: process.arch,
      
      // Utility functions
      log: (...args: any[]) => console.log(...args),
      debug: (...args: any[]) => debug(...args),
      
      // Common utilities
      sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
      timestamp: () => new Date().toISOString(),
      uuid: () => {
        // Simple UUID v4 generator
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      }
    };
  }
} 