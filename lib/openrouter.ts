import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText, CoreMessage } from 'ai';
import { Exec, ExecContext } from 'hasyx';

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface OpenRouterTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: object;
  };
}

export interface OpenRouterOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  top_k?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
  tools?: OpenRouterTool[];
  tool_choice?: 'none' | 'auto' | { type: 'function'; function: { name: string } };
  response_format?: { type: 'json_object' };
  user?: string;
  timeout?: number;
}

export interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message?: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    delta?: {
      content: string | null;
      role?: string;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

export class OpenRouter {
  private client: any;
  private defaultOptions: OpenRouterOptions;
  public context: ExecContext;
  private execInstance: Exec;

  constructor(
    token: string, 
    context: ExecContext = {}, 
    options: OpenRouterOptions = {}
  ) {
    if (!token) {
      throw new Error('OpenRouter API token is required');
    }

    this.client = createOpenRouter({
      apiKey: token
    });

    this.defaultOptions = {
      model: 'deepseek/deepseek-chat-v3-0324:free',
      temperature: 0.7,
      max_tokens: 4096,
      timeout: 30000,
      ...options
    };

    this.context = { ...context };
    this.execInstance = new Exec(this.context);
  }

  /**
   * Send a message or array of messages to the AI
   */
  async ask(
    messages: string | OpenRouterMessage | OpenRouterMessage[],
    options: OpenRouterOptions = {}
  ): Promise<string> {
    const finalOptions = { ...this.defaultOptions, ...options };
    
    // Normalize messages to array format
    let normalizedMessages: CoreMessage[];
    
    if (typeof messages === 'string') {
      normalizedMessages = [{ role: 'user', content: messages }];
    } else if (Array.isArray(messages)) {
      normalizedMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        ...(msg.name && { name: msg.name }),
        ...(msg.tool_call_id && { toolCallId: msg.tool_call_id })
      })) as CoreMessage[];
    } else {
      normalizedMessages = [{
        role: messages.role,
        content: messages.content,
        ...(messages.name && { name: messages.name }),
        ...(messages.tool_call_id && { toolCallId: messages.tool_call_id })
      }] as CoreMessage[];
    }

    try {
      const model = this.client.chat(finalOptions.model);
      
      const response = await generateText({
        model,
        messages: normalizedMessages,
        temperature: finalOptions.temperature,
        maxTokens: finalOptions.max_tokens,
        topP: finalOptions.top_p,
        topK: finalOptions.top_k,
        frequencyPenalty: finalOptions.frequency_penalty,
        presencePenalty: finalOptions.presence_penalty
      });

      return response.text || 'No response generated';
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`OpenRouter API error: ${errorMessage}`);
    }
  }

  /**
   * Execute JavaScript code in the current context
   */
  async exec(code: string, contextExtend: ExecContext = {}): Promise<any> {
    try {
      // Merge current context with extensions
      const fullContext = { ...this.context, ...contextExtend };
      
      // Execute the code with full context
      const result = await this.execInstance.exec(code, fullContext);
      
      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Code execution error: ${errorMessage}`);
    }
  }

  /**
   * Create a conversation with code execution capabilities
   */
  async askWithExec(
    message: string,
    options: OpenRouterOptions = {}
  ): Promise<{ response: string; execResults?: Record<string, any> }> {
    const systemPrompt = `You are a helpful AI assistant with the ability to execute JavaScript code.

When you need to execute code, write it in a markdown code block with a special comment:

\`\`\`js
// exec:unique-id
your code here
\`\`\`

The code will be executed and results will be provided back to you. You can use these results to continue the conversation.

IMPORTANT:
- Each code block needs a unique ID after "exec:"
- Variables persist between executions
- You can use await at the top level
- The last expression in the code block will be returned
- Use console.log() for debugging output`;

    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ];

    let response = await this.ask(messages, options);
    const execResults: Record<string, any> = {};

    // Extract and execute code blocks
    const codeBlockRegex = /```js\s*\/\/\s*exec:([^\s]+)\s*([\s\S]*?)```/g;
    let match;
    let hasCodeBlocks = false;

    while ((match = codeBlockRegex.exec(response)) !== null) {
      hasCodeBlocks = true;
      const execId = match[1];
      const code = match[2].trim();

      try {
        console.log(`\n🧪 Executing code block [${execId}]:\n${code}`);
        const result = await this.exec(code);
        execResults[execId] = result;
        console.log(`\n📌 Result [${execId}]: ${JSON.stringify(result)}`);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        execResults[execId] = `Error: ${errorMessage}`;
        console.error(`\n❌ Error [${execId}]: ${errorMessage}`);
      }
    }

    // If we executed code, send results back to AI for final response
    if (hasCodeBlocks && Object.keys(execResults).length > 0) {
      const resultsMessage = `Code execution results:\n\`\`\`json\n${JSON.stringify(execResults, null, 2)}\n\`\`\``;
      
      messages.push({ role: 'assistant', content: response });
      messages.push({ role: 'user', content: resultsMessage });
      
      response = await this.ask(messages, options);
    }

    return { response, execResults: Object.keys(execResults).length > 0 ? execResults : undefined };
  }

  /**
   * Update the execution context
   */
  updateContext(updates: ExecContext): void {
    Object.assign(this.context, updates);
    this.execInstance.updateContext(updates);
  }

  /**
   * Get current execution context
   */
  getContext(): ExecContext {
    return { ...this.context };
  }

  /**
   * Clear execution context
   */
  clearContext(): void {
    this.context = {};
    this.execInstance.clearContext();
  }

  /**
   * Create a system message
   */
  static systemMessage(content: string): OpenRouterMessage {
    return { role: 'system', content };
  }

  /**
   * Create a user message
   */
  static userMessage(content: string): OpenRouterMessage {
    return { role: 'user', content };
  }

  /**
   * Create an assistant message
   */
  static assistantMessage(content: string): OpenRouterMessage {
    return { role: 'assistant', content };
  }

  /**
   * Create a tool message
   */
  static toolMessage(content: string, toolCallId: string, name?: string): OpenRouterMessage {
    return { role: 'tool', content, tool_call_id: toolCallId, name };
  }

  /**
   * Create a conversation from multiple messages
   */
  static conversation(...messages: (string | OpenRouterMessage)[]): OpenRouterMessage[] {
    return messages.map(msg => {
      if (typeof msg === 'string') {
        return { role: 'user', content: msg };
      }
      return msg;
    });
  }
} 