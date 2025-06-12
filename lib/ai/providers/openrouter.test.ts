import { OpenRouterProvider } from './openrouter';
import { AIMessage } from '../ai';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const hasApiKey = !!process.env.OPENROUTER_API_KEY;
const describeWithApiKey = hasApiKey ? describe : describe.skip;

describe('OpenRouterProvider', () => {

  it('should throw an error if no API token is provided', () => {
    // @ts-ignore
    expect(() => new OpenRouterProvider({})).toThrow('OpenRouter API token is required');
  });

  it('should initialize with default options', () => {
    const provider = new OpenRouterProvider({ token: 'test-key' });
    // @ts-ignore
    expect(provider.options.model).toBe('deepseek/deepseek-chat-v3-0324:free');
  });

  describeWithApiKey('API Calls', () => {
    let provider: OpenRouterProvider;

    beforeEach(() => {
      provider = new OpenRouterProvider({ token: process.env.OPENROUTER_API_KEY! });
    });

    it('should get a valid response from query()', async () => {
      const messages: AIMessage[] = [{ role: 'user', content: 'Say "hello"' }];
      const response = await provider.query(messages);

      expect(response.role).toBe('assistant');
      expect(typeof response.content).toBe('string');
      expect(response.content.toLowerCase()).toContain('hello');
    }, 30000);

    it('should get a valid stream from stream()', async () => {
      const messages: AIMessage[] = [{ role: 'user', content: 'Say "hello"' }];
      const stream = await provider.stream(messages);
      const reader = stream.getReader();

      let fullResponse = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullResponse += value;
      }

      expect(fullResponse.length).toBeGreaterThan(0);
      expect(fullResponse.toLowerCase()).toContain('hello');
    }, 30000);

    it('should handle API errors gracefully', async () => {
      const badProvider = new OpenRouterProvider({ token: 'invalid-token' });
      const messages: AIMessage[] = [{ role: 'user', content: 'test' }];

      await expect(badProvider.query(messages)).rejects.toThrow();
    });
  });
}); 