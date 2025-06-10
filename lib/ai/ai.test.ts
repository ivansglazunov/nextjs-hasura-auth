import { AI, AIProvider, AIMessage } from './ai';
import { jest } from '@jest/globals';

// Mock AI Provider for testing the AI class logic
class MockAIProvider implements AIProvider {
  public receivedMessages: AIMessage[][] = [];

  async query(messages: AIMessage[]): Promise<AIMessage> {
    this.receivedMessages.push(messages);
    const lastMessage = messages[messages.length - 1];
    return Promise.resolve({
      role: 'assistant',
      content: `Mock response to: ${lastMessage.content}`
    });
  }

  async stream(messages: AIMessage[]): Promise<ReadableStream<string>> {
    this.receivedMessages.push(messages);
    const lastMessage = messages[messages.length - 1];
    const responseChunks = [`Mock`, ` stream`, ` to:`, ` ${lastMessage.content}`];

    const stream = new ReadableStream<string>({
      start(controller) {
        for (const chunk of responseChunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      }
    });
    return Promise.resolve(stream);
  }
}

describe('AI Class', () => {
  it('should initialize with system prompt correctly', () => {
    const systemPrompt = 'You are a test assistant.';
    const ai = new AI({ provider: new MockAIProvider(), systemPrompt });

    expect(ai.systemPrompt).toBe(systemPrompt);
    expect(ai.memory.length).toBe(1);
    expect(ai.memory[0]).toEqual({ role: 'system', content: systemPrompt });
  });

  it('should manage memory correctly', () => {
    const systemPrompt = 'You are a test assistant.';
    const ai = new AI({ provider: new MockAIProvider(), systemPrompt });
    ai.memory.push({ role: 'user', content: 'hello' });

    expect(ai.memory.length).toBe(2);

    ai.clearMemory();
    expect(ai.memory.length).toBe(1);
    expect(ai.memory[0].role).toBe('system');
  });

  it('should execute query and update memory', async () => {
    const ai = new AI({ provider: new MockAIProvider() });
    const userMessage: AIMessage = { role: 'user', content: 'test query' };

    const response = await ai.query(userMessage);

    expect(response).toBe('Mock response to: test query');
    expect(ai.memory.length).toBe(2);
    expect(ai.memory[0]).toEqual(userMessage);
    expect(ai.memory[1]).toEqual({ role: 'assistant', content: response });
  });

  it('should execute subscribe and update memory', async () => {
    const ai = new AI({ provider: new MockAIProvider() });
    const userMessage: AIMessage = { role: 'user', content: 'test subscribe' };

    const response = await ai.subscribe(userMessage);

    expect(response).toBe('Mock stream to: test subscribe');
    expect(ai.memory.length).toBe(2);
    expect(ai.memory[0]).toEqual(userMessage);
    expect(ai.memory[1]).toEqual({ role: 'assistant', content: response });
  });

  it('should remember context between subscribe calls', async () => {
    const provider = new MockAIProvider();
    const ai = new AI({ provider });

    // 1. Send initial message to establish context
    await ai.subscribe({ role: 'user', content: 'My name is John.' });

    // 2. Ask a follow-up question
    await ai.subscribe({ role: 'user', content: 'What is my name?' });
    
    // 3. Check if the provider received the full context in the second call
    const lastReceived = provider.receivedMessages[provider.receivedMessages.length - 1];
    
    expect(lastReceived).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'user', content: 'My name is John.' }),
        expect.objectContaining({ role: 'assistant', content: 'Mock stream to: My name is John.' }),
        expect.objectContaining({ role: 'user', content: 'What is my name?' }),
      ])
    );
  });

  it('should not update memory on stream() call', async () => {
    const ai = new AI({ provider: new MockAIProvider() });
    const userMessage: AIMessage = { role: 'user', content: 'test stream' };

    const initialMemory = JSON.parse(JSON.stringify(ai.memory));
    await ai.stream(userMessage);

    expect(ai.memory).toEqual(initialMemory);
  });
}); 