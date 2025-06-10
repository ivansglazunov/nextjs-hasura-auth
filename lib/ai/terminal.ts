import readline2 from 'readline2';
import { Command } from 'commander';
import { Dialog, DialogEvent } from './dialog';
import { OpenRouterProvider } from './providers/openrouter';
import { AIMessage } from './ai';
import { ExecJSTool } from './tools/exec-js-tool';
import { TerminalTool } from './tools/terminal-tool';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

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
      process.stdout.write('\\n');
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
      process.stdout.write(`\\n${PROMPT}`);
      break;
    case 'error':
      console.error(`\n\x1b[31m[ERROR] ${event.error}\x1b[0m`);
      process.stdout.write(`\\n${PROMPT}`);
      break;
  }
}

async function main() {
  const program = new Command();
  program
    .option('-e, --execute <prompt>', 'Execute a prompt non-interactively and exit')
    .parse(process.argv);

  const options = program.opts();

  const provider = new OpenRouterProvider({
    token: process.env.OPENROUTER_API_KEY!,
    model: 'google/gemini-flash-1.5'
  });

  if (options.execute) {
    // Non-interactive mode
    const dialog = new Dialog({
      provider,
      tools: [new ExecJSTool(), new TerminalTool()],
      systemPrompt: 'You are a helpful assistant that can execute javascript and terminal commands. IMPORTANT: You must call tools one at a time. After calling one tool and seeing the result, you can decide to call another one.',
      onChange: (event) => {
        prettyPrint(event);
        if (event.type === 'done') {
          process.exit(0);
        }
      },
      onError: (error) => {
        console.error(`\n\x1b[31m[FATAL ERROR] Exiting due to: ${error}\x1b[0m`);
        process.exit(1);
      }
    });
    dialog.ask({ role: 'user', content: options.execute });

  } else {
    // Interactive mode
    const dialog = new Dialog({
      provider,
      tools: [new ExecJSTool(), new TerminalTool()],
      onChange: prettyPrint,
      systemPrompt: 'You are a helpful assistant that can execute javascript and terminal commands. IMPORTANT: You must call tools one at a time. After calling one tool and seeing the result, you can decide to call another one.'
    });

    const rl = readline2.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: PROMPT
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
}

main().catch(console.error); 