import { Tooler } from '../tooler';
import { ExecJSTool } from './exec-js-tool';
import { ExecTSXTool } from './exec-tsx-tool';
import { TerminalTool } from './terminal-tool';
import { ToolResult } from '../tool';

describe('Tools Integration with Tooler', () => {

  it('should execute JavaScript via ExecJSTool', async () => {
    const jsTool = new ExecJSTool();
    let handledResult: any;

    const tooler = new Tooler({
      tools: [jsTool],
      onHandled: (result) => { handledResult = result; }
    });

    const aiResponse = `> 😈test-js/javascript/exec\n\`\`\`js\nreturn 5 + 3;\n\`\`\``;
    await tooler.call(aiResponse);

    expect(handledResult?.id).toBe('test-js');
    expect(handledResult?.result).toBe(8);
    expect(handledResult?.error).toBeUndefined();
  });

  it('should execute TypeScript via ExecTSXTool', async () => {
    const tsxTool = new ExecTSXTool();
    let handledResult: any;

    const tooler = new Tooler({
      tools: [tsxTool],
      onHandled: (result) => { handledResult = result; }
    });

    const aiResponse = `> 😈test-ts/typescript/exec\n\`\`\`tsx\nconst x: number = 10; return x * 2;\n\`\`\``;
    await tooler.call(aiResponse);

    expect(handledResult?.id).toBe('test-ts');
    expect(handledResult?.result).toBe(20);
    expect(handledResult?.error).toBeUndefined();
  });

  it('should execute terminal commands via TerminalTool', async () => {
    const terminalTool = new TerminalTool();
    let handledResult: any;

    const tooler = new Tooler({
      tools: [terminalTool],
      onHandled: (result) => { handledResult = result; }
    });

    const aiResponse = `> 😈test-terminal/terminal/exec\n\`\`\`bash\necho "Hello from terminal"\n\`\`\``;
    await tooler.call(aiResponse);

    expect(handledResult?.id).toBe('test-terminal');
    expect(handledResult?.result.trim()).toBe("Hello from terminal");
    expect(handledResult?.error).toBeUndefined();
  });

  it('should handle logs from tools', async () => {
    const jsTool = new ExecJSTool();
    const logs: any[] = [];

    const tooler = new Tooler({
      tools: [jsTool],
      onLog: (log) => { logs.push(log); }
    });

    const aiResponse = `> 😈test-log/javascript/exec\n\`\`\`js\nconsole.log("first"); console.warn("second");\n\`\`\``;
    await tooler.call(aiResponse);

    expect(logs.length).toBe(2);
    expect(logs[0].level).toBe('log');
    expect(logs[0].args).toEqual(['first']);
    expect(logs[1].level).toBe('warn');
    expect(logs[1].args).toEqual(['second']);
  });
}); 