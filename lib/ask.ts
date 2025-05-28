#!/usr/bin/env node

import * as dotenv from 'dotenv';
import * as readline from 'readline';
import { OpenRouter } from './openrouter';
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

export async function askCommand(question?: string): Promise<void> {
  debug('Starting ask command with question:', question);

  // Check for OpenRouter API key
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('❌ OPENROUTER_API_KEY environment variable is required');
    console.error('   Please set it in your .env file or environment');
    process.exit(1);
  }

  // Create OpenRouter instance with free DeepSeek model
  const openrouter = new OpenRouter(
    process.env.OPENROUTER_API_KEY,
    {},
    {
      model: 'deepseek/deepseek-chat-v3-0324:free',
      temperature: 0.7,
      max_tokens: 4096
    }
  );

  if (question) {
    // Direct question mode (-e flag)
    debug('Processing direct question:', question);
    try {
      const response = await openrouter.ask(question);
      
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
    rl.prompt();

    rl.on('line', async (input) => {
      const question = input.trim();
      
      if (!question) {
        rl.prompt();
        return;
      }

      debug('Processing interactive question:', question);
      try {
        const response = await openrouter.ask(question);
        
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