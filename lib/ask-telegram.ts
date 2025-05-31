import { AskHasyx, AskOptions, OutputHandlers } from './ask-hasyx';
import { sendTelegramMessage } from './telegram-bot';
import Debug from './debug';

const debug = Debug('hasyx:ask-telegram');

export interface TelegramConfig {
  botToken: string;
  chatId: number;
  bufferTime?: number; // Milliseconds to buffer messages (default: 1000)
  maxMessageLength?: number; // Max Telegram message length (default: 4096)
  enableCodeBlocks?: boolean; // Whether to format code blocks (default: true)
}

export interface TelegramAskOptions extends AskOptions {
  telegram?: TelegramConfig;
}

export interface TelegramAskInstance {
  ask: TelegramAskWrapper;
  lastActivity: Date;
  chatId: number;
  userId: number;
}

// Global instance manager
const instances = new Map<string, TelegramAskInstance>();

export class TelegramAskWrapper extends AskHasyx {
  private chatId: number;
  private botToken: string;
  private messageBuffer: string[] = [];
  private bufferTimeout: NodeJS.Timeout | null = null;
  private bufferTime: number;
  private maxMessageLength: number;
  private enableCodeBlocks: boolean;

  constructor(
    token: string,
    chatId: number,
    botToken: string,
    context: any = {},
    options: any = {},
    systemPrompt?: string,
    askOptions: TelegramAskOptions = {}
  ) {
    // Extract telegram options with proper default handling
    const telegramOptions = askOptions.telegram || {
      botToken,
      chatId,
      bufferTime: 1000,
      maxMessageLength: 4096,
      enableCodeBlocks: true
    };
    
    // Create output handlers for Telegram
    const outputHandlers: OutputHandlers = {
      onThinking: () => this.sendBufferedMessage('🧠 AI думает...'),
      onCodeFound: async (code: string, format: 'js' | 'tsx' | 'terminal') => {
        await this.sendBufferedMessage(`📋 Найден ${format.toUpperCase()} код для выполнения:`);
        if (this.enableCodeBlocks) {
          const displayFormat = format === 'terminal' ? 'bash' : format;
          await this.sendBufferedMessage(`\`\`\`${displayFormat}\n${code}\n\`\`\``);
        } else {
          await this.sendBufferedMessage(code);
        }
      },
      onCodeExecuting: (code: string, format: 'js' | 'tsx' | 'terminal') => 
        this.sendBufferedMessage(`⚡ Выполняется ${format.toUpperCase()} код...`),
      onCodeResult: async (result: string) => {
        await this.sendBufferedMessage('✅ Результат выполнения:');
        if (this.enableCodeBlocks) {
          await this.sendBufferedMessage(`\`\`\`\n${result}\n\`\`\``);
        } else {
          await this.sendBufferedMessage(result);
        }
      },
      onResponse: (response: string) => 
        this.sendBufferedMessage(`💭 AI ответил (${response.length} символов)`),
      onOutput: (message: string) => this.sendBufferedMessage(message),
      onError: (error: string) => this.sendBufferedMessage(`❌ ${error}`),
      onWelcome: async (enabledEngines: string[]) => {
        await this.sendBufferedMessage('🤖 Добро пожаловать в Hasyx AI Telegram Bot!');
        if (enabledEngines.length > 0) {
          await this.sendBufferedMessage(`🪬 Доступны движки: ${enabledEngines.join(', ')}`);
        }
        await this.sendBufferedMessage('Задавайте любые вопросы, я отвечу со стримингом!');
      },
      onGoodbye: () => this.sendBufferedMessage('👋 До свидания!')
    };

    // Remove telegram options from askOptions to avoid passing to parent
    const { telegram, ...cleanAskOptions } = askOptions;

    super(token, context, options, systemPrompt, cleanAskOptions, outputHandlers);

    this.chatId = chatId;
    this.botToken = botToken;
    this.bufferTime = telegramOptions.bufferTime || 1000;
    this.maxMessageLength = telegramOptions.maxMessageLength || 4096;
    this.enableCodeBlocks = telegramOptions.enableCodeBlocks !== false;

    debug(`TelegramAskWrapper created for chat ${chatId}`);
  }

  private async sendBufferedMessage(message: string): Promise<void> {
    this.messageBuffer.push(message);
    
    // Clear existing timeout
    if (this.bufferTimeout) {
      clearTimeout(this.bufferTimeout);
    }

    // Set new timeout to flush buffer
    this.bufferTimeout = setTimeout(() => {
      this.flushMessageBuffer();
    }, this.bufferTime);
  }

  private async flushMessageBuffer(): Promise<void> {
    if (this.messageBuffer.length === 0) return;

    try {
      const fullMessage = this.messageBuffer.join('\n');
      this.messageBuffer = [];
      this.bufferTimeout = null;

      // Split message if too long
      if (fullMessage.length <= this.maxMessageLength) {
        await sendTelegramMessage(this.botToken, this.chatId, fullMessage);
      } else {
        // Split into chunks
        const chunks = this.splitMessage(fullMessage, this.maxMessageLength);
        for (const chunk of chunks) {
          await sendTelegramMessage(this.botToken, this.chatId, chunk);
          // Small delay between chunks to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      debug('Error sending buffered message:', error);
      console.error('Failed to send Telegram message:', error);
    }
  }

  private splitMessage(message: string, maxLength: number): string[] {
    if (message.length <= maxLength) return [message];

    const chunks: string[] = [];
    let currentChunk = '';
    const lines = message.split('\n');

    for (const line of lines) {
      if ((currentChunk + '\n' + line).length > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = line;
        } else {
          // Line itself is too long, split it
          for (let i = 0; i < line.length; i += maxLength) {
            chunks.push(line.substring(i, i + maxLength));
          }
          currentChunk = '';
        }
      } else {
        currentChunk = currentChunk ? currentChunk + '\n' + line : line;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  // Override ask method to handle streaming responses for Telegram
  async ask(question: string): Promise<string> {
    debug(`Processing question for chat ${this.chatId}:`, question);
    
    return new Promise((resolve, reject) => {
      let finalResponse = '';
      let accumulatedText = '';
      
      this.asking(question).subscribe({
        next: (event) => {
          switch (event.type) {
            case 'text':
              // For Telegram, we buffer text and send in chunks
              accumulatedText += event.data.delta;
              break;
            case 'complete':
              finalResponse = event.data.finalResponse;
              // Send final accumulated text if any
              if (accumulatedText.trim()) {
                this.sendBufferedMessage(accumulatedText);
              }
              break;
          }
        },
        complete: () => {
          // Flush any remaining messages
          this.flushMessageBuffer();
          resolve(finalResponse || accumulatedText);
        },
        error: (error) => {
          this.sendBufferedMessage(`❌ Ошибка: ${error.message}`);
          reject(error);
        }
      });
    });
  }

  // Force flush any pending messages
  async flush(): Promise<void> {
    await this.flushMessageBuffer();
  }
}

/**
 * Creates or retrieves a Telegram Ask instance for a specific user
 */
export function defineTelegramAsk(
  userId: number,
  chatId: number,
  botToken: string,
  openRouterToken: string,
  projectName: string = 'Telegram Bot',
  askOptions: TelegramAskOptions = {}
): TelegramAskWrapper {
  const instanceKey = `${userId}_${chatId}`;
  
  let instance = instances.get(instanceKey);
  
  if (!instance) {
    debug(`Creating new TelegramAsk instance for user ${userId}, chat ${chatId}`);
    
    // Create system prompt for Telegram bot
    const systemPrompt = `You are an AI assistant for the "${projectName}" project via Telegram.

We are working together through Telegram messages. When we need to execute code, analyze data, or perform operations, we work as a team.

**Communication Guidelines:**
- Always use "we" when referring to our work together ("we implemented", "we will try", "we observed", "we succeeded", "we agree", "we made a mistake")
- Execute code ONLY when calculations, demonstrations, or verification are actually needed
- For simple questions, conversations, or general knowledge - respond directly without code execution
- Keep responses concise and focused for Telegram format
- Use proper error handling and provide helpful explanations
- Remember this is a Telegram conversation - format responses appropriately

**Important:** Don't separate yourself from the user - we are working together as a team. Only execute code when it's actually necessary to answer the question.`;

    const ask = new TelegramAskWrapper(
      openRouterToken,
      chatId,
      botToken,
      {}, // context
      {
        model: 'google/gemini-2.5-flash-preview',
        temperature: 0.1,
        max_tokens: 2048
      }, // options
      systemPrompt,
      {
        exec: true,
        execTs: true,
        terminal: true,
        telegram: {
          botToken,
          chatId,
          bufferTime: 1000,
          maxMessageLength: 4096,
          enableCodeBlocks: true
        },
        ...askOptions
      }
    );

    instance = {
      ask,
      lastActivity: new Date(),
      chatId,
      userId
    };

    instances.set(instanceKey, instance);
    
    // Cleanup old instances (older than 1 hour)
    cleanupOldInstances();
  } else {
    // Update last activity
    instance.lastActivity = new Date();
    debug(`Retrieved existing TelegramAsk instance for user ${userId}, chat ${chatId}`);
  }

  return instance.ask;
}

/**
 * Cleanup instances older than 1 hour to prevent memory leaks
 */
function cleanupOldInstances(): void {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  for (const [key, instance] of instances.entries()) {
    if (instance.lastActivity < oneHourAgo) {
      debug(`Cleaning up old instance: ${key}`);
      instances.delete(key);
    }
  }
}

/**
 * Get statistics about active instances
 */
export function getTelegramAskStats(): {
  totalInstances: number;
  instancesByAge: { key: string; userId: number; chatId: number; ageMinutes: number }[];
} {
  const now = new Date();
  const instancesByAge = Array.from(instances.entries()).map(([key, instance]) => ({
    key,
    userId: instance.userId,
    chatId: instance.chatId,
    ageMinutes: Math.floor((now.getTime() - instance.lastActivity.getTime()) / (1000 * 60))
  }));

  return {
    totalInstances: instances.size,
    instancesByAge: instancesByAge.sort((a, b) => a.ageMinutes - b.ageMinutes)
  };
}

/**
 * Force cleanup all instances (useful for testing or maintenance)
 */
export function clearAllTelegramAskInstances(): void {
  debug(`Clearing all ${instances.size} instances`);
  instances.clear();
}

/**
 * Wraps any Ask class to work with Telegram
 * Creates a factory function that returns TelegramAskWrapper instances
 */
export function wrapTelegramAsk<T extends typeof AskHasyx>(
  AskClass: T,
  chatId: number,
  botToken: string,
  telegramOptions: Partial<TelegramConfig> = {}
): new (token: string, context?: any, options?: any, systemPrompt?: string, askOptions?: TelegramAskOptions) => TelegramAskWrapper {
  
  const fullTelegramOptions: Required<TelegramConfig> = {
    botToken,
    chatId,
    bufferTime: telegramOptions.bufferTime || 1000,
    maxMessageLength: telegramOptions.maxMessageLength || 4096,
    enableCodeBlocks: telegramOptions.enableCodeBlocks !== false
  };

  return class TelegramWrappedAsk extends TelegramAskWrapper {
    constructor(
      token: string,
      context: any = {},
      options: any = {},
      systemPrompt?: string,
      askOptions: TelegramAskOptions = {}
    ) {
      // Merge telegram options
      const mergedAskOptions: TelegramAskOptions = {
        ...askOptions,
        telegram: {
          botToken: fullTelegramOptions.botToken,
          chatId: fullTelegramOptions.chatId,
          bufferTime: askOptions.telegram?.bufferTime || fullTelegramOptions.bufferTime,
          maxMessageLength: askOptions.telegram?.maxMessageLength || fullTelegramOptions.maxMessageLength,
          enableCodeBlocks: askOptions.telegram?.enableCodeBlocks !== undefined 
            ? askOptions.telegram.enableCodeBlocks 
            : fullTelegramOptions.enableCodeBlocks
        }
      };

      super(
        token,
        chatId,
        botToken,
        context,
        options,
        systemPrompt,
        mergedAskOptions
      );
    }
  };
} 