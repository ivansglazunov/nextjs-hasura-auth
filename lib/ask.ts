import * as dotenv from 'dotenv';
import { AIProvider } from 'hasyx/lib/ai/ai';
import { OllamaProvider } from 'hasyx/lib/ai/providers/ollama';
import { OpenRouterProvider } from 'hasyx/lib/ai/providers/openrouter';
import { generateTerminalHandler } from 'hasyx/lib/ai/terminal';
import { ExecJSTool } from 'hasyx/lib/ai/tools/exec-js-tool';
import { TerminalTool } from 'hasyx/lib/ai/tools/terminal-tool';
import { createSystemPrompt } from 'hasyx/lib/ai/core-prompts';
import type { Command } from 'commander';
import * as path from 'path';

// Load .env file from the root of the project
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const getSystemPrompt = () => {
  const appContext = `You are a powerful AI assistant in a terminal environment. Your goal is to help users by executing commands or answering their questions.

**RESPONSE MODES:**
1. **Tool Execution**: If the user's request requires an action (running code, system commands, file operations), use the appropriate tool
2. **Direct Answer**: If the user is asking questions or having a conversation that doesn't require tool execution, respond in plain text

**CAPABILITIES:**
- Execute JavaScript code for calculations, data processing, and programming tasks  
- Run terminal commands for system operations, file management, and shell tasks
- Provide direct answers for questions, explanations, and conversations`;

  const tools = [new ExecJSTool(), new TerminalTool({ timeout: 0 })];
  const toolDescriptions = tools.map(tool => `- ${tool.name}: ${tool.contextPreprompt}`);
  
  return createSystemPrompt(appContext, toolDescriptions);
};

interface AskOptions {
  provider?: string;
  model?: string;
  eval?: string;
}

function getProvider(options: AskOptions): AIProvider {
  const providerName = options.provider || 'openrouter';
  const modelName = options.model;

  if (providerName === 'ollama') {
    console.log(`Using Ollama provider with model: ${modelName || 'gemma2:2b'}`);
    return new OllamaProvider({ model: modelName });
  }

  // Default to OpenRouter
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set for OpenRouterProvider.');
  }
  const model = modelName || 'deepseek/deepseek-chat-v3-0324:free';
  console.log(`Using OpenRouter provider with model: ${model}`);
  return new OpenRouterProvider({
    token: process.env.OPENROUTER_API_KEY,
    model: model
  });
}

export const generateAsk = (options: AskOptions = {}) => {
  const provider = getProvider(options);
  const tools = [new ExecJSTool(), new TerminalTool({ timeout: 0 })];
  const systemPrompt = getSystemPrompt();

  return generateTerminalHandler({
    provider,
    tools,
    systemPrompt
  });
}

// CLI configuration functions for use in cli-hasyx.ts
export const askCommandDescribe = (cmd: Command) => {
  return cmd
    .description('AI assistant with code execution capabilities')
    .option('-p, --provider <provider>', 'AI provider to use (openrouter, ollama)', 'openrouter')
    .option('-m, --model <model>', 'Model to use')
    .option('-e, --eval <question>', 'Execute a direct question');
};

export const askCommand = async (options: AskOptions) => {
  try {
    const ask = generateAsk(options);
    await ask();
  } catch (error) {
    console.error('❌ Error in ask command:', error);
    process.exit(1);
  }
};

async function main() {
  // When run directly, parse arguments manually for backwards compatibility
  const args = process.argv.slice(2);
  const providerArgIndex = args.findIndex(arg => arg === '--provider');
  const modelArgIndex = args.findIndex(arg => arg === '--model');

  const options: AskOptions = {
    provider: providerArgIndex !== -1 ? args[providerArgIndex + 1] : 'openrouter',
    model: modelArgIndex !== -1 ? args[modelArgIndex + 1] : undefined
  };

  const ask = generateAsk(options);
  await ask();
}

// Check if the script is being run directly
if (require.main === module) {
  main().catch(console.error);
}
