import { AIMessage, AIProvider, ProviderOptions } from '../ai';

export interface OllamaProviderOptions extends ProviderOptions {
  baseUrl?: string;
  model?: string;
  temperature?: number;
  timeout?: number;
}

export class OllamaProvider implements AIProvider {
  private options: OllamaProviderOptions;

  constructor(options: OllamaProviderOptions = {}) {
    this.options = {
      baseUrl: 'http://localhost:11434',
      model: 'gemma2:2b',
      timeout: 6000000,
      ...options
    };
  }

  private convertMessagesToPrompt(messages: AIMessage[]): string {
    return messages.map(m => `${m.role}: ${m.content}`).join('\n');
  }

  private async fetchAPI(endpoint: string, body: any): Promise<Response> {
    return fetch(`${this.options.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.options.timeout!)
    });
  }

  async query(messages: AIMessage[], options: OllamaProviderOptions = this.options): Promise<AIMessage> {
    const requestBody = {
      model: options.model || this.options.model,
      messages: messages,
      stream: false,
      temperature: options.temperature || this.options.temperature,
    };

    const response = await this.fetchAPI('/api/chat', requestBody);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return { role: 'assistant', content: data.message?.content || '' };
  }

  async stream(messages: AIMessage[], options: OllamaProviderOptions = this.options): Promise<ReadableStream<string>> {
    const requestBody = {
      model: options.model || this.options.model,
      messages: messages,
      stream: true,
      temperature: options.temperature || this.options.temperature,
    };

    const response = await this.fetchAPI('/api/chat', requestBody);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API stream error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const decoder = new TextDecoder();

    return new ReadableStream<string>({
      async start(controller) {
        const reader = response.body!.getReader();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
              if (line.trim()) {
                try {
                  const parsed = JSON.parse(line);
                  const content = parsed.message?.content;
                  if (content) {
                    controller.enqueue(content);
                  }
                  if (parsed.done) {
                    controller.close();
                    return;
                  }
                } catch (e) {
                  // Ignore parsing errors for incomplete JSON
                }
              }
            }
          }
        } catch (error) {
          controller.error(error);
        } finally {
          if (!controller.desiredSize) {
             controller.close();
          }
        }
      }
    });
  }
} 