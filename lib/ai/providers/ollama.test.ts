import { OllamaProvider } from './ollama';
import { AIMessage } from '../ai';

describe('OllamaProvider', () => {
  let provider: OllamaProvider;
  const testModel = 'gemma2:2b'; // Make sure this model is available on your Ollama server

  beforeEach(() => {
    provider = new OllamaProvider({ model: testModel });
  });

  // Helper to check if Ollama server is running
  const isOllamaRunning = async () => {
    try {
      const response = await fetch('http://localhost:11434');
      return response.status === 200;
    } catch (e) {
      return false;
    }
  };

  // Skip tests if Ollama is not running
  beforeAll(async () => {
    const running = await isOllamaRunning();
    if (!running) {
      console.warn('Ollama server not found at http://localhost:11434. Skipping OllamaProvider tests.');
      (global as any).it.skip = (name: string, fn: any) => {
        it(name, fn).skip();
      };
    }
  });


  it('should get a response from query method', async () => {
    const messages: AIMessage[] = [{ role: 'user', content: 'Say "Hello, Ollama!"' }];
    const response = await provider.query(messages);
    expect(response.role).toBe('assistant');
    expect(response.content).toContain('Hello, Ollama!');
  }, 30000); // 30s timeout for model loading

  it('should get a streamed response', async () => {
    const messages: AIMessage[] = [{ role: 'user', content: 'Say "Hello, Stream!"' }];
    const stream = await provider.stream(messages);
    const reader = stream.getReader();
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      fullResponse += value;
    }

    expect(fullResponse).toContain('Hello, Stream!');
  }, 30000); // 30s timeout for model loading

  it('should throw an error if the server is down', async () => {
    const providerWithBadUrl = new OllamaProvider({ baseUrl: 'http://localhost:9999' });
    const messages: AIMessage[] = [{ role: 'user', content: 'test' }];
    await expect(providerWithBadUrl.query(messages)).rejects.toThrow();
  });
}); 