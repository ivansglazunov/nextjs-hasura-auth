#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { AI, AIStreamEventUnion } from '../lib/ai';
import { execDo } from '../lib/exec';
import { execTsDo } from '../lib/exec-tsx';
import { terminalDo } from '../lib/terminal';

// Load environment variables
dotenv.config();

async function demonstrateStreaming() {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('❌ OPENROUTER_API_KEY environment variable is required');
    process.exit(1);
  }

  // Create AI instance
  const ai = new AI(
    process.env.OPENROUTER_API_KEY,
    {},
    {
      model: 'google/gemini-2.5-flash-preview',
      temperature: 0.1,
      max_tokens: 2048
    },
    `You are a helpful AI assistant with code execution capabilities.

🪬 You can execute JavaScript and TypeScript code using special Do operations.
When you need to run code, use this format:

> 🪬<uuid>/do/exec/js
\`\`\`js
// your code here
\`\`\`

> 🪬<uuid>/do/exec/tsx  
\`\`\`tsx
// your TypeScript code here
\`\`\`

Always provide helpful explanations and make your responses clear and informative.`
  );

  // Set up execution engines
  ai._do = async (doItem) => {
    try {
      let result: any;

      if (doItem.operation.startsWith('do/exec/js')) {
        result = await execDo.exec(doItem.request);
      } else if (doItem.operation.startsWith('do/exec/tsx')) {
        result = await execTsDo.exec(doItem.request);
      } else if (doItem.operation.startsWith('do/terminal/')) {
        const shell = doItem.operation.split('/')[2];
        result = await terminalDo.exec(doItem.request, shell);
      } else {
        throw new Error(`Unknown operation: ${doItem.operation}`);
      }

      doItem.response = formatResult(result);
      return doItem;
    } catch (error) {
      const errorMessage = `Error: ${error instanceof Error ? error.message : String(error)}`;
      doItem.response = errorMessage;
      return doItem;
    }
  };

  function formatResult(result: any): string {
    if (result === undefined) return 'undefined';
    if (result === null) return 'null';
    if (typeof result === 'string') return result;
    if (typeof result === 'number' || typeof result === 'boolean') return String(result);
    if (result instanceof Error) return `Error: ${result.message}`;
    if (typeof result === 'function') return `[Function: ${result.name || 'anonymous'}]`;
    if (typeof result === 'object') {
      try {
        return JSON.stringify(result, null, 2);
      } catch {
        return String(result);
      }
    }
    return String(result);
  }

  console.log('🚀 Demonstrating Real-time AI Streaming\n');

  // Example 1: Simple streaming
  console.log('📝 Example 1: Simple Text Streaming');
  console.log('Question: What is TypeScript?\n');

  const textDeltas: string[] = [];
  
  await new Promise<void>((resolve, reject) => {
    ai.askStream('What is TypeScript? Give a brief explanation.').subscribe({
      next: (delta) => {
        process.stdout.write(delta);
        textDeltas.push(delta);
      },
      complete: () => {
        console.log('\n\n✅ Simple streaming completed');
        console.log(`Received ${textDeltas.length} text deltas`);
        resolve();
      },
      error: reject
    });
  });

  console.log('\n' + '='.repeat(50) + '\n');

  // Example 2: Full event streaming with code execution
  console.log('📊 Example 2: Full Event Streaming with Code Execution');
  console.log('Question: Calculate factorial of 5 using JavaScript\n');

  await new Promise<void>((resolve, reject) => {
    ai.asking('Calculate the factorial of 5 using JavaScript code execution').subscribe({
      next: (event: AIStreamEventUnion) => {
        switch (event.type) {
          case 'thinking':
            console.log('🧠 AI is thinking...');
            break;
            
          case 'iteration':
            console.log(`🔄 Iteration ${event.data.iteration}: ${event.data.reason}`);
            break;
            
          case 'text':
            process.stdout.write(event.data.delta);
            break;
            
          case 'code_found':
            console.log(`\n📋 Found ${event.data.format.toUpperCase()} code:`);
            console.log(`\`\`\`${event.data.format}`);
            console.log(event.data.code);
            console.log('```');
            break;
            
          case 'code_executing':
            console.log(`⚡ Executing ${event.data.format.toUpperCase()} code...`);
            break;
            
          case 'code_result':
            const status = event.data.success ? '✅' : '❌';
            console.log(`${status} Execution result:`);
            console.log('```');
            console.log(event.data.result);
            console.log('```');
            break;
            
          case 'complete':
            console.log(`\n💭 Completed (${event.data.iterations} iterations)`);
            console.log(`Final response length: ${event.data.finalResponse.length} chars`);
            console.log(`Execution results: ${event.data.executionResults.length}`);
            break;
            
          case 'error':
            console.error(`❌ Error in iteration ${event.data.iteration}:`, event.data.error.message);
            break;
        }
      },
      complete: () => {
        console.log('\n✅ Full streaming completed');
        resolve();
      },
      error: reject
    });
  });

  console.log('\n' + '='.repeat(50) + '\n');

  // Example 3: Get just the complete response
  console.log('📄 Example 3: Complete Response via Streaming');
  console.log('Question: What is 2^10?\n');

  const completeResponse = await new Promise<string>((resolve, reject) => {
    ai.askWithStreaming('Calculate 2 to the power of 10 using code').subscribe({
      next: resolve,
      error: reject
    });
  });

  console.log('Complete response received:');
  console.log(completeResponse);

  console.log('\n' + '='.repeat(50) + '\n');

  // Example 4: Get just execution results
  console.log('🔧 Example 4: Execution Results Only');
  console.log('Question: Create array and sort it\n');

  const executionResults = await new Promise<any[]>((resolve, reject) => {
    ai.getExecutionResults('Create an array [3,1,4,1,5] and sort it using JavaScript').subscribe({
      next: resolve,
      error: reject
    });
  });

  console.log('Execution results:');
  console.log(JSON.stringify(executionResults, null, 2));

  console.log('\n🎉 All streaming examples completed!');
}

// Run the demonstration
demonstrateStreaming().catch(error => {
  console.error('❌ Error in streaming demonstration:', error);
  process.exit(1);
}); 