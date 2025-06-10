import { Tooler } from './tooler';
import { Tool, ToolOptions, ToolResult } from './tool';

// Mock Tool for testing
class MockTool extends Tool {
  constructor(options: ToolOptions) {
    super(options);
  }

  async execute(command: string, content: string, tooler: any): Promise<ToolResult> {
    if (content === 'throw error') {
      throw new Error('Test error from tool');
    }
    return {
      id: 'mock-result-id', // This id is internal to the tool, Tooler will use the call id
      result: `Executed '${this.name}' with command '${command}' and content '${content}'`
    };
  }
}

describe('Tooler Class', () => {
  it('should initialize and generate full context preprompt', () => {
    const tool1 = new MockTool({ name: 'js', contextPreprompt: 'JS Tool Preprompt' });
    const tool2 = new MockTool({ name: 'ts', contextPreprompt: 'TS Tool Preprompt' });
    const tooler = new Tooler({ tools: [tool1, tool2] });

    const preprompt = tooler.getFullContextPreprompt();
    expect(preprompt).toContain('JS Tool Preprompt');
    expect(preprompt).toContain('TS Tool Preprompt');
  });

  it('should find and call a tool, triggering correct event handlers', async () => {
    const tool = new MockTool({ name: 'javascript', contextPreprompt: '...' });

    let handledCall: any = null;
    let handledResult: any = null;

    const tooler = new Tooler({
      tools: [tool],
      onHandle: (call) => { handledCall = call; },
      onHandled: (result) => { handledResult = result; }
    });

    const aiResponse = `
Some text before.
> 😈test-uuid-1/javascript/exec
\`\`\`
console.log("hello");
\`\`\`
Some text after.
        `;

    await tooler.call(aiResponse);

    expect(handledCall?.id).toBe('test-uuid-1');
    expect(handledCall?.command).toBe('exec');
    expect(handledCall?.content).toBe('console.log("hello");');

    expect(handledResult?.id).toBe('test-uuid-1');
    expect(handledResult?.result).toBe("Executed 'javascript' with command 'exec' and content 'console.log(\"hello\");'");
  });

  it('should not execute a tool with the same UUID twice', async () => {
    const tool = new MockTool({ name: 'javascript', contextPreprompt: '...' });

    let handleCount = 0;
    const tooler = new Tooler({
      tools: [tool],
      onHandle: () => { handleCount++; }
    });

    const aiResponse = `
> 😈test-uuid-2/javascript/exec
\`\`\`
code
\`\`\`
        `;

    await tooler.call(aiResponse);
    await tooler.call(aiResponse);

    expect(handleCount).toBe(1);
  });

  it('should handle errors during tool execution gracefully', async () => {
    const tool = new MockTool({ name: 'javascript', contextPreprompt: '...' });
    let handledResult: any = null;

    const tooler = new Tooler({
      tools: [tool],
      onHandled: (result) => { handledResult = result; }
    });

    const aiResponse = `
> 😈test-uuid-3/javascript/exec
\`\`\`
throw error
\`\`\`
        `;

    await tooler.call(aiResponse);

    expect(handledResult?.id).toBe('test-uuid-3');
    expect(handledResult?.result).toBeNull();
    expect(handledResult?.error).toBe('Test error from tool');
  });

  it('should handle complex history and multiple calls correctly', async () => {
    const tool = new MockTool({ name: 'javascript', contextPreprompt: '...' });

    let handleCount = 0;
    const handledIds: string[] = [];

    const tooler = new Tooler({
      tools: [tool],
      onHandle: (call) => {
        handleCount++;
        handledIds.push(call.id);
      }
    });

    const aiResponse1 = `
> 😈uuid-a/javascript/exec
\`\`\`
code A
\`\`\`
> 😈uuid-b/javascript/exec
\`\`\`
code B
\`\`\`
        `;

    const aiResponse2 = `
> 😈uuid-a/javascript/exec
\`\`\`
code A
\`\`\`
> 😈uuid-b/javascript/exec
\`\`\`
code B
\`\`\`
> 😈uuid-c/javascript/exec
\`\`\`
code C
\`\`\`
        `;

    await tooler.call(aiResponse1);
    expect(handleCount).toBe(2);

    await tooler.call(aiResponse2);
    expect(handleCount).toBe(3);

    await tooler.call(aiResponse2);
    expect(handleCount).toBe(3);

    expect(handledIds.sort()).toEqual(['uuid-a', 'uuid-b', 'uuid-c'].sort());
  });
}); 