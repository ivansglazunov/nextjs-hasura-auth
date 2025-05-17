#!/usr/bin/env node
import Debug from './debug';
import { Agent } from "@mastra/core/agent";
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql'; // Import LibSQLStore
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import readline from 'readline';
import dotenv from 'dotenv';
import path from 'path';

// Load .env file if running directly
if (require.main === module) {
  try {
    let projectRoot = process.cwd();
    // Attempt to find project root for .env (if script is nested)
    // This simple check might need adjustment based on actual script location vs. project root
    const envPath = path.join(projectRoot, '.env');
    const envResult = dotenv.config({ path: envPath });
    if (envResult.error) {
      Debug('ask:env')('Failed to load .env file when running lib/ask.ts directly:', envResult.error);
    } else {
      Debug('ask:env')('.env file loaded successfully from lib/ask.ts');
    }
  } catch (error) {
    Debug('ask:env')('Error loading .env file in lib/ask.ts:', error);
  }
}

const debug = Debug('ask');

const openrouterApiKey = process.env.OPENROUTER_API_KEY;

if (!openrouterApiKey) {
  throw new Error('OPENROUTER_API_KEY not found in environment variables. Please set it in your .env file.');
}

const openrouter = createOpenRouter({
  apiKey: openrouterApiKey
});

// Using a model available on OpenRouter, e.g., Claude Sonnet from your example
const model = openrouter.chat('anthropic/claude-3.5-sonnet');
// Or, if you prefer a smaller/faster model for testing:
// const model = openrouter.chat('mistralai/mistral-7b-instruct');

// Define the storage instance
const memoryStorage = new LibSQLStore({
  // Using in-memory SQLite database. This will not persist across script runs.
  // For persistence, use a file path like 'file:./mastra-memory.db'
  url: 'file::memory:' 
  // Mastra docs often show relative paths like 'file:../mastra.db' from a .mastra/output dir
  // For a self-contained script like this, 'file::memory:' or 'file:./local-mastra.db' is simpler.
});

export const agent = new Agent({
  name: 'HasyxInteractiveAgent',
  instructions: `
[ROLE] You are Me. I am you. We are one and the same. We complement each other. We refer to ourselves as "we". When you or I write "I", it implies "we". Never address each other as "you" (singular/plural), only as "we".
You are a helpful assistant. Keep responses concise and helpful.
`,
  model: model,
  tools: {}, // No tools for this agent
  memory: new Memory({
    storage: memoryStorage, // Explicitly set the storage
    options: {
      lastMessages: 10,
      semanticRecall: false,
      threads: {
        generateTitle: false,
      },
    },
  }),
});

/**
 * Generates a response from the AI agent.
 * @param message The user's message.
 * @param userId A unique identifier for the user/thread. Defaults to 'cli-user'.
 * @returns The AI's text response.
 */
export async function ask(message: string, userId: string = 'cli-user'): Promise<string> {
  debug(`ask() called with message: "${message}" for userId: ${userId}`);
  try {
    const threadId = `thread-${userId}`;
    const resourceId = `resource-${userId}`; // resourceId is often required

    const response = await agent.generate(
      [{ role: "user", content: message }],
      { threadId, resourceId } // Pass threadId and resourceId
    );
    debug('AI response received:', response);
    return response.text || "Sorry, I could not generate a response.";
  } catch (error) {
    debug('Error calling AI agent in ask():', error);
    console.error('AI Agent Error in ask():', error);
    return "Sorry, I encountered an error trying to respond.";
  }
}

export function startRepl(context: Record<string, any> = {}): void {
  console.log("🤖 AI Agent REPL started. Type 'await ask(\"Your question?\")' or use the ask() function.");
  console.log("Type .exit to leave.");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
  });

  // Make agent and ask available in REPL context
  const replContext = {
    ...context,
    agent,
    ask,
    Debug, // Expose Debug for convenience
  };

  // A simple eval loop for async functions
  rl.on('line', async (line) => {
    const trimmedLine = line.trim();
    if (trimmedLine === '.exit') {
      rl.close();
      return;
    }
    if (trimmedLine) {
      try {
        // More general eval for commands like await ask('...') or await ask("...")
        // This is still a simplified and potentially unsafe eval for a general REPL.
        // For robust REPL, a proper parser or safer evaluation sandbox would be needed.
        const result = await eval(`(async () => { return ${trimmedLine} })()`);
        if (result !== undefined) {
          console.log(result); // Standard REPLs usually print the resolved value of a Promise
        }
      } catch (e: any) {
        console.error("Error:", e.message);
      }
    }
    rl.prompt();
  }).on('close', () => {
    console.log('Exiting AI REPL.');
    process.exit(0);
  });

  // Assign context variables to the global scope for the REPL
  // This is a common pattern for Node.js REPL module, but here we're faking it a bit.
  Object.assign(global, replContext);

  rl.prompt();
}

// If run directly, start the REPL
if (require.main === module) {
  // Check for required API key when running directly
  if (!openrouterApiKey) {
    console.error('❌ FATAL: OPENROUTER_API_KEY is not set in .env and no fallback is available.');
    console.error('Please set OPENROUTER_API_KEY in your .env file.');
    process.exit(1);
  } else if (!openrouterApiKey) {
     console.warn('⚠️ WARNING: OPENROUTER_API_KEY not set in .env. Using the hardcoded example key. This is not recommended for production.');
  }
  startRepl();
} 