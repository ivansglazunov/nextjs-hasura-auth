import { Dialog, DialogEvent, DialogOptions } from './dialog';
import readline from 'readline';
import Debug from '../debug';

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
            case 'ai_chunk':
                process.stdout.write(event.chunk);
                break;
            case 'tool_call':
                process.stdout.write(`\n🤖 Calling tool: ${event.name}...\n`);
                break;
            case 'error':
                process.stderr.write(`\nAn error occurred: ${event.error}\n`);
                break;
            case 'done':
                process.stdout.write('\n');
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