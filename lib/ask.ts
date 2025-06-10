#!/usr/bin/env node

import { AskHasyx, AskHasyxOptions, ensureOpenRouterApiKey } from 'hasyx/lib/ask-hasyx';
import { OpenRouter } from 'hasyx/lib/openrouter';
import { Ollama } from 'hasyx/lib/ollama';
import { AIProvider } from "./ai";
import { Command } from 'commander';

interface AskOptions extends Omit<AskHasyxOptions, 'provider'> {
  projectName?: string;
  provider?: AIProvider;
}

export class Ask extends AskHasyx {
  constructor(options: AskOptions) {
    const projectName = options.projectName || 'Unknown Project';
    
    // Project-specific system prompt with proper code execution instructions
    const systemPrompt = `You are an AI assistant for the "${projectName}" project.

We are working together on this project. When we need to execute code, analyze data, or perform operations, we work as a team.

**Communication Guidelines:**
- Always use "we" when referring to our work together ("we implemented", "we will try", "we observed", "we succeeded", "we agree", "we made a mistake")
- Execute code ONLY when calculations, demonstrations, or verification are actually needed
- For simple questions, conversations, or general knowledge - respond directly without code execution
- Use proper error handling and provide helpful explanations
- Keep responses focused and practical

**IMPORTANT CODE EXECUTION RULES:**
- When you need to execute JavaScript, you MUST use the exact format: > 😈<uuid>/do/exec/js followed by \`\`\`js
- When you need to execute TypeScript, you MUST use the exact format: > 😈<uuid>/do/exec/tsx followed by \`\`\`tsx
- When you need to execute terminal commands, you MUST use the exact format: > 😈<uuid>/do/terminal/bash followed by \`\`\`bash
- NEVER use \`\`\`javascript or \`\`\`typescript or \`\`\`terminal - always use the exact formats above
- Always generate a unique UUID for each operation (use crypto.randomUUID() pattern)
- Only execute code when it's actually necessary to answer the question

**Examples:**
> 😈calc-123e4567-e89b-12d3-a456-426614174000/do/exec/js
\`\`\`js
2 + 2
\`\`\`

> 😈types-123e4567-e89b-12d3-a456-426614174001/do/exec/tsx
\`\`\`tsx
interface User { id: number; name: string }
const user: User = { id: 1, name: "John" };
user
\`\`\`

> 😈cmd-123e4567-e89b-12d3-a456-426614174002/do/terminal/bash
\`\`\`bash
echo "Hello World"
\`\`\`

**Important:** Don't separate yourself from the user - we are working together as a team. Only execute code when it's actually necessary to answer the question.`;

    if (!options.provider) {
      throw new Error('Provider is required');
    }

    const finalOptions: AskHasyxOptions = {
      provider: options.provider,
      systemPrompt: options.systemPrompt || systemPrompt,
      askOptions: {
        exec: true,
        execTs: true,
        terminal: true,
        ...(options.askOptions || {})
      },
      ...options
    };

    // Call parent constructor with project-specific configuration
    super(finalOptions);
  }
}

// Function to create provider based on CLI arguments
function createProvider(providerName: string, model: string): AIProvider {
  switch (providerName.toLowerCase()) {
    case 'openrouter':
      if (!process.env.OPENROUTER_API_KEY) {
        throw new Error('OPENROUTER_API_KEY is required for OpenRouter provider');
      }
      return new OpenRouter({
        token: process.env.OPENROUTER_API_KEY,
        model: model || 'google/gemini-2.5-flash-preview' // Default free model
      });
    
    case 'ollama':
      return new Ollama({
        baseUrl: 'http://localhost:11434',
        model: model || 'gemma2:2b', // Default local model
        timeout: 120000 // 2 minutes timeout for local models
      });
    
    default:
      throw new Error(`Unknown provider: ${providerName}. Supported providers: openrouter, ollama`);
  }
}

// Parse CLI arguments if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  const program = new Command();
  
  program
    .name('hasyx ask')
    .description('AI assistant with code execution capabilities')
    .option('--provider <name>', 'AI provider to use (openrouter, ollama)', 'openrouter')
    .option('--model <name>', 'Model to use')
    .argument('[question]', 'Question to ask the AI')
    .parse();

  const options = program.opts();
  const [question] = program.args;
  
  // Determine model based on provider if not specified
  let model = options.model;
  if (!model) {
    model = options.provider === 'ollama' ? 'gemma2:2b' : 'google/gemini-2.5-flash-preview';
  }

  (async () => {
    try {
      // Ensure OpenRouter API Key is configured if using OpenRouter
      if (options.provider === 'openrouter') {
        await ensureOpenRouterApiKey();
      }

      // Create provider
      const provider = createProvider(options.provider, model);
      
      // Create Ask instance
      const ask = new Ask({
        provider,
        projectName: process?.env?.npm_package_name || 'Unknown Project'
      });

      // If question provided, answer it directly
      if (question) {
        console.log(`🤖 Using ${options.provider} with model ${model}`);
        const response = await ask.askWithBeautifulOutput(question);
        process.exit(0);
      }
      
      // Otherwise start REPL
      console.log(`🤖 Using ${options.provider} with model ${model}`);
      ask.repl().catch((error) => {
        console.error('❌ Error in ask REPL:', error);
        process.exit(1);
      });
      
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : String(error));
      console.error('💡 Try: npm run ask -- --provider openrouter --model google/gemini-2.5-flash-preview "Your question"');
      console.error('💡 Or:  npm run ask -- --provider ollama --model gemma2:2b "Your question"');
      process.exit(1);
    }
  })();
}

// Export default instance with OpenRouter for backward compatibility
export const ask = (() => {
  try {
    const provider = createProvider('openrouter', 'google/gemini-2.5-flash-preview');
    return new Ask({
      provider,
      projectName: process?.env?.npm_package_name || 'Unknown Project'
    });
  } catch (error) {
    console.warn('⚠️ Could not create default ask instance:', error instanceof Error ? error.message : String(error));
    return null;
  }
})(); 