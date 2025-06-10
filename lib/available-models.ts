import { AIModel, AvailableModelsOptions } from './ai';
import { Ollama } from './ollama';
import { OpenRouter } from './openrouter';

/**
 * Get available models from Ollama
 */
export async function availableModels(options: AvailableModelsOptions & { provider: 'ollama' }): Promise<AIModel[]>;
export async function availableModels(options: AvailableModelsOptions & { provider: 'openrouter'; token: string }): Promise<AIModel[]>;
export async function availableModels(options: AvailableModelsOptions & { provider: 'ollama' | 'openrouter'; token?: string }): Promise<AIModel[]> {
  switch (options.provider) {
    case 'ollama': {
      const ollama = new Ollama({
        baseUrl: options.baseUrl || 'http://localhost:11434'
      });
      return ollama.availableModels!(options);
    }
    
    case 'openrouter': {
      if (!options.token) {
        throw new Error('OpenRouter token is required');
      }
      const openRouter = new OpenRouter({
        token: options.token,
        model: 'placeholder' // We only need token for listing models
      });
      return openRouter.availableModels!(options);
    }
    
    default:
      throw new Error(`Unknown provider: ${(options as any).provider}`);
  }
} 