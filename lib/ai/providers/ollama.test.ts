import { OllamaProvider } from './ollama';
import { AIMessage } from '../ai';

describe('OllamaProvider', () => {
  const testModel = 'gemma2:2b'; // Make sure this model is available on your Ollama server

  // Helper to check if Ollama server is running
  const isOllamaRunning = async () => {
    try {
      // Use a short timeout to avoid waiting long
      const response = await fetch('http://localhost:11434', { signal: AbortSignal.timeout(1000) });
      return response.status === 200;
    } catch (e) {
      return false;
    }
  };

  it('should get a response from query method', async () => {
    const isRunning = await isOllamaRunning();
    if (!isRunning) {
      console.warn('Ollama server not found at http://localhost:11434. Skipping test.');
      return;
    }
    
    const provider = new OllamaProvider({ model: testModel });
    const messages: AIMessage[] = [{ role: 'user', content: 'Say "Hello, Ollama!" in one sentence.' }];
    const response = await provider.query(messages);
    expect(response.role).toBe('assistant');
    expect(response.content).toContain('Hello, Ollama!');
  }, 30000);

  it('should get a streamed response', async () => {
    const isRunning = await isOllamaRunning();
    if (!isRunning) {
      console.warn('Ollama server not found at http://localhost:11434. Skipping test.');
      return;
    }

    const provider = new OllamaProvider({ model: testModel });
    const messages: AIMessage[] = [{ role: 'user', content: 'Say "Hello, Stream!" in one sentence.' }];
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
  }, 30000);

  it('should throw an error if the server is down', async () => {
    const providerWithBadUrl = new OllamaProvider({ baseUrl: 'http://localhost:9999', timeout: 500 });
    const messages: AIMessage[] = [{ role: 'user', content: 'test' }];
    await expect(providerWithBadUrl.query(messages)).rejects.toThrow();
  });

  describe('[TOOLS]', () => {
    it('should call a terminal command', async () => {
        const isRunning = await isOllamaRunning();
        if (!isRunning) {
          console.warn('Ollama server not found at http://localhost:11434. Skipping test.');
          return;
        }

        const provider = new OllamaProvider({ model: testModel });

        const messages: AIMessage[] = [
            {
                role: 'system',
                content: `You have access to a terminal. To execute a command, use the following syntax, replacing the placeholders with the actual command and a unique identifier:
> 😈<uuid>/terminal/exec
echo "hello world"
> 😈<uuid>/terminal/exec

The uuid must be a unique identifier for each command execution. Always respond with the terminal command syntax when asked to perform a task that requires it.`
            },
            {
                role: 'user',
                content: 'List files in the current directory'
            }
        ];

        const response = await provider.query(messages);

        expect(response.role).toBe('assistant');
        // A flexible regex to capture variations like `ls` or `ls -la` and tolerate missing closing tag
        // and also tolerate space or newline between tag and command
        expect(response.content).toMatch(/> 😈[a-zA-Z0-9-]+\/terminal\/exec(\s+|\n)(ls -la|ls -l|ls)/);
    }, 30000);
  });
}); 