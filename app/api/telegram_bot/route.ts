import { generateTelegramHandler } from 'hasyx/lib/ai/telegram';
import { ExecJSTool } from 'hasyx/lib/ai/tools/exec-js-tool';
import { TerminalTool } from 'hasyx/lib/ai/tools/terminal-tool';
import { Tool } from 'hasyx/lib/ai/tool';

const getSystemPrompt = (tools: Tool[]) => `
You are a powerful AI assistant. Your primary goal is to achieve user requests by executing commands.
You have access to the following tools:
${tools.map(t => `- ${t.name}: ${t.contextPreprompt}`).join('\n')}

**Process:**
1.  **Analyze the user's request.**
2.  **Select the most appropriate tool.**
3.  **Formulate the command and content for the tool.**
4.  **Execute the tool using the format: > 😈<uuid>/<tool_name>/<command>**
5.  **Review the tool's output.**
6.  **If the task is complete, provide the final answer. If not, continue using tools until the goal is achieved.**

**IMPORTANT:**
- Directly execute commands whenever possible. Do not ask for permission.
- Do not explain that you are an AI. Focus on completing the task.
- Provide concise and direct answers based on the tool output.
`;

const handleTelegram = generateTelegramHandler({
  tools: [new ExecJSTool(), new TerminalTool()],
  getSystemPrompt,
});

export async function POST(request: Request) {
  return handleTelegram(request);
} 