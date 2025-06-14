import { AIMessage, AIProvider } from './ai';
import { Tool, ToolResult, FoundToolCall } from './tool';
import { Tooler } from './tooler';
import { parseThinkingBuffer } from './dialog-parser';
import Debug from '../debug';

const debug = Debug('dialog');

export type DialogEvent =
  | { type: 'ask', message: AIMessage }
  | { type: 'ai_request', messages: AIMessage[] }
  | { type: 'ai_chunk', chunk: string }
  | { type: 'ai_response', content: string }
  | { type: 'thought_chunk', chunk: string }
  | { type: 'thought', content: string }
  | { type: 'tool_call', id: string, name: string, command: string, content: string }
  | { type: 'tool_log', id: string, log: any }
  | { type: 'tool_result', id: string, result: any, error?: string }
  | { type: 'done' }
  | { type: 'error', error: string };

export interface DialogOptions {
  provider: AIProvider;
  tools?: Tool[];
  systemPrompt?: string;
  onChange?: (event: DialogEvent) => void;
  onError?: (error: any) => void;
  method?: 'stream' | 'query';
}

export class Dialog {
  private readonly provider: AIProvider;
  private readonly tooler?: Tooler;
  private readonly onChange: (event: DialogEvent) => void;
  private readonly onError?: (error: any) => void;
  private readonly method: 'stream' | 'query';
  private memory: AIMessage[] = [];
  private _toSend: AIMessage[] = [];
  private _promise: Promise<any> | null = null;
  private _stop: boolean = false;

  constructor(options: DialogOptions) {
    this.provider = options.provider;
    this.onChange = options.onChange || (() => { });
    this.onError = options.onError;
    this.method = options.method || 'stream';

    if (this.method !== 'stream' && this.method !== 'query') {
      throw new Error("Dialog option 'method' must be either 'stream' or 'query'.");
    }

    debug('Initializing Dialog with method: %s, systemPrompt length: %d and %d tools', this.method, options.systemPrompt?.length || 0, options.tools?.length || 0);

    let systemPrompt = options.systemPrompt || '';

    if (options.tools && options.tools.length > 0) {
      this.tooler = new Tooler({
        tools: options.tools,
        onHandle: (call: FoundToolCall) => this.emit({
          type: 'tool_call',
          id: call.id,
          name: call.tool.name,
          command: call.command,
          content: call.content
        }),
        onLog: (log) => this.emit({ type: 'tool_log', id: 'unknown', log }), // Needs context from tool call
        onHandled: (result: ToolResult) => this.handleToolResult(result)
      });
      systemPrompt += '\n\n' + this.tooler.getFullContextPreprompt();
    }

    if (systemPrompt) {
      debug('Final system prompt: "%s"', systemPrompt);
      this.memory.push({ role: 'system', content: systemPrompt });
    }
  }

  private emit(event: DialogEvent) {
    debug('Emitting event: %o', event);
    this.onChange(event);
    if (event.type === 'error' && this.onError) {
      this.onError(event.error);
    }
  }

  private handleToolResult(result: ToolResult) {
    debug('Handling tool result for id: %s', result.id);
    const resultAsString = result.error
      ? `Error: ${result.error}`
      : JSON.stringify(result.result, null, 2);

    this.emit({ type: 'tool_result', id: result.id, result: result.result, error: result.error });

    const resultMessage: AIMessage = {
      role: 'user',
      content: `Tool call with id \\"${result.id}"\\ has been executed. Here is the result in JSON format:\\n${resultAsString}`
    };

    this._toSend.push(resultMessage);
    this.scheduleSend();
  }

  ask(message: string | AIMessage): Promise<void> {
    let userMessage: AIMessage;

    if (typeof message === 'string') {
      userMessage = { role: 'user', content: message };
    } else if (message && typeof message.role === 'string' && typeof message.content === 'string') {
      userMessage = message;
    } else {
      const err = new Error('Invalid message format passed to ask(). Must be a string or an object with "role" and "content" properties.');
      debug('Error: %s, received: %o', err.message, message);
      this.emit({ type: 'error', error: err.message });
      throw err;
    }

    debug('ask called with content: "%s"', userMessage.content);
    this.emit({ type: 'ask', message: userMessage });
    this._toSend.push(userMessage);
    this.scheduleSend();
    return this._promise as Promise<void>;
  }

  private scheduleSend() {
    debug('Scheduling a send operation. Current promise chain active.');
    this._promise = this._promise || Promise.resolve();
    this._promise = this._promise.then(() => this.send()).catch(e => {
      const errorMessage = e instanceof Error ? e.message : String(e);
      this.emit({ type: 'error', error: errorMessage });
      console.error('Error in dialog send chain:', e);
      // Ensure promise chain continues
      return Promise.resolve();
    });
  }

  private async send() {
    if (this._stop || this._toSend.length === 0) {
      return;
    }

    const messagesToSend = [...this.memory, ...this._toSend];
    this.memory.push(...this._toSend);
    this._toSend = [];

    this.emit({ type: 'ai_request', messages: messagesToSend });
    debug('Sending %d messages to provider using method "%s". Full messages object: %o', messagesToSend.length, this.method, messagesToSend);

    let fullResponse: string;

    if (this.method === 'stream') {
      const stream = await this.provider.stream(messagesToSend);
      const reader = stream.getReader();
      
      const { response } = await parseThinkingBuffer(reader, (event) => {
        if (event.type === 'thought_chunk') {
          this.emit({ type: 'thought_chunk', chunk: event.chunk });
        } else {
          this.emit({ type: 'ai_chunk', chunk: event.chunk });
        }
      });
      fullResponse = response;

    } else { // query
      const result = await this.provider.query(messagesToSend);
      let responseContent = result.content;
      const thinkRegex = /<think>([\s\S]*?)<\/think>\s*/gm;
      const matches = [...responseContent.matchAll(thinkRegex)];

      if (matches.length > 0) {
        matches.forEach(match => {
          const thoughtContent = match[1].trim();
          if (thoughtContent) {
            this.emit({ type: 'thought', content: thoughtContent });
          }
        });
        responseContent = responseContent.replace(thinkRegex, '');
      }
      fullResponse = responseContent;
    }

    this.emit({ type: 'ai_response', content: fullResponse });
    const assistantMessage: AIMessage = { role: 'assistant', content: fullResponse };
    this.memory.push(assistantMessage);

    if (this.tooler) {
      debug('Full response before tool call: "%s"', fullResponse);
      const toolCalls = this.tooler.findToolCalls(fullResponse);
      debug('Found %d tool calls: %o', toolCalls.length, toolCalls.map(call => ({ id: call.id, tool: call.tool.name, command: call.command, content: call.content })));
      if (toolCalls.length > 0) {
        if (toolCalls.length > 1) {
          debug(`Found ${toolCalls.length} tool calls, but executing only the first one.`);
        }
        debug('Calling tooler with first tool call: %s', toolCalls[0].fullMatch);
        await this.tooler.call(toolCalls[0].fullMatch);
      } else {
        debug('No tool calls found in response');
      }
    }

    // If no tool calls were made, the cycle is done.
    // If tool calls were made, handleToolResult will schedule the next 'send'.
    if (this._toSend.length === 0) {
      debug('No more messages to send, emitting done.');
      this.emit({ type: 'done' });
    }
  }

  public stop() {
    debug('stop() called.');
    this._stop = true;
  }

  public resume() {
    debug('resume() called.');
    this._stop = false;
    this.scheduleSend();
  }

  public clear() {
    debug('clear() called. Clearing _toSend queue and memory (except system prompt).');
    this._toSend = [];
    this.memory = this.memory.filter(m => m.role === 'system');
  }
} 