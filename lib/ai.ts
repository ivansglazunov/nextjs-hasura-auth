import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { OpenRouter, OpenRouterMessage, OpenRouterOptions } from './openrouter';
import { printMarkdown } from './markdown-terminal';
import Debug from './debug';
import { filter, map } from 'rxjs/operators';

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

// Stream event types for asking method
export interface AIStreamEvent {
  type: 'thinking' | 'text' | 'code_found' | 'code_executing' | 'code_result' | 'iteration' | 'complete' | 'error';
  data?: any;
}

export interface AIThinkingEvent extends AIStreamEvent {
  type: 'thinking';
}

export interface AITextEvent extends AIStreamEvent {
  type: 'text';
  data: {
    content: string;
    delta: string;
    accumulated: string;
  };
}

export interface AICodeFoundEvent extends AIStreamEvent {
  type: 'code_found';
  data: {
    code: string;
    format: 'js' | 'tsx' | 'terminal';
    id: string;
  };
}

export interface AICodeExecutingEvent extends AIStreamEvent {
  type: 'code_executing';
  data: {
    code: string;
    format: 'js' | 'tsx' | 'terminal';
    id: string;
  };
}

export interface AICodeResultEvent extends AIStreamEvent {
  type: 'code_result';
  data: {
    id: string;
    result: string;
    success: boolean;
  };
}

export interface AIIterationEvent extends AIStreamEvent {
  type: 'iteration';
  data: {
    iteration: number;
    reason: string;
  };
}

export interface AICompleteEvent extends AIStreamEvent {
  type: 'complete';
  data: {
    finalResponse: string;
    iterations: number;
    executionResults: any[];
  };
}

export interface AIErrorEvent extends AIStreamEvent {
  type: 'error';
  data: {
    error: Error;
    iteration?: number;
  };
}

export type AIStreamEventUnion = 
  | AIThinkingEvent 
  | AITextEvent 
  | AICodeFoundEvent 
  | AICodeExecutingEvent 
  | AICodeResultEvent 
  | AIIterationEvent 
  | AICompleteEvent 
  | AIErrorEvent;

export interface AIOptions extends OpenRouterOptions {
  systemPrompt?: string;
  localMessageMemoryLimit?: number;
  maxIterations?: number;
}

export class AI {
  private openRouter: OpenRouter;
  
  public doSpecialSubstring = `> 😈`;
  public memory: (OpenRouterMessage | Do)[] = [];
  public systemPrompt?: string;
  private localMessageMemoryLimit: number;
  private maxIterations: number;
  
  // Results tracking for AI context
  public results: Record<string, any> = {};
  public executionHistory: Array<{ id: string; code: string; result: any; format: 'js' | 'tsx' | 'terminal'; timestamp: Date }> = [];
  
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
    options: AIOptions = {}
  ) {
    // Merge options with defaults
    const finalOptions: AIOptions = {
      localMessageMemoryLimit: 10,
      maxIterations: 5,
      ...options
    };
    
    this.openRouter = new OpenRouter(token, finalOptions);
    this.systemPrompt = finalOptions.systemPrompt;
    this.localMessageMemoryLimit = finalOptions.localMessageMemoryLimit!;
    this.maxIterations = finalOptions.maxIterations!;
    
    debug('AI instance created with options:', {
      localMessageMemoryLimit: this.localMessageMemoryLimit,
      maxIterations: this.maxIterations
    });
  }

  /**
   * Interactive REPL mode for terminal interaction
   */
  async repl(): Promise<void> {
    console.log('🤖 Ask AI anything. Type your question and press Enter. Use Ctrl+C to exit.');
    console.log('💡 Responses with code, formatting, or markdown will be beautifully rendered!');
    if (this._do) {
      console.log('😈 AI can execute code automatically!');
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
    const maxIterations = this.maxIterations;

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
          const executedDos: Do[] = [];
          
          for (const doItem of dos) {
            debug(`Executing Do operation: ${doItem.id}`);
            const executedDo = await this.do(doItem);
            executedDos.push(executedDo);
            this.addToMemory(executedDo);
          }
          
          // Remove Do operations from response for the assistant's message
          const cleanResponse = this.removeDo(response, dos);

          // Add clean response part to the memory
          if (cleanResponse.trim()) {
            const assistantMessage: OpenRouterMessage = {
              role: 'assistant',
              content: cleanResponse
            };
            this.addToMemory(assistantMessage);
          }

          // We executed code, so we need to loop again to let the AI process the results.
          // The results are now in memory, and contextMemory will add them to the next prompt.
          // No need to create an artificial "continue" message. The results themselves are the prompt.
          messages = []; // Next prompt will be built from memory
          debug(`Continuing to iteration ${iterationCount + 1} to process execution results.`);
        } else {
          // No Do operations found, this is the final response from this iteration
          finalResponse = response;
          
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
        // If we have a partial response, return it, otherwise rethrow.
        if (finalResponse) {
          break;
        } else {
          throw error;
        }
      }
    }

    if (iterationCount >= maxIterations) {
      debug('Reached max iterations, returning final response.');
    }
    
    // The final response is the last content from the assistant in memory
    const lastAssistantMessage = this.memory.filter(m => m.role === 'assistant').pop();
    return lastAssistantMessage?.content || finalResponse || '';
  }

  /**
   * Stream AI responses with real-time events (returns Observable)
   */
  asking(question: string | OpenRouterMessage | OpenRouterMessage[]): Observable<AIStreamEventUnion> {
    return new Observable<AIStreamEventUnion>(observer => {
      this.askWithStream(question, observer).catch(error => {
        observer.error(error);
      });
    });
  }

  /**
   * Internal method for streaming AI responses with real-time events
   */
  private async askWithStream(
    question: string | OpenRouterMessage | OpenRouterMessage[],
    observer: any
  ): Promise<void> {
    debug('Processing ask request with streaming');
    
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
    let allExecutionResults: any[] = [];
    let iterationCount = 0;
    const maxIterations = this.maxIterations;

    while (iterationCount < maxIterations) {
      iterationCount++;
      
      try {
        debug(`AI iteration ${iterationCount}/${maxIterations}`);
        
        // Emit thinking event
        observer.next({ type: 'thinking' } as AIThinkingEvent);
        
        // Emit iteration event
        observer.next({ 
          type: 'iteration', 
          data: { 
            iteration: iterationCount, 
            reason: iterationCount === 1 ? 'Initial response' : 'Continue after code execution' 
          } 
        } as AIIterationEvent);
        
        // Get context with memory
        const contextMessages = this.contextMemory(messages);
        
        // Get streaming response from OpenRouter
        const stream = await this.openRouter.askStream(contextMessages);
        const reader = stream.getReader();
        
        let streamedResponse = '';
        let accumulated = '';
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            accumulated += value;
            
            // Emit text event with delta
            observer.next({
              type: 'text',
              data: {
                content: value,
                delta: value,
                accumulated: accumulated
              }
            } as AITextEvent);
          }
          
          streamedResponse = accumulated;
        } finally {
          reader.releaseLock();
        }
        
        debug(`AI streamed response received (length: ${streamedResponse.length})`);
        
        // Find and process Do operations
        const dos = this.findDos(streamedResponse);
        debug(`Found ${dos.length} Do operations`);
        
        if (dos.length > 0) {
          const executedDos: Do[] = [];
          
          for (const doItem of dos) {
            debug(`Executing Do operation: ${doItem.id}`);
            
            // Emit code found event
            observer.next({
              type: 'code_found',
              data: {
                code: doItem.request,
                format: doItem.format,
                id: doItem.id
              }
            } as AICodeFoundEvent);
            
            // Emit code executing event
            observer.next({
              type: 'code_executing',
              data: {
                code: doItem.request,
                format: doItem.format,
                id: doItem.id
              }
            } as AICodeExecutingEvent);
            
            const executedDo = await this.do(doItem);
            executedDos.push(executedDo);
            this.addToMemory(executedDo);
            
            // Emit code result event
            observer.next({
              type: 'code_result',
              data: {
                id: executedDo.id,
                result: executedDo.response || '',
                success: !executedDo.response?.startsWith('Error:')
              }
            } as AICodeResultEvent);
            
            if (executedDo.response) {
              allExecutionResults.push({
                id: executedDo.id,
                code: executedDo.request,
                result: executedDo.response,
                format: executedDo.format
              });
            }
          }

          // Remove Do operations from response
          const cleanResponse = this.removeDo(streamedResponse, dos);
          
          // Add clean response to final response
          if (finalResponse) {
            finalResponse += '\n\n' + cleanResponse;
          } else {
            finalResponse = cleanResponse;
          }
          
          debug(`Clean response length: ${cleanResponse.length}`);
          
          // Create assistant message with clean response
          const assistantMessage: OpenRouterMessage = {
            role: 'assistant',
            content: cleanResponse
          };
          this.addToMemory(assistantMessage);
          
          // We executed code, loop again to process results.
          messages = []; // Next prompt will be built from memory
          debug(`Continuing to iteration ${iterationCount + 1}`);
        } else {
          // No Do operations found, this is the final response part
          finalResponse += streamedResponse;
          
          // Create assistant message
          const assistantMessage: OpenRouterMessage = {
            role: 'assistant',
            content: streamedResponse
          };
          this.addToMemory(assistantMessage);
          
          debug('No Do operations found, ending iterations');
          break;
        }
      } catch (error) {
        debug('Error during AI iteration:', error);
        observer.next({
          type: 'error',
          data: {
            error: error instanceof Error ? error : new Error(String(error)),
            iteration: iterationCount
          }
        } as AIErrorEvent);
        
        if (finalResponse) {
          // Return what we have so far
          break;
        } else {
          throw error;
        }
      }
    }

    // Emit completion event
    observer.next({
      type: 'complete',
      data: {
        finalResponse,
        iterations: iterationCount,
        executionResults: allExecutionResults
      }
    } as AICompleteEvent);
    
    observer.complete();
    debug('AI ask with streaming completed');
  }

  /**
   * Generate Do object from message part
   */
  generateDo(messagePart: string): Do {
    const lines = messagePart.split('\n');
    const firstLine = lines[0];
    
    debug('Parsing Do operation from message part:', messagePart);
    
    // Extract operation and ID from first line
    // Format: > 😈<uuid>/do/exec/js or > 😈<uuid>/do/exec/tsx or > 😈<uuid>/do/terminal/cmd
    const execMatch = firstLine.match(/> 😈([^/]+)\/do\/exec\/(js|tsx)/);
    const terminalMatch = firstLine.match(/> 😈([^/]+)\/do\/terminal\/(cmd|bash|zsh|sh)/);
    
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
      
      // Check for standard Do format (with or without indentation)
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith(this.doSpecialSubstring)) {
        // Detect indentation level
        const indentMatch = line.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1] : '';
        const indentLength = indent.length;
        
        debug(`Found Do operation with ${indentLength} spaces indent: "${line}"`);
        
        // Find the end of this Do operation (next ``` after the opening ```)
        let startLine = i;
        let codeBlockStart = -1;
        let codeBlockEnd = -1;
        
        // Find opening ``` (could also be indented)
        for (let j = i + 1; j < lines.length; j++) {
          const currentLine = lines[j];
          const currentTrimmed = currentLine.trim();
          if (currentTrimmed.startsWith('```')) {
            codeBlockStart = j;
            break;
          }
        }
        
        // Find closing ``` (could also be indented)
        if (codeBlockStart !== -1) {
          for (let j = codeBlockStart + 1; j < lines.length; j++) {
            const currentLine = lines[j];
            const currentTrimmed = currentLine.trim();
            if (currentTrimmed === '```') {
              codeBlockEnd = j;
              break;
            }
          }
        }
        
        if (codeBlockStart !== -1 && codeBlockEnd !== -1) {
          const endLine = codeBlockEnd;
          
          // Normalize indentation: remove the detected indent from all lines
          const normalizedLines = lines.slice(startLine, endLine + 1).map(line => {
            if (line.startsWith(indent)) {
              return line.substring(indentLength);
            }
            return line;
          });
          
          const messagePart = normalizedLines.join('\n');
          debug(`Normalized message part (removed ${indentLength} spaces): "${messagePart}"`);
          
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
      // Also check for standalone terminal code blocks (with or without indentation)
      else if (trimmedLine.startsWith('```terminal') || trimmedLine.startsWith('```bash') || trimmedLine.startsWith('```sh')) {
        // Detect indentation level
        const indentMatch = line.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1] : '';
        const indentLength = indent.length;
        
        debug(`Found terminal code block with ${indentLength} spaces indent: "${line}"`);
        
        let startLine = i;
        let codeBlockEnd = -1;
        
        // Find closing ``` (could also be indented)
        for (let j = i + 1; j < lines.length; j++) {
          const currentLine = lines[j];
          const currentTrimmed = currentLine.trim();
          if (currentTrimmed === '```') {
            codeBlockEnd = j;
            break;
          }
        }
        
        if (codeBlockEnd !== -1) {
          const endLine = codeBlockEnd;
          
          // Normalize indentation: remove the detected indent from all lines
          const normalizedLines = lines.slice(startLine, endLine + 1).map(line => {
            if (line.startsWith(indent)) {
              return line.substring(indentLength);
            }
            return line;
          });
          
          const messagePart = normalizedLines.join('\n');
          debug(`Normalized terminal code block (removed ${indentLength} spaces): "${messagePart}"`);
          
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
      const result = await this._do(doItem);
      
      // Track execution results and history
      if (result.response && !result.response.startsWith('Error:')) {
        // Try to parse the result for storage
        let parsedResult: any = result.response;
        try {
          // If it's valid JSON, parse it
          parsedResult = JSON.parse(result.response);
        } catch {
          // Keep as string if not JSON
          parsedResult = result.response;
        }
        
        // Store in results with doItem.id as key
        this.results[doItem.id] = parsedResult;
        
        // Add to execution history
        this.executionHistory.push({
          id: doItem.id,
          code: doItem.request,
          result: parsedResult,
          format: doItem.format,
          timestamp: new Date()
        });
        
        // Limit execution history to last 50 entries
        if (this.executionHistory.length > 50) {
          this.executionHistory = this.executionHistory.slice(-50);
        }
        
        debug(`Stored result for ${doItem.id}:`, parsedResult);
      }
      
      return result;
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
      // Build enhanced system prompt with results context
      let enhancedSystemPrompt = this.systemPrompt;
      
      // Add results context if there are any results
      if (Object.keys(this.results).length > 0 || this.executionHistory.length > 0) {
        enhancedSystemPrompt += '\n\n**🔄 AVAILABLE RESULTS CONTEXT:**\n\n';
        
        // Add current results state
        if (Object.keys(this.results).length > 0) {
          enhancedSystemPrompt += '**Current Results State:**\n';
          enhancedSystemPrompt += '```json\n';
          enhancedSystemPrompt += JSON.stringify(this.results, null, 2);
          enhancedSystemPrompt += '\n```\n\n';
        }
        
        // Add recent execution history (last 5 executions)
        if (this.executionHistory.length > 0) {
          const recentExecutions = this.executionHistory.slice(-5);
          enhancedSystemPrompt += '**Recent Execution History:**\n';
          recentExecutions.forEach((exec, index) => {
            enhancedSystemPrompt += `${index + 1}. **${exec.id}** (${exec.format}) - ${exec.timestamp.toISOString()}\n`;
            enhancedSystemPrompt += `   Code: \`${exec.code.substring(0, 100)}${exec.code.length > 100 ? '...' : ''}\`\n`;
            enhancedSystemPrompt += `   Result: \`${String(exec.result).substring(0, 100)}${String(exec.result).length > 100 ? '...' : ''}\`\n`;
          });
          enhancedSystemPrompt += '\n';
        }
        
        enhancedSystemPrompt += '**Important:** You can reference previous results using `results["key"]` in your code. Build upon previous computations and maintain state between executions.\n\n';
      }
      
      allMessages.push({
        role: 'system',
        content: enhancedSystemPrompt
      });
    }
    
    // Add relevant memory (limit to prevent context overflow)
    const recentMemory = this.memory.slice(-this.localMessageMemoryLimit); // Use configurable limit
    recentMemory.forEach(item => {
      if ('role' in item) {
        // Handle Do objects specially to include execution results
        if (item.role === 'tool' && 'operation' in item && 'response' in item && item.response) {
          // This is a Do object with execution results - send as tool result message
          allMessages.push({
            role: 'tool',
            content: `Execution result from ${item.id}:\n${item.response}`,
            tool_call_id: item.id, // This part is a bit of a hack without real tool_calls
          });
        } else if (item.role === 'user' || item.role === 'assistant') {
          // Regular message
          allMessages.push({
            role: item.role,
            content: item.content || ''
          });
        }
      }
    });
    
    // Add current messages, only if they are not already in memory from a previous failed iteration
    const newMessages = yourMessages.filter(ym => !this.memory.some(mem => 'content' in mem && mem.content === ym.content));
    allMessages.push(...newMessages);
    
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
   * Clear results and execution history
   */
  clearResults(): void {
    this.results = {};
    this.executionHistory = [];
    debug('Results and execution history cleared');
  }

  /**
   * Clear both memory and results
   */
  clearAll(): void {
    this.clearMemory();
    this.clearResults();
    debug('All memory and results cleared');
  }

  /**
   * Get current results state
   */
  getResults(): Record<string, any> {
    return { ...this.results };
  }

  /**
   * Get execution history
   */
  getExecutionHistory(): Array<{ id: string; code: string; result: any; format: 'js' | 'tsx' | 'terminal'; timestamp: Date }> {
    return [...this.executionHistory];
  }

  /**
   * Set a result manually (useful for external state)
   */
  setResult(key: string, value: any): void {
    this.results[key] = value;
    debug(`Set result for ${key}:`, value);
  }

  /**
   * Get a specific result
   */
  getResult(key: string): any {
    return this.results[key];
  }

  /**
   * Check if a result exists
   */
  hasResult(key: string): boolean {
    return key in this.results;
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
    this.openRouter.updateOptions({ systemPrompt: prompt });
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

  /**
   * Simple streaming method that returns just text deltas
   */
  askStream(question: string | OpenRouterMessage | OpenRouterMessage[]): Observable<string> {
    return this.asking(question).pipe(
      filter((event: AIStreamEventUnion): event is AITextEvent => event.type === 'text'),
      map((event: AITextEvent) => event.data.delta)
    );
  }

  /**
   * Get complete response via streaming (collects all text)
   */
  askWithStreaming(question: string | OpenRouterMessage | OpenRouterMessage[]): Observable<string> {
    return this.asking(question).pipe(
      filter((event: AIStreamEventUnion): event is AICompleteEvent => event.type === 'complete'),
      map((event: AICompleteEvent) => event.data.finalResponse)
    );
  }

  /**
   * Get just execution results from streaming
   */
  getExecutionResults(question: string | OpenRouterMessage | OpenRouterMessage[]): Observable<any[]> {
    return this.asking(question).pipe(
      filter((event: AIStreamEventUnion): event is AICompleteEvent => event.type === 'complete'),
      map((event: AICompleteEvent) => event.data.executionResults)
    );
  }
} 