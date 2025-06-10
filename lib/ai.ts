// Hasyx AI class
import Debug from 'debug';

const debug = Debug('hasyx:ai');

export interface AIOptions {
  provider: AIProvider;
  systemPrompt?: string;
  onResponse?: (response: string) => void;
  onStream?: (chunk: string) => void;
  onStreamEnd?: () => void;
}

export class AI {
  private provider: AIProvider;
  public memory: AIMessage[] = [];
  public systemPrompt?: string;
  private onResponse?: (response: string) => void;
  private onStream?: (chunk: string) => void;
  private onStreamEnd?: () => void;

  constructor(options: AIOptions) {
    this.provider = options.provider;
    this.systemPrompt = options.systemPrompt;
    this.onResponse = options.onResponse;
    this.onStream = options.onStream;
    this.onStreamEnd = options.onStreamEnd;

    if (this.systemPrompt) {
      this.memory.push({ role: 'system', content: this.systemPrompt });
    }
  }

  public async ask(
    message: string,
    options: { addToMemory?: boolean } = { addToMemory: true }
  ): Promise<string> {
    const userMessage: AIMessage = { role: 'user', content: message };
    
    const messages: AIMessage[] = [...this.memory, userMessage];

    debug('Sending messages to provider: %O', messages);
    
    const responseContent = await this.provider.ask(messages);
    
    debug('Received response from provider: %s', responseContent);

    if (options.addToMemory) {
      this.memory.push(userMessage);
      this.memory.push({ role: 'assistant', content: responseContent });
    }

    if (this.onResponse) {
      this.onResponse(responseContent);
    }

    return responseContent;
  }

  public async askStream(
    message: string,
    options: { addToMemory?: boolean } = { addToMemory: true }
  ): Promise<string> {
    const userMessage: AIMessage = { role: 'user', content: message };
    const messages: AIMessage[] = [...this.memory, userMessage];

    debug('Sending messages to provider for streaming: %O', messages);

    const stream = await this.provider.askStream(messages);
    const reader = stream.getReader();
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      // value is already a string from our ReadableStream<string>
      fullResponse += value;
      if (this.onStream) {
        this.onStream(value);
      }
    }

    if (this.onStreamEnd) {
      this.onStreamEnd();
    }
    
    debug('Received streamed response from provider: %s', fullResponse);

    if (options.addToMemory) {
      this.memory.push(userMessage);
      this.memory.push({ role: 'assistant', content: fullResponse });
    }
    
    if (this.onResponse) {
      this.onResponse(fullResponse);
    }

    return fullResponse;
  }

  public clearMemory(): void {
    this.memory = [];
    if (this.systemPrompt) {
      this.memory.push({ role: 'system', content: this.systemPrompt });
    }
  }
}
export interface AIProvider {
  ask(messages: string | AIMessage | AIMessage[], options?: any): Promise<string>;
  askStream(messages: string | AIMessage | AIMessage[], options?: any): Promise<ReadableStream<string>>;
  updateOptions(updates: any): void;
}
export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}
 