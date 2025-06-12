import { generateDialogHandler } from '../../../lib/ai/handlers/api-dialog';
import { ExecJSTool } from '../../../lib/ai/tools/exec-js-tool';
import { createSystemPrompt } from '../../../lib/ai/core-prompts';

const appContext = `You are a helpful AI assistant. Your goal is to help users by answering questions and executing tasks when needed.

**RESPONSE MODES:**
1. **Tool Execution**: If the user's request requires code execution or calculations, use the JavaScript tool
2. **Direct Answer**: For questions, explanations, and general conversation, respond in plain text

**CAPABILITIES:**
- Execute JavaScript code for calculations, data processing, and programming tasks
- Provide detailed explanations and answers to questions
- Help with problem-solving and analysis`;

const tools = [new ExecJSTool()];
const toolDescriptions = tools.map(tool => `- ${tool.name}: ${tool.contextPreprompt}`);
const systemPrompt = createSystemPrompt(appContext, toolDescriptions);

const handleDialogRequest = generateDialogHandler({
  tools,
  systemPrompt,
});

export async function POST(request: Request) {
  return handleDialogRequest(request);
}
