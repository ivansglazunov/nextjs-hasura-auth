import { AIMessage, AIProvider, ProviderOptions } from '../ai';
import dotenv from 'dotenv';
import Debug from '../../debug';
import axios from 'axios';

dotenv.config();
const debug = Debug('ai:provider:api-route');

export interface ApiRouteProviderOptions extends ProviderOptions {
  url?: string;
}

function getUrl(pathOrUrl: string | undefined, defaultPath: string): string {
  const path = pathOrUrl || defaultPath;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    debug('Using provided absolute URL: %s', path);
    return path;
  }
  // Using 127.0.0.1 to avoid localhost resolution issues between IPv4 and IPv6
  const baseUrl = (process.env.NEXT_PUBLIC_MAIN_URL || 'http://localhost:3000');
  const fullUrl = new URL(path, baseUrl).toString();
  debug('Constructed URL: %s (base: %s, path: %s)', fullUrl, baseUrl, path);
  return fullUrl;
}

export class ApiRouteProvider implements AIProvider {
  private url: string;

  constructor(options: ApiRouteProviderOptions = {}) {
    this.url = getUrl(options.url, '/api/dialog');
    debug('ApiRouteProvider initialized with URL: %s', this.url);
  }

  async query(messages: AIMessage[], options: ApiRouteProviderOptions = {}): Promise<AIMessage> {
    const requestUrl = getUrl(options.url, this.url);
    debug('Querying API route at %s with %d messages', requestUrl, messages.length);
    const requestBody = { messages };
    debug('Request body: %o', requestBody);
    try {
      const response = await axios.post(requestUrl, JSON.stringify(requestBody), {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10 second timeout
      });

      debug('Received response from API route with status: %d', response.status);
      
      const data = response.data;
      debug('Received data from API route: %o', data);
      return data.message;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        debug('Axios error in ApiRouteProvider: %s. Code: %s. Response: %o', error.message, error.code, error.response?.data);
      } else {
        debug('Generic error in ApiRouteProvider: %o', error);
      }
      throw error;
    }
  }

  async stream(messages: AIMessage[], options: ApiRouteProviderOptions = {}): Promise<ReadableStream<string>> {
    debug('Simulating stream by calling query first...');
    const message = await this.query(messages, options);
    
    return new ReadableStream<string>({
      start(controller) {
        if (message.content) {
          debug('Enqueuing content to simulated stream: "%s"', message.content.substring(0, 100));
          controller.enqueue(message.content);
        }
        debug('Closing simulated stream.');
        controller.close();
      }
    });
  }
} 