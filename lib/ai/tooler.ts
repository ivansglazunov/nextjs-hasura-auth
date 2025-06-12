import { Tool, ToolResult, FoundToolCall } from './tool';
export type { FoundToolCall };

type EventHandler<T> = (data: T) => void;

export interface ToolerOptions {
  tools: Tool[];
  onHandle?: EventHandler<FoundToolCall>;
  onHandled?: EventHandler<ToolResult>;
  onLog?: EventHandler<any>; // Define a more specific log type later
}

export class Tooler {
  private tools: Map<string, Tool> = new Map();
  private history: Set<string> = new Set();

  // Event Handlers
  private onHandle?: EventHandler<FoundToolCall>;
  private onHandled?: EventHandler<ToolResult>;
  public onLog?: EventHandler<any>;

  constructor(options: ToolerOptions) {
    options.tools.forEach(tool => {
      this.tools.set(tool.name, tool);
    });
    this.onHandle = options.onHandle;
    this.onHandled = options.onHandled;
    this.onLog = options.onLog;
  }

  public getFullContextPreprompt(): string {
    let preprompt = '';
    for (const tool of this.tools.values()) {
      preprompt += tool.contextPreprompt + '\n\n';
    }
    return preprompt;
  }

  public findToolCalls(response: string): FoundToolCall[] {
    const foundCalls: FoundToolCall[] = [];
    const regex = />\s*😈([^/]+)\/([^/]+)\/([^/\n]+)\s*\n\`\`\`[a-z]*\s*([\s\S]*?)\`\`\`/g;

    let match;
    while ((match = regex.exec(response)) !== null) {
      const [fullMatch, id, toolName, command, content] = match;

      const tool = this.tools.get(toolName);
      if (tool) {
        foundCalls.push({
          id,
          tool,
          command: command.trim(),
          content: content.trim(),
          fullMatch
        });
      }
    }
    return foundCalls;
  }

  public async call(response: string): Promise<void> {
    const calls = this.findToolCalls(response);

    for (const call of calls) {
      if (this.history.has(call.id)) {
        // Already executed, skip
        continue;
      }

      this.history.add(call.id);

      if (this.onHandle) {
        this.onHandle(call);
      }

      try {
        const result = await call.tool.execute(call.command, call.content, this);
        if (this.onHandled) {
          this.onHandled({ ...result, id: call.id });
        }
      } catch (error) {
        const result: ToolResult = {
          id: call.id,
          result: null,
          error: error instanceof Error ? error.message : String(error)
        };
        if (this.onHandled) {
          this.onHandled(result);
        }
      }
    }
  }
} 