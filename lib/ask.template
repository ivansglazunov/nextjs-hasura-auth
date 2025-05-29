#!/usr/bin/env node

import { AI, Do } from 'hasyx/lib/ai';
import { execDo, execContext } from 'hasyx/lib/exec';
import { execTsDo, execTsContext } from 'hasyx/lib/exec-tsx';
import { terminalDo, terminalContext } from 'hasyx/lib/terminal';

export class Ask extends AI {
  public context: string;
  public engines: {
    exec: typeof execDo;
    execTs: typeof execTsDo;
    terminal: typeof terminalDo;
  };

  constructor(token: string, projectName: string = 'Unknown Project') {
    // System prompt in English but addressing both AI and user as "we"
    const systemPrompt = `You are an AI assistant for the "${projectName}" project.

We are working together on this project. When we need to execute code, analyze data, or perform operations, we use the available execution environments.

${execContext}

${execTsContext}

${terminalContext}

**Communication Guidelines:**
- Always use "we" when referring to our work together ("we implemented", "we will try", "we observed", "we succeeded", "we agree", "we made a mistake")
- Execute code when we need calculations, demonstrations, or verification
- Use proper error handling and provide helpful explanations
- Keep responses focused and practical

**Important:** Don't separate yourself from the user - we are working together as a team.`;

    super(token, {}, {
      model: 'google/gemini-2.5-flash-preview',
      temperature: 0.1,
      max_tokens: 2048
    }, systemPrompt);

    this.context = [execContext, execTsContext, terminalContext].join('\n\n');
    
    this.engines = {
      exec: execDo,
      execTs: execTsDo,
      terminal: terminalDo
    };

    // Setup Do handler
    this._do = async (doItem: Do): Promise<Do> => {
      try {
        let result: any;

        if (doItem.operation.startsWith('do/exec/js')) {
          result = await this.engines.exec.exec(doItem.request);
        } else if (doItem.operation.startsWith('do/exec/tsx')) {
          result = await this.engines.execTs.exec(doItem.request);
        } else if (doItem.operation.startsWith('do/terminal/')) {
          const shell = doItem.operation.split('/')[2]; // Extract shell type
          result = await this.engines.terminal.exec(doItem.request, shell);
        } else {
          throw new Error(`Unknown operation: ${doItem.operation}`);
        }

        // Format result for AI
        doItem.response = this.formatResult(result);
        return doItem;
      } catch (error) {
        doItem.response = `Error: ${error instanceof Error ? error.message : String(error)}`;
        return doItem;
      }
    };
  }

  private formatResult(result: any): string {
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
}

export const ask = new Ask(
  process?.env?.OPENROUTER_API_KEY || 'dummy-key-for-testing',
  process?.env?.npm_package_name || 'Unknown Project'
);

export default ask;

// Run REPL if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  if (!process?.env?.OPENROUTER_API_KEY) {
    console.error('❌ OPENROUTER_API_KEY environment variable is required');
    console.error('   Please set it in your .env file or environment');
    process.exit(1);
  }
  
  ask.repl().catch((error) => {
    console.error('❌ Error in ask REPL:', error);
    process.exit(1);
  });
} 