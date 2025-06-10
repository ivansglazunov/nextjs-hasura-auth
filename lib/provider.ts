export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface AIProvider {
  ask(messages: string | AIMessage | AIMessage[], options?: any): Promise<string>;
  askStream(messages: string | AIMessage | AIMessage[], options?: any): Promise<ReadableStream<string>>;
  updateOptions(updates: any): void;
} 