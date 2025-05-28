#!/usr/bin/env node

import * as dotenv from 'dotenv';
import * as readline from 'readline';
import { AI } from './ai';
import { printMarkdown } from './markdown-terminal';
import Debug from './debug';

const debug = Debug('hasyx:ask');

// Load environment variables
dotenv.config();

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
 * Show animated loading indicator
 */
function showLoadingIndicator(): () => void {
  const frames = ['.', '..', '...'];
  let frameIndex = 0;
  let isActive = true;
  
  // Hide cursor and show initial loading
  process.stdout.write('\x1B[?25l'); // Hide cursor
  process.stdout.write('🤖 Thinking');
  
  const interval = setInterval(() => {
    if (!isActive) return;
    
    // Clear current line and rewrite with new frame
    process.stdout.write('\r🤖 Thinking' + frames[frameIndex]);
    frameIndex = (frameIndex + 1) % frames.length;
  }, 500);
  
  // Return cleanup function
  return () => {
    isActive = false;
    clearInterval(interval);
    process.stdout.write('\r\x1B[K'); // Clear line
    process.stdout.write('\x1B[?25h'); // Show cursor
  };
}

export async function askCommand(question?: string): Promise<void> {
  debug('Starting ask command with question:', question);

  // Check for OpenRouter API key
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('❌ OPENROUTER_API_KEY environment variable is required');
    console.error('   Please set it in your .env file or environment');
    process.exit(1);
  }

  // Create AI instance with free DeepSeek model
  const ai = new AI(
    process.env.OPENROUTER_API_KEY,
    {},
    {
      model: 'deepseek/deepseek-chat-v3-0324:free',
      temperature: 0.1,
      max_tokens: 2048
    }
  );
  
  // Set up real-time progress callbacks
  ai._onThinking = () => {
    process.stdout.write('\n🧠 AI думает...\n');
  };
  
  ai._onCodeFound = (code: string, format: 'js' | 'tsx') => {
    process.stdout.write(`\n📋 Найден ${format.toUpperCase()} код для выполнения:\n`);
    process.stdout.write(`\`\`\`${format}\n${code}\n\`\`\`\n`);
  };
  
  ai._onCodeExecuting = (code: string, format: 'js' | 'tsx') => {
    process.stdout.write(`\n⚡ Выполняется ${format.toUpperCase()} код...\n`);
  };
  
  ai._onCodeResult = (result: string) => {
    process.stdout.write(`\n✅ Результат выполнения:\n${result}\n`);
  };
  
  ai._onResponse = (response: string) => {
    if (response && response.trim()) {
      process.stdout.write(`\n💭 AI ответил (${response.length} символов)\n`);
    }
  };

  if (question) {
    // Direct question mode (-e flag)
    debug('Processing direct question:', question);
    try {
      const response = await ai.ask(question);
      
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

    console.log('🤖 Ask AI anything. Type your question and press Enter. Use Ctrl+C to exit.');
    console.log('💡 Responses with code, formatting, or markdown will be beautifully rendered!');
    console.log('🪬 AI can execute JavaScript and TypeScript code automatically!');
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
  let question: string | undefined;
  
  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-e' || args[i] === '--eval') {
      question = args[i + 1];
      i++; // Skip next argument as it's the question
    }
  }

  await askCommand(question);
}

// Run if called directly
if (typeof(require) !== 'undefined' && require.main === module) {
  main().catch((error) => {
    console.error('❌ Error in ask command:', error);
    process.exit(1);
  });
} 