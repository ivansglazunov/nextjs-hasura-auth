#!/usr/bin/env node

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file in current working directory
// This ensures that when using npx hasyx from a child project,
// the .env is loaded from the user's current directory, not from hasyx package directory
dotenv.config({ path: path.join(process.cwd(), '.env') });

import { AI, Do } from 'hasyx/lib/ai';
import { execDo, execContext } from 'hasyx/lib/exec';
import { execTsDo, execTsContext } from 'hasyx/lib/exec-tsx';
import { terminalDo, terminalContext } from 'hasyx/lib/terminal';
import { printMarkdown } from 'hasyx/lib/markdown-terminal';

export class Ask extends AI {
  public context: string;
  public engines: {
    exec: typeof execDo;
    execTs: typeof execTsDo;
    terminal: typeof terminalDo;
  };
  private isReplMode: boolean = false;

  constructor(token: string, projectName: string = 'Unknown Project') {
    // System prompt in English but addressing both AI and user as "we"
    const systemPrompt = `You are an AI assistant for the "${projectName}" project.

We are working together on this project. When we need to execute code, analyze data, or perform operations, we use the available execution environments.

${execContext}

${execTsContext}

${terminalContext}

**Communication Guidelines:**
- Always use "we" when referring to our work together ("we implemented", "we will try", "we observed", "we succeeded", "we agree", "we made a mistake")
- Execute code ONLY when calculations, demonstrations, or verification are actually needed
- For simple questions, conversations, or general knowledge - respond directly without code execution
- Use proper error handling and provide helpful explanations
- Keep responses focused and practical

**IMPORTANT CODE EXECUTION RULES:**
- When you need to execute terminal commands, you MUST use the exact format: > 🪬<uuid>/do/terminal/bash followed by \`\`\`bash
- When you need to execute JavaScript, you MUST use the exact format: > 🪬<uuid>/do/exec/js followed by \`\`\`js  
- When you need to execute TypeScript, you MUST use the exact format: > 🪬<uuid>/do/exec/tsx followed by \`\`\`tsx
- NEVER use \`\`\`terminal - always use \`\`\`bash for terminal commands
- Always generate a unique UUID for each operation
- Only execute code when it's actually necessary to answer the question

**Important:** Don't separate yourself from the user - we are working together as a team. Only execute code when it's actually necessary to answer the question.`;

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

    // Setup real-time progress callbacks for transparency (only in REPL mode)
    this._onThinking = () => {
      if (this.isReplMode) {
        console.log('🧠 AI думает...');
      }
    };

    this._onCodeFound = async (code: string, format: 'js' | 'tsx' | 'terminal') => {
      if (this.isReplMode) {
        console.log(`📋 Найден ${format.toUpperCase()} код для выполнения:`);
        const displayFormat = format === 'terminal' ? 'bash' : format;
        await printMarkdown(`\`\`\`${displayFormat}\n${code}\n\`\`\``);
      }
    };

    this._onCodeExecuting = (code: string, format: 'js' | 'tsx' | 'terminal') => {
      if (this.isReplMode) {
        console.log(`⚡ Выполняется ${format.toUpperCase()} код...`);
      }
    };

    this._onCodeResult = async (result: string) => {
      if (this.isReplMode) {
        console.log(`✅ Результат выполнения:`);
        await printMarkdown(`\`\`\`\n${result}\n\`\`\``);
      }
    };

    this._onResponse = (response: string) => {
      if (this.isReplMode) {
        console.log(`💭 AI ответил (${response.length} символов)`);
      }
    };

    // Setup Do handler
    this._do = async (doItem: Do): Promise<Do> => {
      try {
        // Notify that code execution is starting
        if (this._onCodeExecuting) {
          this._onCodeExecuting(doItem.request, doItem.format);
        }

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
        
        // Notify about execution result
        if (this._onCodeResult) {
          await this._onCodeResult(doItem.response);
        }
        
        return doItem;
      } catch (error) {
        const errorMessage = `Error: ${error instanceof Error ? error.message : String(error)}`;
        doItem.response = errorMessage;
        
        // Notify about execution result (even if it's an error)
        if (this._onCodeResult) {
          await this._onCodeResult(errorMessage);
        }
        
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

  /**
   * Interactive REPL mode for terminal interaction
   */
  async repl(): Promise<void> {
    this.isReplMode = true; // Enable progress callbacks for REPL
    
    try {
      await super.repl();
    } finally {
      this.isReplMode = false; // Disable progress callbacks when exiting REPL
    }
  }
}

export const ask = new Ask(
  process?.env?.OPENROUTER_API_KEY || 'dummy-key-for-testing',
  process?.env?.npm_package_name || 'Unknown Project'
);

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