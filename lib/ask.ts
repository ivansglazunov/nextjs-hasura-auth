import { Agent } from "@mastra/core/agent";
import { Memory } from '@mastra/memory';
import { PostgresStore, PgVector } from "@mastra/pg";
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import dotenv from 'dotenv';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import vm from 'vm';
import { getPgConfig } from 'hasyx/lib/pg';

export function newAsk() {
  // Load .env file
  try {
    let projectRoot = process.cwd();
    const envPath = path.join(projectRoot, '.env');
    const envResult = dotenv.config({ path: envPath });
    if (envResult.error) {
      console.log('Failed to load .env file:', envResult.error);
    } else {
      console.log('.env file loaded successfully');
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error loading .env file:', errorMessage);
  }

  // Flag to control the conversation flow
  let stopped = false;

  // OpenRouter API setup
  const openrouterApiKey = process.env.OPENROUTER_API_KEY;

  if (!openrouterApiKey) {
    throw new Error('OPENROUTER_API_KEY not found in environment variables. Please set it in your .env file.');
  }

  const openrouter = createOpenRouter({
    apiKey: openrouterApiKey
  });

  // Using a model available on OpenRouter
  const model = openrouter.chat('deepseek/deepseek-chat-v3-0324:free');

  const pgConfig = getPgConfig();
  if (!pgConfig) {
    throw new Error('PostgreSQL config not found in environment variables.');
  }

  console.log('Initializing PostgreSQL connection with host:', pgConfig.options.host);
  console.log('Database name:', pgConfig.options.database);
  console.log('User:', pgConfig.options.user);
  console.log('SSL enabled:', !!pgConfig.options.ssl);
  
  // Pool options for the vector store
  const pgPoolOptions = {
    connectionTimeoutMillis: 30000, // 30 seconds timeout
    query_timeout: 30000,
    statement_timeout: 30000,
    max: 10, // maximum number of clients the pool should contain
    idleTimeoutMillis: 30000, // how long a client is allowed to remain idle
  };
  
  let memory: Memory;
  let agent: Agent;
  
  try {
    memory = new Memory({
      storage: new PostgresStore(pgConfig.options),
      vector: new PgVector({ 
        connectionString: pgConfig.url,
        pgPoolOptions: pgPoolOptions
      }),
      options: {
        lastMessages: 50,
        semanticRecall: false,
        threads: {
          generateTitle: false,
        }
      },
    });
    
    console.log('PostgreSQL memory setup completed successfully');

    // Create an agent with the model
    agent = new Agent({
      name: 'Deep7InteractiveAgent',
      instructions: `
You are a helpful AI assistant with the ability to execute JavaScript code.

In the process of answering, you can write code in markdown format that you would like to be executed. To do this, the first line of the code block should be a comment with a UUID:

\`\`\`js
// exec:UUIDv4
\`\`\`

Where UUIDv4 should be a randomly generated UUID by you. Each piece of code will be executed one after another, and the result will be returned to you in the format:
{ "UUIDv4": "response" }

IMPORTANT:
- The code will be executed in the current process using eval, in the same scope as previous code, continuing previous code.
- Variables declared in one code block will be available in subsequent code blocks.
- You can access the result of previous executions from the response message.
- When you're done and don't need to execute more code, simply respond without including any code blocks.

Example code:
\`\`\`js
// exec:${uuidv4()}
var result = 1 + 5;
console.log("The result is:", result);
result; // This will be returned as the value
\`\`\`
`,
      model: model,
      tools: {}, // No tools for this agent
      memory: memory,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error setting up PostgreSQL connection:', errorMessage);
    throw new Error(`Failed to initialize PostgreSQL: ${errorMessage}`);
  }

  // Store for maintaining the evaluation context
  const evalContext = vm.createContext({
    console: console,
    process: process,
    require: require,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    Buffer: Buffer,
    URL: URL,
    Error: Error,
    Date: Date,
    Math: Math,
    JSON: JSON,
    // Add your own custom variables or functions here if needed
  });

  /**
   * Extracts code blocks with UUID from the AI response
   * @param text The AI response text
   * @returns Array of code blocks with their UUIDs
   */
  function extractCodeBlocks(text: string): { uuid: string; code: string }[] {
    const regex = /```js\s*\/\/\s*exec:([a-f0-9-]+)\s*([\s\S]*?)```/g;
    const blocks: { uuid: string; code: string }[] = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
      blocks.push({
        uuid: match[1],
        code: match[2].trim()
      });
    }

    return blocks;
  }

  /**
   * Executes the JavaScript code in the current process using vm
   * @param code The JavaScript code to execute
   * @returns The result of the execution
   */
  async function executeCode(code: string): Promise<string> {
    console.log("\n🧪 Executing JavaScript code:\n");
    console.log(code);
    
    try {
      // Execute the code in a VM context
      const result = vm.runInContext(code, evalContext);
      
      // Handle promises
      const finalResult = result instanceof Promise ? await result : result;
      
      const resultStr = typeof finalResult === 'object' 
        ? JSON.stringify(finalResult, null, 2) 
        : String(finalResult);
      
      console.log("\n📌 JavaScript execution result:\n");
      console.log(resultStr);
      
      return resultStr;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error 
        ? `Error executing JavaScript code: ${error.message}`
        : `Error executing JavaScript code: ${String(error)}`;
      console.error("\n❌ JavaScript execution error:\n");
      console.error(errorMessage);
      return errorMessage;
    }
  }

  /**
   * Processes the AI response and executes any code blocks found
   * @param text The AI response text
   * @returns The processed response with code execution results
   */
  async function processResponse(text: string): Promise<string> {
    if (stopped) return text;
    
    const blocks = extractCodeBlocks(text);
    
    if (blocks.length === 0) {
      // No code blocks found, finish here
      return text;
    }
    
    // Execute code blocks and collect results
    const results: Record<string, string> = {};
    for (const block of blocks) {
      if (stopped) break;
      
      results[block.uuid] = await executeCode(block.code);
    }
    
    // If we have executed code blocks and not been stopped,
    // send the results back to the AI
    if (Object.keys(results).length > 0 && !stopped) {
      const resultMessage = `Here are the results of the code execution:\n\`\`\`json\n${JSON.stringify(results, null, 2)}\n\`\`\``;
      
      console.log("\n⏩ Sending code results back to AI:\n");
      console.log(resultMessage);
      
      // Call AI again with the results
      return await ask(resultMessage);
    }
    
    return text;
  }

  /**
   * Generates a response from the AI agent
   * @param message The user's message
   * @returns The AI's response with any code execution results
   */
  async function ask(message: string): Promise<string> {
    // Reset the stopped flag at the start of a new ask
    stopped = false;
    
    console.log(`\n💬 User/Code message: ${message}`);
    
    try {
      // Generate unique IDs for this conversation
      const threadId = `thread-${Date.now()}`;
      const resourceId = `resource-${Date.now()}`;
      
      // Generate a response using the Mastra agent
      const response = await agent.generate(
        [{ role: "user", content: message }],
        { threadId, resourceId }
      );
      
      const aiResponse = response.text || "Sorry, I could not generate a response.";
      console.log(`\n🤖 AI response:\n${aiResponse}`);
      
      // Process code blocks in the response
      return await processResponse(aiResponse);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('AI Error in ask():', errorMessage);
      return "Sorry, I encountered an error trying to respond.";
    }
  }

  /**
   * Stops the current processing/conversation flow
   */
  function stop(): void {
    stopped = true;
    console.log("\n🛑 Processing stopped by user.");
  }

  return { ask, stop };
} 