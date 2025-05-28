#!/usr/bin/env node

import * as dotenv from 'dotenv';
import * as readline from 'readline';
import { AI } from './ai';
import { printMarkdown } from './markdown-terminal';
import { AskExec, AskExecCallbacks } from './ask-exec';
import { initializeHasyxAsk, generateSystemPrompt } from './ask-hasyx';
import Debug from './debug';

const debug = Debug('hasyx:ask');

// Load environment variables
dotenv.config();

/**
 * Command line options
 */
interface AskOptions {
  question?: string;
  autoConfirm?: boolean; // -y --yes
  model?: string; // -m --model
}

/**
 * Check if text contains markdown formatting
 */
function hasMarkdownFormatting(text: string): boolean {
  // Check for common markdown patterns
  const markdownPatterns = [
    /```[\s\S]*?```/,           // Code blocks
    /`[^`]+`/,                  // Inline code
    /^#{1,6}\s/m,               // Headers
    /\*\*[^*]+\*\*/,            // Bold
    /\*[^*]+\*/,                // Italic
    /\[[^\]]+\]\([^)]+\)/,      // Links
    /^\s*[-*+]\s/m,             // Lists
    /^\s*\d+\.\s/m,             // Numbered lists
    /^>\s/m,                    // Blockquotes
    /^\s*\|.*\|/m               // Tables
  ];
  
  return markdownPatterns.some(pattern => pattern.test(text));
}

/**
 * Show confirmation dialog for code execution
 */
async function confirmExecution(code: string, format: 'js' | 'tsx'): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    console.log(`\n⚠️  AI wants to execute ${format.toUpperCase()} code:`);
    console.log(`\`\`\`${format}`);
    console.log(code);
    console.log('```');
    
    rl.question('\n❓ Allow execution? (y/N): ', (answer) => {
      rl.close();
      const confirmed = answer.toLowerCase().trim() === 'y' || answer.toLowerCase().trim() === 'yes';
      if (confirmed) {
        console.log('✅ Execution approved');
      } else {
        console.log('❌ Execution cancelled');
      }
      resolve(confirmed);
    });
  });
}

export async function askCommand(options: AskOptions = {}): Promise<void> {
  debug('Starting ask command with options:', options);

  // Check for OpenRouter API key
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('❌ OPENROUTER_API_KEY environment variable is required');
    console.error('   Please set it in your .env file or environment');
    process.exit(1);
  }

  // Initialize Hasyx context
  const hasyxContext = initializeHasyxAsk();
  debug('Hasyx context initialized:', hasyxContext.project);

  // Determine model to use
  const model = options.model || 'deepseek/deepseek-chat-v3-0324:free';
  debug('Using model:', model);

  // Create AI instance with Hasyx system prompt
  const systemPrompt = generateSystemPrompt(hasyxContext);
  const ai = new AI(
    process.env.OPENROUTER_API_KEY,
    hasyxContext.recommendedContext,
    {
      model: model,
      temperature: 0.1,
      max_tokens: 2048
    },
    systemPrompt
  );
  
  // Setup execution callbacks
  const execCallbacks: AskExecCallbacks = {
    onCodeFound: (code: string, format: 'js' | 'tsx') => {
      process.stdout.write(`\n📋 Найден ${format.toUpperCase()} код для выполнения:\n`);
      process.stdout.write(`\`\`\`${format}\n${code}\n\`\`\`\n`);
    },
    
    onCodeExecuting: (code: string, format: 'js' | 'tsx') => {
      process.stdout.write(`\n⚡ Выполняется ${format.toUpperCase()} код...\n`);
    },
    
    onCodeResult: (result: string) => {
      process.stdout.write(`\n✅ Результат выполнения:\n${result}\n`);
    },
    
    onConfirmationRequest: async (code: string, format: 'js' | 'tsx') => {
      if (options.autoConfirm) {
        console.log(`\n🔥 Auto-executing ${format.toUpperCase()} code (--yes flag)`);
        return true;
      }
      return await confirmExecution(code, format);
    }
  };

  // Setup AskExec
  const askExec = new AskExec(
    {
      autoConfirm: options.autoConfirm,
      context: hasyxContext.recommendedContext
    },
    execCallbacks
  );

  // Configure AI with exec capabilities
  askExec.setupAI(ai);
  
  // Set up AI progress callbacks
  ai._onThinking = () => {
    process.stdout.write('\n🧠 AI думает...\n');
  };
  
  ai._onResponse = (response: string) => {
    if (response && response.trim()) {
      process.stdout.write(`\n💭 AI ответил (${response.length} символов)\n`);
    }
  };

  if (options.question) {
    // Direct question mode (-e flag)
    debug('Processing direct question:', options.question);
    try {
      const response = await ai.ask(options.question);
      
      // Check if response contains markdown and format accordingly
      if (hasMarkdownFormatting(response)) {
        await printMarkdown(response);
      } else {
        console.log(response);
      }
    } catch (error) {
      debug('Error in direct question mode:', error);
      console.error('❌ Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  } else {
    // Interactive mode
    debug('Starting interactive mode');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> '
    });

    console.log(`🤖 Ask AI anything about "${hasyxContext.project.name}". Type your question and press Enter. Use Ctrl+C to exit.`);
    console.log('💡 Responses with code, formatting, or markdown will be beautifully rendered!');
    console.log('🪬 AI can execute JavaScript and TypeScript code automatically!');
    if (!options.autoConfirm) {
      console.log('⚠️  Code execution requires confirmation (use --yes to auto-approve)');
    } else {
      console.log('🔥 Auto-execution enabled (--yes flag)');
    }
    console.log(`🎯 Model: ${model}`);
    rl.prompt();

    rl.on('line', async (input) => {
      const question = input.trim();
      
      if (!question) {
        rl.prompt();
        return;
      }

      debug('Processing interactive question:', question);
      try {
        const response = await ai.ask(question);
        
        // Check if response contains markdown and format accordingly
        if (hasMarkdownFormatting(response)) {
          await printMarkdown(response);
        } else {
          console.log(response);
        }
      } catch (error) {
        debug('Error in interactive mode:', error);
        console.error('❌ Error:', error instanceof Error ? error.message : String(error));
      }
      
      rl.prompt();
    });

    rl.on('close', () => {
      debug('Interactive mode closed');
      console.log('\n👋 Goodbye!');
      process.exit(0);
    });

    rl.on('SIGINT', () => {
      debug('SIGINT received in interactive mode');
      console.log('\n👋 Goodbye!');
      process.exit(0);
    });
  }
}

// CLI entry point
async function main() {
  const args = process.argv.slice(2);
  const options: AskOptions = {};
  
  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '-e' || arg === '--eval') {
      options.question = args[i + 1];
      i++; // Skip next argument as it's the question
    } else if (arg === '-y' || arg === '--yes') {
      options.autoConfirm = true;
    } else if (arg === '-m' || arg === '--model') {
      options.model = args[i + 1];
      i++; // Skip next argument as it's the model name
    } else if (arg === '-h' || arg === '--help') {
      console.log(`
🤖 Hasyx Ask - AI Assistant with Code Execution

Usage:
  npm run ask                        # Interactive mode
  npm run ask -- -e "question"      # Direct question
  npx hasyx ask                      # Via npx
  npx hasyx ask -e "question"        # Via npx with question

Options:
  -e, --eval <question>             Execute a direct question
  -y, --yes                         Auto-approve code execution (no confirmation)
  -m, --model <model>               Specify OpenRouter model
  -h, --help                        Show this help

Models (OpenRouter):
  deepseek/deepseek-chat-v3-0324:free        # Default, free model
  anthropic/claude-3-sonnet                  # High quality
  openai/gpt-4                               # OpenAI GPT-4
  meta-llama/llama-3-70b                     # Llama 3 70B

Environment:
  OPENROUTER_API_KEY                Must be set in .env or environment

Examples:
  npm run ask -- -e "What is 2 + 2?"
  npm run ask -- -y -e "Calculate factorial of 5"
  npm run ask -- -m "anthropic/claude-3-sonnet" -e "Analyze this data"
  
  # Interactive mode with auto-execution
  npm run ask -- -y
`);
      process.exit(0);
    }
  }

  await askCommand(options);
}

// Run if called directly
if (typeof(require) !== 'undefined' && require.main === module) {
  main().catch((error) => {
    console.error('❌ Error in ask command:', error);
    process.exit(1);
  });
} 