import { generateTerminalHandler } from './ai/terminal';
import { OpenRouterProvider } from './ai/providers/openrouter';
import { OllamaProvider } from './ai/providers/ollama';
import { ExecJSTool } from './ai/tools/exec-js-tool';
import { TerminalTool } from './ai/tools/terminal-tool';
import { AIProvider } from './ai/ai';
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

function getProviderFromArgs(): AIProvider {
  const args = process.argv.slice(2);
  const providerArgIndex = args.findIndex(arg => arg === '--provider');
  const modelArgIndex = args.findIndex(arg => arg === '--model');

  const providerName = providerArgIndex !== -1 ? args[providerArgIndex + 1] : 'openrouter';
  const modelName = modelArgIndex !== -1 ? args[modelArgIndex + 1] : undefined;

  if (providerName === 'ollama') {
    console.log(`Using Ollama provider with model: ${modelName || 'default'}`);
    return new OllamaProvider({ model: modelName });
  }

  // Default to OpenRouter
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set for OpenRouterProvider.');
  }
  const model = modelName || 'google/gemini-flash-1.5';
  console.log(`Using OpenRouter provider with model: ${model}`);
  return new OpenRouterProvider({
    token: process.env.OPENROUTER_API_KEY,
    model: model
  });
}

const provider = getProviderFromArgs();

export const ask = generateTerminalHandler({
  provider,
  tools,
  systemPrompt
});

async function main() {
    const args = process.argv.slice(2);
    const executeIndex = args.findIndex(arg => arg === '-e' || arg === '--execute');
    const execute = executeIndex !== -1 ? args[executeIndex + 1] : undefined;
    
  // This runs the interactive mode or executes a command
  ask({ execute });
}

// Check if the script is being run directly
if (require.main === module) {
  main().catch(console.error);
}
