import { Dialog, DialogEvent, DialogOptions } from './dialog';
import readline from 'readline';
import Debug from '../debug';
import chalk from 'chalk';

const debug = Debug('ai:terminal');

interface TerminalHandlerOptions {
  provider: DialogOptions['provider'];
  tools: DialogOptions['tools'];
  systemPrompt: DialogOptions['systemPrompt'];
}

export function generateTerminalHandler(options: TerminalHandlerOptions) {
  const dialog = new Dialog({
    ...options,
    method: 'stream',
    onChange: (event: DialogEvent) => {
        debug('Dialog event: %s', event.type);
        switch(event.type) {
            case 'ask':
                // No visible output for the initial ask, Thinking... will be shown by thoughts
                break;
            case 'ai_chunk':
                process.stdout.write(chalk.gray(`[ai_chunk] `) + event.chunk);
                break;
            case 'thought_chunk':
                process.stdout.write(chalk.yellow(`[thought_chunk] `) + chalk.yellow(event.chunk));
                break;
            case 'thought':
                 // This event signifies the end of a thought block, a newline is good.
                process.stdout.write('\n');
                break;
            case 'tool_call':
                console.log(chalk.cyan(`\n[tool_call] Calling tool: ${event.name}...`));
                break;
            case 'tool_result':
                console.log(chalk.magenta(`[tool_result] ID ${event.id}:`), event.result);
                break;
            case 'ai_response':
                // Don't show ai_response because content is already streamed via ai_chunk
                // This prevents duplication of the same content
                break;
            case 'error':
                process.stderr.write(chalk.red(`\n[error] An error occurred: ${event.error}\n`));
                break;
            case 'done':
                process.stdout.write(chalk.bold('\n[done]\n'));
                break;
        }
    },
    onError: (error) => {
        console.error('\nDialog error:', error);
    }
  });

  const startInteractiveSession = () => {
    console.log('Terminal AI started. Type your request or ".exit" to quit.');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> '
    });

    rl.prompt();

    rl.on('line', (line) => {
      if (line.trim().toLowerCase() === '.exit') {
        rl.close();
        return;
      }
      dialog.ask(line.trim()).then(() => {
        rl.prompt();
      });
    }).on('close', () => {
      console.log('\nExiting Terminal AI.');
      process.exit(0);
    });
  };

  return async function terminalRunner() {
    const args = process.argv.slice(2);
    const executeIndex = args.findIndex(arg => arg === '-e' || arg === '--execute');
    const execute = executeIndex !== -1 ? args[executeIndex + 1] : undefined;
    
    if (execute) {
        debug('Executing command: %s', execute);
        await dialog.ask(execute);
    } else {
        debug('Starting interactive session.');
        startInteractiveSession();
    }
  };
} 