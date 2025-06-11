export interface ToolResult {
  id: string;
  result: any;
  error?: string;
}

export interface FoundToolCall {
  id: string;      // uuid
  tool: Tool;
  command: string; // e.g., 'exec'
  content: string; // The code or command to execute
  fullMatch: string;
}

export interface ToolOptions {
  name: string;
  contextPreprompt: string;
}

export abstract class Tool {
  public name: string;
  public contextPreprompt: string;

  constructor(options: ToolOptions) {
    this.name = options.name;
    this.contextPreprompt = options.contextPreprompt;
  }

  abstract execute(command: string, content: string, tooler: any): Promise<ToolResult>;
} 