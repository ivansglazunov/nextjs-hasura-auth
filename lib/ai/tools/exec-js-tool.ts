import { Tool, ToolOptions, ToolResult } from '../tool';
import { execDo, ExecResult as InternalExecResult } from '../../../lib/exec';

const contextPreprompt = `📦 **JavaScript Execution Environment (javascript)**

Execute JavaScript code using Node.js VM.

Format: > 😈<uuid>/javascript/exec
Example: > 😈calc-123/javascript/exec`;

export class ExecJSTool extends Tool {
  constructor(options: {} = {}) {
    super({
      name: 'javascript',
      contextPreprompt: contextPreprompt
    });
  }

  async execute(command: string, content: string, tooler: any): Promise<ToolResult> {
    let execResult: InternalExecResult;

    if (command.trim() !== 'exec') {
      throw new Error(`Unknown command for ExecJSTool: ${command}`);
    }

    try {
      execResult = await execDo.exec(content);

      if (tooler.onLog && execResult.logs) {
        execResult.logs.forEach(log => tooler.onLog(log));
      }

      return {
        id: 'not_used', // ID is handled by Tooler
        result: execResult.result
      };

    } catch (error) {
      return {
        id: 'not_used',
        result: null,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
} 