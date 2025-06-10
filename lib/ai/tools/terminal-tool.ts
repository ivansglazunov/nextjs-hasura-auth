import { Tool, ToolResult } from '../tool';
import { terminalDo } from '../../../lib/terminal';
import { ExecResult as InternalExecResult } from '../../../lib/exec';

const contextPreprompt = `
📦 **Terminal Execution Environment (terminal)**

You can execute shell commands in a terminal.

**Execution Format:**
> 😈<uuid>/terminal/exec
\`\`\`bash
# your shell command here
\`\`\`

**Example:**
> 😈ls-123/terminal/exec
\`\`\`bash
ls -la
\`\`\`
`;

export class TerminalTool extends Tool {
  constructor(options: {} = {}) {
    super({
      name: 'terminal',
      contextPreprompt: contextPreprompt
    });
  }

  async execute(command: string, content: string, tooler: any): Promise<ToolResult> {
    if (command !== 'exec') {
      throw new Error(`Unknown command for TerminalTool: ${command}`);
    }

    try {
      // terminalDo.exec returns a string, we need to wrap it
      const resultString: string = await terminalDo.exec(content, 'bash');
      const execResult: InternalExecResult = {
        result: resultString,
        logs: [] // terminalDo doesn't currently capture logs in the same way
      };

      if (tooler.onLog && execResult.logs) {
        execResult.logs.forEach(log => tooler.onLog(log));
      }

      return {
        id: 'not_used',
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