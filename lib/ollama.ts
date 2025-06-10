import { AIMessage } from "./ai";
import { AIProvider, AIModel, AvailableModelsOptions } from "./ai";
import Debug from 'debug';

const debug = Debug('hasyx:ollama');

export interface OllamaOptions {
  baseUrl?: string;
  model?: string;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  num_predict?: number;
  stream?: boolean;
  timeout?: number;
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export class Ollama implements AIProvider {
  private defaultOptions: OllamaOptions = {
    baseUrl: 'http://localhost:11434',
    model: 'llama2',
    temperature: 0.7,
    top_p: 1,
    top_k: 40,
    num_predict: 128,
    stream: false,
    timeout: 30000
  };
  
  private options: OllamaOptions;

  constructor(options: OllamaOptions = {}) {
    this.options = { ...this.defaultOptions, ...options };
    debug('Ollama provider initialized', this.options);
  }

  /**
   * Send a message or array of messages to Ollama
   */
  async ask(
    messages: string | AIMessage | AIMessage[],
    options: OllamaOptions = {}
  ): Promise<string> {
    const finalOptions = { ...this.options, ...options };
    
    // Normalize messages to array format
    let normalizedMessages: AIMessage[];
    
    if (typeof messages === 'string') {
      normalizedMessages = [{ role: 'user', content: messages }];
    } else if (Array.isArray(messages)) {
      normalizedMessages = messages;
    } else {
      normalizedMessages = [messages];
    }

    // Convert messages to Ollama format (simple prompt for now)
    const prompt = this.convertMessagesToPrompt(normalizedMessages);

    try {
      debug('Sending request to Ollama API', { prompt: prompt.substring(0, 100) });
      
      const response = await fetch(`${finalOptions.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: finalOptions.model,
          prompt: prompt,
          temperature: finalOptions.temperature,
          top_p: finalOptions.top_p,
          top_k: finalOptions.top_k,
          num_predict: finalOptions.num_predict,
          stream: false
        }),
        signal: AbortSignal.timeout(finalOptions.timeout || 30000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: OllamaResponse = await response.json();
      
      if (!data.response) {
        throw new Error('No response generated');
      }

      debug('Received response from Ollama', { 
        response: data.response.substring(0, 100),
        done: data.done 
      });

      return data.response;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      debug('Ollama API error', { error: errorMessage });
      throw new Error(`Ollama API error: ${errorMessage}`);
    }
  }

  /**
   * Send a message or array of messages to Ollama with streaming support
   */
  async askStream(
    messages: string | AIMessage | AIMessage[],
    options: OllamaOptions = {}
  ): Promise<ReadableStream<string>> {
    const finalOptions = { ...this.options, ...options, stream: true };
    
    // Normalize messages to array format
    let normalizedMessages: AIMessage[];
    
    if (typeof messages === 'string') {
      normalizedMessages = [{ role: 'user', content: messages }];
    } else if (Array.isArray(messages)) {
      normalizedMessages = messages;
    } else {
      normalizedMessages = [messages];
    }

    // Convert messages to Ollama format
    const prompt = this.convertMessagesToPrompt(normalizedMessages);

    try {
      debug('Sending streaming request to Ollama API', { prompt: prompt.substring(0, 100) });
      
      const response = await fetch(`${finalOptions.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: finalOptions.model,
          prompt: prompt,
          temperature: finalOptions.temperature,
          top_p: finalOptions.top_p,
          top_k: finalOptions.top_k,
          num_predict: finalOptions.num_predict,
          stream: true
        }),
        signal: AbortSignal.timeout(finalOptions.timeout || 30000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      // Create a ReadableStream that parses JSONL and extracts content
      return new ReadableStream<string>({
        start(controller) {
          const reader = response.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          function pump(): Promise<void> {
            return reader.read().then(({ done, value }) => {
              if (done) {
                controller.close();
                return;
              }

              buffer += decoder.decode(value, { stream: true });
              
              // Process complete lines (JSONL format)
              let lines = buffer.split('\n');
              buffer = lines.pop() || ''; // Keep incomplete line in buffer

              for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine) continue;

                try {
                  const parsed: OllamaResponse = JSON.parse(trimmedLine);
                  
                  if (parsed.response) {
                    controller.enqueue(parsed.response);
                  }
                  
                  if (parsed.done) {
                    controller.close();
                    return;
                  }
                } catch (error) {
                  // Skip invalid JSON lines
                  debug('Failed to parse JSON line', { line: trimmedLine, error });
                  continue;
                }
              }

              return pump();
            }).catch(error => {
              debug('Stream error', { error });
              controller.error(error);
            });
          }

          return pump();
        }
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      debug('Ollama stream error', { error: errorMessage });
      throw new Error(`Ollama stream error: ${errorMessage}`);
    }
  }

  /**
   * Update the Ollama options
   */
  updateOptions(updates: OllamaOptions): void {
    this.options = { ...this.options, ...updates };
    debug('Ollama options updated', this.options);
  }

  /**
   * Convert AIMessage array to a simple prompt string
   * This is a basic implementation - could be enhanced for better conversation handling
   */
  private convertMessagesToPrompt(messages: AIMessage[]): string {
    const promptParts: string[] = [];
    
    for (const message of messages) {
      switch (message.role) {
        case 'system':
          promptParts.push(`System: ${message.content}`);
          break;
        case 'user':
          promptParts.push(`Human: ${message.content}`);
          break;
        case 'assistant':
          promptParts.push(`Assistant: ${message.content}`);
          break;
        case 'tool':
          promptParts.push(`Tool: ${message.content}`);
          break;
        default:
          promptParts.push(message.content);
      }
    }
    
    // Add a final prompt for the assistant to respond
    if (messages.length > 0 && messages[messages.length - 1].role !== 'assistant') {
      promptParts.push('Assistant:');
    }
    
    return promptParts.join('\n\n');
  }

  /**
   * Check if Ollama server is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.options.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.options.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.models?.map((model: any) => model.name) || [];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to list Ollama models: ${errorMessage}`);
    }
  }

  /**
   * Pull a model to Ollama
   */
  async pullModel(modelName: string): Promise<void> {
    try {
      debug('Pulling model', { modelName });
      
      const response = await fetch(`${this.options.baseUrl}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: modelName
        }),
        signal: AbortSignal.timeout(300000) // 5 minutes for model pulling
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Process streaming response to track progress
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.status) {
                debug('Pull progress', { status: data.status, completed: data.completed, total: data.total });
              }
            } catch {
              // Ignore invalid JSON
            }
          }
        }
      }

      debug('Model pulled successfully', { modelName });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      debug('Failed to pull model', { modelName, error: errorMessage });
      throw new Error(`Failed to pull model ${modelName}: ${errorMessage}`);
    }
  }

  /**
   * Get available models in standardized format
   */
  async availableModels(options?: AvailableModelsOptions): Promise<AIModel[]> {
    try {
      const baseUrl = options?.baseUrl || this.options.baseUrl;
      const response = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const models = data.models || [];

      return models.map((model: any) => ({
        id: model.name,
        name: model.name,
        provider: 'ollama',
        free: true, // All local Ollama models are free
        context_length: model.details?.parameter_size ? parseInt(model.details.parameter_size) : undefined,
        description: `Local Ollama model - ${model.size ? `Size: ${model.size}` : 'Available'}`
      }));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      debug('Failed to get available models', { error: errorMessage });
      throw new Error(`Failed to get available models: ${errorMessage}`);
    }
  }
} 