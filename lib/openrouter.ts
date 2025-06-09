import { Exec, ExecContext } from './exec';

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
  systemPrompt?: string;
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
  private defaultOptions: OpenRouterOptions = {
    model: 'google/gemini-2.5-flash-preview',
    temperature: 0.7,
    max_tokens: 4096,
    top_p: 1,
    top_k: 0,
    frequency_penalty: 0,
    presence_penalty: 0,
    stream: false
  };
  public context: ExecContext;
  private execInstance: Exec;
  private token: string;
  private options: OpenRouterOptions;

  constructor(
    token: string, 
    context: ExecContext = {}, 
    options: OpenRouterOptions = {}
  ) {
    if (!token) {
      throw new Error('OpenRouter API token is required');
    }

    this.token = token;
    this.options = { ...this.defaultOptions, ...options };
    this.context = { ...context };
    this.execInstance = new Exec({ initialContext: this.context });
  }

  /**
   * Send a message or array of messages to the AI
   */
  async ask(
    messages: string | OpenRouterMessage | OpenRouterMessage[],
    options: OpenRouterOptions = {}
  ): Promise<string> {
    const finalOptions = { ...this.options, ...options };
    
    // Normalize messages to array format
    let normalizedMessages: OpenRouterMessage[];
    
    if (typeof messages === 'string') {
      normalizedMessages = [{ role: 'user', content: messages }];
    } else if (Array.isArray(messages)) {
      normalizedMessages = messages;
    } else {
      normalizedMessages = [messages];
    }

    // Add system prompt if it exists in options
    if (finalOptions.systemPrompt && !normalizedMessages.some(m => m.role === 'system')) {
      normalizedMessages.unshift({ role: 'system', content: finalOptions.systemPrompt });
    }

    try {
      // Simple fetch implementation since AI SDK is not available
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/ivansglazunov/hasyx',
          'X-Title': 'Hasyx Framework'
        },
        body: JSON.stringify({
          model: finalOptions.model,
          messages: normalizedMessages,
          temperature: finalOptions.temperature,
          max_tokens: finalOptions.max_tokens,
          top_p: finalOptions.top_p,
          top_k: finalOptions.top_k,
          frequency_penalty: finalOptions.frequency_penalty,
          presence_penalty: finalOptions.presence_penalty,
          tools: finalOptions.tools,
          tool_choice: finalOptions.tool_choice,
          response_format: finalOptions.response_format,
          user: finalOptions.user
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: OpenRouterResponse = await response.json();
      
      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response choices returned');
      }

      return data.choices[0].message?.content || 'No response generated';
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`OpenRouter API error: ${errorMessage}`);
    }
  }

  /**
   * Send a message or array of messages to the AI with streaming support
   */
  async askStream(
    messages: string | OpenRouterMessage | OpenRouterMessage[],
    options: OpenRouterOptions = {}
  ): Promise<ReadableStream<string>> {
    const finalOptions = { ...this.options, ...options, stream: true };
    
    // Normalize messages to array format
    let normalizedMessages: OpenRouterMessage[];
    
    if (typeof messages === 'string') {
      normalizedMessages = [{ role: 'user', content: messages }];
    } else if (Array.isArray(messages)) {
      normalizedMessages = messages;
    } else {
      normalizedMessages = [messages];
    }

    // Add system prompt if it exists in options
    if (finalOptions.systemPrompt && !normalizedMessages.some(m => m.role === 'system')) {
      normalizedMessages.unshift({ role: 'system', content: finalOptions.systemPrompt });
    }

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/ivansglazunov/hasyx',
          'X-Title': 'Hasyx Framework'
        },
        body: JSON.stringify({
          model: finalOptions.model,
          messages: normalizedMessages,
          temperature: finalOptions.temperature,
          max_tokens: finalOptions.max_tokens,
          top_p: finalOptions.top_p,
          top_k: finalOptions.top_k,
          frequency_penalty: finalOptions.frequency_penalty,
          presence_penalty: finalOptions.presence_penalty,
          tools: finalOptions.tools,
          tool_choice: finalOptions.tool_choice,
          response_format: finalOptions.response_format,
          user: finalOptions.user,
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      // Create a ReadableStream that parses SSE and extracts content
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
              
              // Process complete lines
              let lines = buffer.split('\n');
              buffer = lines.pop() || ''; // Keep incomplete line in buffer

              for (const line of lines) {
                const trimmedLine = line.trim();
                
                // Skip empty lines and comments
                if (!trimmedLine || trimmedLine.startsWith(':')) {
                  continue;
                }

                if (trimmedLine.startsWith('data: ')) {
                  const data = trimmedLine.slice(6);
                  
                  // Check for end marker
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
                  } catch (error) {
                    // Skip invalid JSON chunks
                    continue;
                  }
                }
              }

              return pump();
            }).catch(error => {
              controller.error(error);
            });
          }

          return pump();
        }
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`OpenRouter stream error: ${errorMessage}`);
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
   * Update the OpenRouter options
   */
  updateOptions(updates: OpenRouterOptions): void {
    this.options = { ...this.options, ...updates };
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