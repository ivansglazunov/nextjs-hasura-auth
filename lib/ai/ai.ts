export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface ProviderOptions {
  [key: string]: any;
}

export interface AIProvider {
  query(messages: AIMessage[], options?: ProviderOptions): Promise<AIMessage>;
  stream(messages: AIMessage[], options?: ProviderOptions): Promise<ReadableStream<string>>;
}

export interface AIOptions {
  provider: AIProvider;
  systemPrompt?: string;
}

export class AI {
  private provider: AIProvider;
  public memory: AIMessage[] = [];
  public systemPrompt?: string;

  constructor(options: AIOptions) {
    this.provider = options.provider;
    this.systemPrompt = options.systemPrompt;
    if (this.systemPrompt && !this.memory.some(m => m.role === 'system')) {
      this.memory.push({ role: 'system', content: this.systemPrompt });
    }
  }

  private getMessagesWithContext(message: AIMessage): AIMessage[] {
    const messages: AIMessage[] = [];
    const memoryWithoutSystem = this.memory.filter(m => m.role !== 'system');

    if (this.systemPrompt) {
      messages.push({ role: 'system', content: this.systemPrompt });
    }

    messages.push(...memoryWithoutSystem);
    messages.push(message);
    return messages;
  }

  public async query(message: AIMessage): Promise<string> {
    const allMessages = this.getMessagesWithContext(message);

    this.memory.push(message);

    const assistantMessage = await this.provider.query(allMessages);

    this.memory.push(assistantMessage);

    return assistantMessage.content;
  }

  public async stream(message: AIMessage): Promise<ReadableStream<string>> {
    const allMessages = this.getMessagesWithContext(message);
    return this.provider.stream(allMessages);
  }

  public async subscribe(message: AIMessage): Promise<string> {
    this.memory.push(message);

    const stream = await this.stream(message);
    const reader = stream.getReader();
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      fullResponse += value;
    }

    this.memory.push({ role: 'assistant', content: fullResponse });

    return fullResponse;
  }

  public clearMemory(): void {
    const oldMemory = this.memory;
    this.memory = [];
    const systemMessage = oldMemory.find(m => m.role === 'system');
    if (systemMessage) {
      this.memory.push(systemMessage);
    } else if (this.systemPrompt) {
      this.memory.push({ role: 'system', content: this.systemPrompt });
    }
  }
} 