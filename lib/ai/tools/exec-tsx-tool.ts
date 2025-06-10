import { Tool, ToolResult } from '../tool';
import { execTsDo } from '../../../lib/exec-tsx';
import { ExecResult as InternalExecResult } from '../../../lib/exec';

const contextPreprompt = `
📦 **TypeScript/TSX Execution Environment (typescript)**

You can execute TypeScript and TSX code.

**Execution Format:**
> 😈<uuid>/typescript/exec
\`\`\`tsx
// your typescript code here
// The last expression is automatically returned.
\`\`\`

**Example:**
> 😈types-123/typescript/exec
\`\`\`tsx
interface User { id: number; name: string; }
const user: User = { id: 1, name: "John" };
user;
\`\`\`
`;

export class ExecTSXTool extends Tool {
  constructor(options: {} = {}) {
    super({
      name: 'typescript',
      contextPreprompt: contextPreprompt
    });
  }

  async execute(command: string, content: string, tooler: any): Promise<ToolResult> {
    if (command !== 'exec') {
      throw new Error(`Unknown command for ExecTSXTool: ${command}`);
    }

    try {
      const execResult: InternalExecResult = await execTsDo.exec(content);

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