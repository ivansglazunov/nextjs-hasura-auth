import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { OpenRouter, OpenRouterMessage, OpenRouterOptions } from './openrouter';
import Debug from './debug';

const debug = Debug('hasyx:ai');

export interface Do extends OpenRouterMessage {
  id: string;
  operation: string;
  format: 'js' | 'tsx';
  request: string;
  response?: string;
  startLine: number;
  endLine: number;
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
  public _onCodeFound?: (code: string, format: 'js' | 'tsx') => void;
  public _onCodeExecuting?: (code: string, format: 'js' | 'tsx') => void;
  public _onCodeResult?: (result: string) => void;
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
              const resultDisplay = `
**Code Executed:**
\`\`\`${doItem.format}
${doItem.request}
\`\`\`

**Result:**
\`\`\`
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
    
    // Extract operation and ID from first line
    // Format: > 🪬<uuid>/do/exec/js or > 🪬<uuid>/do/exec/tsx
    const match = firstLine.match(/> 🪬([^/]+)\/do\/exec\/(js|tsx)/);
    if (!match) {
      throw new Error('Invalid Do format');
    }

    const id = match[1];
    const format = match[2] as 'js' | 'tsx';
    const operation = `do/exec/${format}`;

    // Extract code from code block
    const codeBlockStart = messagePart.indexOf('```');
    const codeBlockEnd = messagePart.lastIndexOf('```');
    
    if (codeBlockStart === -1 || codeBlockEnd === -1 || codeBlockStart === codeBlockEnd) {
      throw new Error('Invalid code block format');
    }

    const codeBlock = messagePart.substring(codeBlockStart, codeBlockEnd + 3);
    const codeLines = codeBlock.split('\n');
    const code = codeLines.slice(1, -1).join('\n'); // Remove ``` lines

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
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
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
    }
    
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
      this._onCodeFound(doItem.request, doItem.format);
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
        allMessages.push({
          role: item.role,
          content: item.content || ''
        });
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
} 