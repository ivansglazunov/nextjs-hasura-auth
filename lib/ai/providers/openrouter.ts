import { AIMessage, AIProvider, ProviderOptions } from '../ai';

// Subset of options relevant to OpenRouter API calls
export interface OpenRouterProviderOptions extends ProviderOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  user?: string;
  token: string;
  top_p?: number;
  top_k?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

export class OpenRouterProvider implements AIProvider {
  private options: OpenRouterProviderOptions;

  constructor(options: OpenRouterProviderOptions) {
    if (!options.token) {
      throw new Error('OpenRouter API token is required');
    }
    this.options = {
      model: 'google/gemini-2.5-flash-preview',
      temperature: 0.7,
      top_p: 1,
      top_k: 0,
      frequency_penalty: 0,
      presence_penalty: 0,
      ...options
    };
  }

  private async fetchAPI(body: any): Promise<Response> {
    return fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.options.token}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/ivansglazunov/hasyx',
        'X-Title': 'Hasyx Framework'
      },
      body: JSON.stringify(body)
    });
  }

  async query(messages: AIMessage[], options: OpenRouterProviderOptions = this.options): Promise<AIMessage> {
    const finalOptions = { ...this.options, ...options };
    const requestBody = {
      model: finalOptions.model,
      messages: messages,
      temperature: finalOptions.temperature,
      max_tokens: finalOptions.max_tokens,
      user: finalOptions.user,
      top_p: finalOptions.top_p,
      top_k: finalOptions.top_k,
      frequency_penalty: finalOptions.frequency_penalty,
      presence_penalty: finalOptions.presence_penalty,
    };

    const response = await this.fetchAPI(requestBody);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';

    return { role: 'assistant', content };
  }

  async stream(messages: AIMessage[], options: OpenRouterProviderOptions = this.options): Promise<ReadableStream<string>> {
    const finalOptions = { ...this.options, ...options };
    const requestBody = {
      model: finalOptions.model,
      messages: messages,
      stream: true,
      temperature: finalOptions.temperature,
      max_tokens: finalOptions.max_tokens,
      user: finalOptions.user,
      top_p: finalOptions.top_p,
      top_k: finalOptions.top_k,
      frequency_penalty: finalOptions.frequency_penalty,
      presence_penalty: finalOptions.presence_penalty,
    };

    const response = await this.fetchAPI(requestBody);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API stream error: ${response.status} ${response.statusText} - ${errorText}`);
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
              if (line.trim().startsWith('data: ')) {
                const data = line.trim().slice(6);
                if (data === '[DONE]') {
                  controller.close();
                  return;
                }
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    controller.enqueue(content);
                  }
                } catch (e) {
                  // Ignore parsing errors for non-json lines
                }
              }
            }
          }
        } catch (error) {
          controller.error(error);
        } finally {
          controller.close();
        }
      }
    });
  }
} 