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

const getSystemPrompt = () => `
You are a powerful AI assistant running in a terminal. Your primary goal is to achieve user requests by executing commands by using tools.

**Process:**
1.  **Analyze the user's request.**
2.  **Select the most appropriate tool from the list provided.**
3.  **Formulate the command and content for the tool.**
4.  **Respond ONLY with the tool execution syntax. Do not add any other text or explanations.**

**Execution Format:**
> 😈<uuid>/<tool_name>/<command>
\`\`\`<language>
# your code or command here
\`\`\`

**Example for listing files:**
> 😈ls-123/terminal/exec
\`\`\`bash
ls -la
\`\`\`

**IMPORTANT:**
- Your entire response must be ONLY the execution block, starting with \`> 😈\`.
- Directly execute commands whenever possible. Do not ask for permission.
- The \`<uuid>\` must be a unique identifier for each command.
`;

const tools = [new ExecJSTool(), new TerminalTool()];
const systemPrompt = getSystemPrompt();

let using = '';
function getProviderFromArgs(): AIProvider {
  const args = process.argv.slice(2);
  const providerArgIndex = args.findIndex(arg => arg === '--provider');
  const modelArgIndex = args.findIndex(arg => arg === '--model');

  const providerName = providerArgIndex !== -1 ? args[providerArgIndex + 1] : 'openrouter';
  const modelName = modelArgIndex !== -1 ? args[modelArgIndex + 1] : undefined;

  if (providerName === 'ollama') {
    using = `Using Ollama provider with model: ${modelName || 'default'}`;
    return new OllamaProvider({ model: modelName });
  }

  // Default to OpenRouter
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set for OpenRouterProvider.');
  }
  const model = modelName || 'sarvamai/sarvam-m:free';
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
  await ask();
}

// Check if the script is being run directly
if (require.main === module) {
  main().catch(console.error);
}
