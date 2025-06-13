import { Tool, ToolResult } from '../tool';
import { terminalDo } from '../../../lib/terminal';
import { ExecResult as InternalExecResult } from '../../../lib/exec';
import Debug from '../../debug';

const debug = Debug('hasyx:terminal-tool');

const contextPreprompt = `📦 **Terminal Execution Environment (terminal)**

Execute shell commands in terminal.

Format: > 😈<uuid>/terminal/exec
Example: > 😈ls-123/terminal/exec`;

export class TerminalTool extends Tool {
  private timeout: number;

  constructor(options: { timeout?: number } = {}) {
    super({
      name: 'terminal',
      contextPreprompt: contextPreprompt
    });
    this.timeout = options.timeout !== undefined ? options.timeout : 30000; // 30 seconds default, 0 = no timeout
    debug('TerminalTool initialized with timeout: %d ms', this.timeout);
  }

  async execute(command: string, content: string, tooler: any): Promise<ToolResult> {
    if (command.trim() !== 'exec') {
      throw new Error(`Unknown command for TerminalTool: ${command}`);
    }

    debug('Executing terminal command with timeout %d: %s', this.timeout, content);

    try {
      // Create terminal with configured timeout
      const terminal = new (await import('../../../lib/terminal')).Terminal({ 
        commandTimeout: this.timeout,
        autoStart: false 
      });
      
      let result: string;
      try {
        await terminal.start();
        result = await terminal.execute(content);
      } finally {
        terminal.destroy();
      }

      debug('Terminal command successful, result length: %d', result.length);
      
      return {
        id: 'not_used',
        result: result
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      debug('Terminal command failed: %s', errorMessage);
      
      // Return error as result instead of null, so AI can see what went wrong
      return {
        id: 'not_used',
        result: `Command failed: ${errorMessage}`,
        error: errorMessage
      };
    }
  }
} 