import { generateTelegramHandler } from 'hasyx/lib/ai/telegram';
import { ExecJSTool } from 'hasyx/lib/ai/tools/exec-js-tool';
import { TerminalTool } from 'hasyx/lib/ai/tools/terminal-tool';
import { Tool } from 'hasyx/lib/ai/tool';
import { createSystemPrompt } from 'hasyx/lib/ai/core-prompts';

const getSystemPrompt = (tools: Tool[]) => {
  const appContext = `You are a powerful AI assistant in Telegram. Your goal is to help users by executing commands or answering their questions.

**RESPONSE MODES:**
1. **Tool Execution**: If the user's request requires an action (running code, system commands, calculations), use the appropriate tool
2. **Direct Answer**: If the user is asking questions or having a conversation, respond in plain text

**TELEGRAM CONTEXT:**
- Keep responses concise and readable in chat format
- Use emojis when appropriate to make responses more engaging
- For code execution results, format them clearly`;

  const toolDescriptions = tools.map(t => `- ${t.name}: ${t.contextPreprompt}`);
  return createSystemPrompt(appContext, toolDescriptions);
};

const handleTelegram = generateTelegramHandler({
  tools: [new ExecJSTool(), new TerminalTool({ timeout: 0 })],
  getSystemPrompt,
});

export async function POST(request: Request) {
  return handleTelegram(request);
} 