import { generateTerminalHandler } from './ai/terminal';
import { OpenRouterProvider } from './ai/providers/openrouter';
import { ExecJSTool } from './ai/tools/exec-js-tool';
import { TerminalTool } from './ai/tools/terminal-tool';
import { Tool } from './ai/tool';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env file from the root of the project
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const getSystemPrompt = (tools: Tool[]) => `
You are a powerful AI assistant running in a terminal. Your primary goal is to achieve user requests by executing commands.
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

const tools = [new ExecJSTool(), new TerminalTool()];
const systemPrompt = getSystemPrompt(tools);

if (!process.env.OPENROUTER_API_KEY) {
  throw new Error('OPENROUTER_API_KEY is not set in the environment variables.');
}

const provider = new OpenRouterProvider({
  token: process.env.OPENROUTER_API_KEY,
  model: 'google/gemini-flash-1.5'
});

export const ask = generateTerminalHandler({
  provider,
  tools,
  systemPrompt
});

async function main() {
  // This runs the interactive mode when the script is executed directly
  ask();
}

// Check if the script is being run directly
if (require.main === module) {
  main().catch(console.error);
}
