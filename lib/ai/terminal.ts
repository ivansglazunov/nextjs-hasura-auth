import readline2 from 'readline2';
import { Dialog, DialogEvent } from './dialog';
import { AIProvider, AIMessage } from './ai';
import { Tool } from './tool';

const PROMPT = '> ';

function prettyPrint(event: DialogEvent) {
  switch (event.type) {
    case 'ask':
      console.log(`\x1b[33m[YOU]\x1b[0m ${event.message.content}`);
      break;
    case 'ai_request':
      console.log(`\x1b[34m[AI REQUEST...]\x1b[0m`);
      break;
    case 'ai_chunk':
      process.stdout.write(`\x1b[32m${event.chunk}\x1b[0m`);
      break;
    case 'ai_response':
      process.stdout.write('\n');
      break;
    case 'tool_call':
      console.log(`\n\x1b[35m[TOOL CALL: ${event.name}/${event.command} ID: ${event.id}]\x1b[0m`);
      console.log(event.content);
      break;
    case 'tool_result':
      console.log(`\x1b[36m[TOOL RESULT: ID ${event.id}]\x1b[0m`);
      console.log(event.result);
      if (event.error) {
        console.error(`\x1b[31mError: ${event.error}\x1b[0m`);
      }
      break;
    case 'done':
      process.stdout.write(`\n${PROMPT}`);
      break;
    case 'error':
      console.error(`\n\x1b[31m[ERROR] ${event.error}\x1b[0m`);
      process.stdout.write(`\n${PROMPT}`);
      break;
  }
}

export interface TerminalHandlerOptions {
  provider: AIProvider;
  tools: Tool[];
  systemPrompt: string;
}

export function generateTerminalHandler(options: TerminalHandlerOptions) {
  const { provider, tools, systemPrompt } = options;

  return function handleTerminalRequest({ execute }: { execute?: string } = {}) {
    if (execute) {
      // Non-interactive mode
      const dialog = new Dialog({
        provider,
        tools,
        systemPrompt,
        onChange: (event) => {
          prettyPrint(event);
          if (event.type === 'done' || event.type === 'error') {
            process.exit(event.type === 'error' ? 1 : 0);
          }
        },
        onError: (error) => {
          console.error(`\n\x1b[31m[FATAL ERROR] Exiting due to: ${error}\x1b[0m`);
          process.exit(1);
        },
      });
      dialog.ask({ role: 'user', content: execute });
    } else {
      // Interactive mode
      const dialog = new Dialog({
        provider,
        tools,
        systemPrompt,
        onChange: prettyPrint,
      });

      const rl = readline2.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: PROMPT,
      });

      console.log('Terminal AI Assistant. Type "exit" to quit.');
      rl.prompt();

      rl.on('line', (line) => {
        if (line.trim().toLowerCase() === 'exit') {
          rl.close();
          return;
        }
        const message: AIMessage = { role: 'user', content: line };
        dialog.ask(message);
      }).on('close', () => {
        console.log('Goodbye!');
        process.exit(0);
      });
    }
  };
} 