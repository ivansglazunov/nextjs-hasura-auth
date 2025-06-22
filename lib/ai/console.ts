import Debug from '../debug';
import { Dialog, DialogEvent } from './dialog';
import { ApiRouteProvider } from './providers/api-route';
import { AIMessage } from './ai';

const debug = Debug('ai:console');

export function generateConsole() {
  const provider = new ApiRouteProvider();

  const handleEvent = (event: DialogEvent) => {
    debug(`Dialog event:`, event.type);
    switch (event.type) {
      case 'error':
        console.error(`An error occurred: ${event.error}`);
        break;
      case 'tool_call':
        console.log(`\n🤖 Calling tool: ${event.name}`);
        console.log(`   Command: ${event.command}`);
        console.log(`   Content: ${event.content}`);
        break;
      case 'tool_result':
        console.log(`\nTool result for ${event.id}:`);
        console.log(event.result);
        if (event.error) {
          console.error(`Tool error: ${event.error}`);
        }
        break;
      case 'ai_response':
        if (event.content) {
          console.log(`\n🧠 Assistant:\n${event.content}`);
        }
        break;
      case 'done':
        console.log('\n✅ Done.');
        break;
    }
  };

  const dialog = new Dialog({
    provider,
    // In this setup, tools and system prompt are managed by the API route
    method: 'query', // Use query method to interact with our backend
    onChange: handleEvent,
    onError: (error) => {
      debug(`Dialog error:`, error);
      console.error(`An error occurred in the dialog: ${error}`);
    }
  });

  // Expose a simplified ask method
  return dialog;
} 