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
    
    // Simple output handlers for Telegram (we handle most logic in overridden methods)
    const outputHandlers: OutputHandlers = {
      onWelcome: async (enabledEngines: string[]) => {
        await this.sendBufferedMessage('🤖 Добро пожаловать в Hasyx AI Telegram Bot!');
        if (enabledEngines.length > 0) {
          await this.sendBufferedMessage(`😈 Доступны движки: ${enabledEngines.join(', ')}`);
        }
        await this.sendBufferedMessage('Задавайте любые вопросы, я отвечу со стримингом!');
      },
      onGoodbye: () => this.sendBufferedMessage('👋 До свидания!')
    };

    // Remove telegram options from askOptions to avoid passing to parent
    const { telegram, ...cleanAskOptions } = askOptions;

    super({
      token,
      context,
      ...options,
      systemPrompt,
      askOptions: cleanAskOptions,
      outputHandlers,
    });

    this.chatId = chatId;
    this.botToken = botToken;
    this.bufferTime = telegramOptions.bufferTime || 1000;
    this.maxMessageLength = telegramOptions.maxMessageLength || 4096;
    this.enableCodeBlocks = telegramOptions.enableCodeBlocks !== false;

    debug(`TelegramAskWrapper created for chat ${chatId}`);
  }

  // Override defaultOutput to use our Telegram message system
  protected defaultOutput(message: string): void {
    this.sendBufferedMessage(message);
  }

  // Override defaultError to use our Telegram message system  
  protected defaultError(error: string): void {
    this.sendBufferedMessage(`❌ ${error}`);
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

  // Override askWithBeautifulOutput to handle final text properly for Telegram
  async askWithBeautifulOutput(question: string): Promise<string> {
    debug(`Processing question with Telegram output for chat ${this.chatId}:`, question);
    
    return new Promise((resolve, reject) => {
      let accumulatedText = '';
      let finalResponse = '';
      
      // Add timeout for AI operations (3 minutes instead of 5 for faster restart)
      const timeout = setTimeout(() => {
        this.defaultError('⏰ AI operation timed out. Please try a simpler question or try again later.');
        this.defaultOutput(`🔧 Debug: Container ${process.env.HOSTNAME || 'unknown'} timeout after 3 minutes`);
        reject(new Error('AI operation timeout'));
      }, 3 * 60 * 1000);
      
      // Track if we have any pending code execution
      let pendingCodeExecution = 0;
      let operationStartTime = Date.now();
      
      this.asking(question).subscribe({
        next: (event) => {
          switch (event.type) {
            case 'thinking':
              this.defaultOutput('🧠 AI думает...');
              this.defaultOutput(`🔧 Debug: Container ${process.env.HOSTNAME || 'unknown'}, Started: ${new Date().toISOString()}`);
              break;
              
            case 'iteration':
              if (event.data.iteration > 1) {
                this.defaultOutput(`🔄 Итерация ${event.data.iteration}: ${event.data.reason}`);
                this.defaultOutput(`⏱️ Runtime: ${Math.round((Date.now() - operationStartTime) / 1000)}s`);
              }
              break;
              
            case 'text':
              // Accumulate text but don't send yet
              accumulatedText += event.data.delta;
              break;
              
            case 'code_found':
              // Send accumulated text before showing code block
              if (accumulatedText.trim()) {
                this.defaultOutput(accumulatedText);
                accumulatedText = ''; // Reset after sending
              }
              this.defaultOutput(`📋 Найден ${event.data.format.toUpperCase()} код для выполнения:`);
              const displayFormat = event.data.format === 'terminal' ? 'bash' : event.data.format;
              this.defaultOutput(`\`\`\`${displayFormat}\n${event.data.code}\n\`\`\``);
              break;
              
            case 'code_executing':
              pendingCodeExecution++;
              this.defaultOutput(`⚡ Выполняется ${event.data.format.toUpperCase()} код...`);
              this.defaultOutput(`🔧 Debug: Execution engine ${event.data.format}, Container ${process.env.HOSTNAME || 'unknown'}`);
              break;
              
            case 'code_result':
              pendingCodeExecution = Math.max(0, pendingCodeExecution - 1);
              const status = event.data.success ? '✅' : '❌';
              this.defaultOutput(`${status} Результат выполнения:`);
              this.defaultOutput(`\`\`\`\n${event.data.result}\n\`\`\``);
              
              // Отправляем debug info в Telegram вместо логов
              if (!event.data.success) {
                this.defaultOutput(`🔧 Debug: Execution failed, Container ${process.env.HOSTNAME || 'unknown'}, Runtime: ${Math.round((Date.now() - operationStartTime) / 1000)}s`);
              }
              break;
              
            case 'complete':
              finalResponse = event.data.finalResponse;
              const totalTime = Math.round((Date.now() - operationStartTime) / 1000);
              this.defaultOutput(`💭 Завершено (${event.data.iterations} итераций, ${totalTime}s)`);
              this.defaultOutput(`🔧 Debug: Container ${process.env.HOSTNAME || 'unknown'}, Execution results: ${event.data.executionResults.length}`);
              break;
              
            case 'error':
              this.defaultError(`❌ Ошибка в итерации ${event.data.iteration}: ${event.data.error.message}`);
              this.defaultOutput(`🔧 Debug: Container ${process.env.HOSTNAME || 'unknown'}, Error stack: ${event.data.error.stack || 'No stack'}`);
              break;
          }
        },
        complete: async () => {
          try {
            clearTimeout(timeout);
            
            // Check if we have pending code executions
            if (pendingCodeExecution > 0) {
              this.defaultOutput(`⚠️ Внимание: ${pendingCodeExecution} операций кода все еще выполняются в фоне.`);
              this.defaultOutput(`🔧 Debug: Pending executions may cause issues on container restart`);
            }
            
            // Send final accumulated text if any (this replaces printMarkdown)
            if (accumulatedText.trim()) {
              this.defaultOutput(accumulatedText);
            }
            
            const totalTime = Math.round((Date.now() - operationStartTime) / 1000);
            this.defaultOutput(`ℹ️ Сессия завершена. Время: ${totalTime}s, Container: ${process.env.HOSTNAME || 'unknown'}`);
            
            // Flush any remaining messages
            await this.flushMessageBuffer();
            resolve(finalResponse || accumulatedText);
          } catch (error) {
            this.defaultOutput(`🔧 Debug: Error in completion handler: ${error instanceof Error ? error.message : 'Unknown'}`);
            reject(error);
          }
        },
        error: (error) => {
          clearTimeout(timeout);
          this.defaultError(`Ошибка стриминга: ${error.message}`);
          this.defaultOutput(`🔧 Debug: Streaming error in Container ${process.env.HOSTNAME || 'unknown'}: ${error.stack || 'No stack'}`);
          reject(error);
        }
      });
    });
  }

  // Override ask method to use our Telegram-specific askWithBeautifulOutput
  async ask(question: string): Promise<string> {
    debug(`Processing question for chat ${this.chatId}:`, question);
    return await this.askWithBeautifulOutput(question);
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
    const systemPrompt = `[SESSION ${Date.now()}] You are an AI assistant for the "${projectName}" project via Telegram.

We are working together through Telegram messages. When we need to execute code, analyze data, or perform operations, we work as a team.

**Communication Guidelines:**
- Always use "we" when referring to our work together ("we implemented", "we will try", "we observed", "we succeeded", "we agree", "we made a mistake")
- Execute code ONLY when calculations, demonstrations, or verification are actually needed
- For simple questions, conversations, or general knowledge - respond directly without code execution
- Keep responses concise and focused for Telegram format
- Use proper error handling and provide helpful explanations
- Remember this is a Telegram conversation - format responses appropriately

**IMPORTANT CODE EXECUTION RULES:**
- When you need to execute JavaScript, you MUST use the exact format: > 😈<uuid>/do/exec/js followed by \`\`\`js
- When you need to execute TypeScript, you MUST use the exact format: > 😈<uuid>/do/exec/tsx followed by \`\`\`tsx
- When you need to execute terminal commands, you MUST use the exact format: > 😈<uuid>/do/terminal/bash followed by \`\`\`bash
- NEVER use \`\`\`javascript or \`\`\`typescript or \`\`\`terminal - always use the exact formats above
- Always generate a unique UUID for each operation (use crypto.randomUUID() pattern)
- Only execute code when it's actually necessary to answer the question

**Examples:**
> 😈calc-123e4567-e89b-12d3-a456-426614174000/do/exec/js
\`\`\`js
2 + 2
\`\`\`

> 😈types-123e4567-e89b-12d3-a456-426614174001/do/exec/tsx
\`\`\`tsx
interface User { id: number; name: string }
const user: User = { id: 1, name: "John" };
user
\`\`\`

> 😈cmd-123e4567-e89b-12d3-a456-426614174002/do/terminal/bash
\`\`\`bash
echo "Hello World"
\`\`\`

**Important:** Don't separate yourself from the user - we are working together as a team. Only execute code when it's actually necessary to answer the question.`;

    const ask = new TelegramAskWrapper(
      openRouterToken,
      chatId,
      botToken,
      {}, // context
      {
        model: 'google/gemini-2.5-flash-preview',
        temperature: 0.1,
        max_tokens: 2048,
        user: `telegram_${userId}` // Unique user ID for OpenRouter to prevent caching conflicts
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

    // ВАЖНО: Устанавливаем обработчик выполнения кода
    ask._do = async (doItem) => {
      try {
        const { execDo } = await import('hasyx/lib/exec');
        const { execTsDo } = await import('hasyx/lib/exec-tsx');
        const { terminalDo } = await import('hasyx/lib/terminal');
        
        let result: string;
        if (doItem.format === 'js') {
          result = await execDo.exec(doItem.request);
        } else if (doItem.format === 'tsx') {
          result = await execTsDo.exec(doItem.request);
        } else if (doItem.format === 'terminal') {
          result = await terminalDo.exec(doItem.request);
        } else {
          throw new Error(`Unsupported execution format: ${doItem.format}`);
        }
        
        doItem.response = String(result);
        debug(`Code execution completed for ${doItem.id}: ${String(result).substring(0, 100)}...`);
        
        return doItem;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        doItem.response = `Error: ${errorMessage}`;
        debug(`Code execution failed for ${doItem.id}: ${errorMessage}`);
        
        return doItem;
      }
    };

    // Очищаем память для свежего старта (важно для предотвращения "памяти" между контейнерами)
    ask.clearMemory();
    ask.clearResults();

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
    
    // Для уже существующего экземпляра тоже очищаем память, если она слишком большая
    const memorySize = instance.ask.getMemory().length;
    if (memorySize > 20) { // Если больше 20 сообщений, очищаем
      debug(`Clearing memory for user ${userId} (${memorySize} messages)`);
      instance.ask.clearMemory();
      instance.ask.clearResults();
    }
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
 * Force cleanup and restart all instances (useful for container restarts)
 */
export function resetAllTelegramAskInstances(): void {
  debug(`Resetting all ${instances.size} instances`);
  
  // Clear memory and results for all instances
  for (const [key, instance] of instances.entries()) {
    try {
      instance.ask.clearMemory();
      instance.ask.clearResults();
      debug(`Cleared memory for instance: ${key}`);
    } catch (error) {
      debug(`Error clearing memory for instance ${key}:`, error);
    }
  }
  
  // Clear the instances map
  instances.clear();
  debug('All instances reset and cleared');
}

/**
 * Auto-cleanup function that should be called on container startup
 */
export function initializeTelegramAsk(): void {
  debug('Initializing Telegram Ask system...');
  
  // Force clear all instances on startup to prevent "memory" between container restarts
  resetAllTelegramAskInstances();
  
  // Set up periodic cleanup
  setInterval(() => {
    cleanupOldInstances();
    debug(`Periodic cleanup complete. Active instances: ${instances.size}`);
  }, 30 * 60 * 1000); // Every 30 minutes
  
  debug('Telegram Ask system initialized');
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