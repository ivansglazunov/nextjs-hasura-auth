import { NextResponse } from 'next/server';
import { TelegramUpdate, sendTelegramMessage } from '../telegram-bot';
import Debug from '../debug';
import { Dialog, DialogEvent } from './dialog';
import { OpenRouterProvider } from './providers/openrouter';
import { AIMessage } from './ai';
import { Tool } from './tool';

const debug = Debug('ai:telegram');

interface TelegramHandlerOptions {
  tools: Tool[];
  getSystemPrompt: (tools: Tool[]) => string;
}

export function generateTelegramHandler(options: TelegramHandlerOptions) {
  const dialogs = new Map<number, Dialog>();
  const { tools, getSystemPrompt } = options;

  const handleEvent = async (chatId: number, event: DialogEvent) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN!;
    debug(`Dialog event for chat ${chatId}:`, event.type);
    debug(`Event details:`, JSON.stringify(event, null, 2));
    switch (event.type) {
      case 'error':
        debug(`Sending error message to chat ${chatId}: ${event.error}`);
        await sendTelegramMessage(botToken, chatId, `An error occurred: ${event.error}`);
        break;
      case 'tool_call':
        debug(`Tool call event - name: ${event.name}, command: ${event.command}, content length: ${event.content?.length || 0}`);
        await sendTelegramMessage(botToken, chatId, `*Calling tool:* \`${event.name}\`\n*Command:* \`${event.command}\`\n\`\`\`\n${event.content}\n\`\`\``, { parse_mode: 'Markdown' });
        break;
      case 'tool_result':
        debug(`Tool result event - id: ${event.id}, result length: ${event.result?.length || 0}, has error: ${!!event.error}`);
        if (event.error) {
          debug(`Tool result error: ${event.error}`);
        }
        const output = event.result.length > 3800 ? `${event.result.substring(0, 3800)}... (truncated)` : event.result;
        await sendTelegramMessage(botToken, chatId, `*Tool result for* \`${event.id}\`:\n\`\`\`\n${output}\n\`\`\``, { parse_mode: 'Markdown' });
        break;
      case 'ai_chunk':
        debug(`AI chunk event - chunk length: ${event.chunk?.length || 0}`);
        // Streaming logic will be implemented here later
        break;
      case 'ai_response':
        debug(`AI response event - content length: ${event.content?.length || 0}`);
        if (event.content) {
          await sendTelegramMessage(botToken, chatId, event.content);
        }
        break;
      case 'done':
        debug(`Dialog completed for chat ${chatId}`);
        // No action needed - conversation is complete
        break;
      default:
        debug(`Unknown event type: ${(event as any).type}`);
    }
  };

  return async function handleTelegramRequest(request: Request) {
    debug('Handling Telegram request');
    try {
      const payload = (await request.json()) as TelegramUpdate;
      debug('Parsed payload:', JSON.stringify(payload, null, 2));

      const { message } = payload;
      if (!message || !message.text || !message.chat?.id) {
        debug('Ignoring non-text message or message without chat ID.');
        return NextResponse.json({ success: true, message: 'Not a text message to handle' });
      }

      const chatId = message.chat.id;
      const text = message.text;
      debug(`Processing message from chat ${chatId}: "${text}"`);

      if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.OPENROUTER_API_KEY) {
        debug('Missing required environment variables: TELEGRAM_BOT_TOKEN or OPENROUTER_API_KEY');
        console.error('TELEGRAM_BOT_TOKEN or OPENROUTER_API_KEY is not set.');
        await sendTelegramMessage(process.env.TELEGRAM_BOT_TOKEN!, chatId, `Server is not configured correctly.`);
        return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
      }

      let dialog = dialogs.get(chatId);
      debug(`Dialog exists for chat ${chatId}: ${!!dialog}`);

      if (text.toLowerCase().trim() === '/start') {
        debug(`Processing /start command for chat ${chatId}`);
        dialogs.delete(chatId);
        dialog = undefined;
        await sendTelegramMessage(process.env.TELEGRAM_BOT_TOKEN!, chatId, `Hello! I am your AI assistant. Your session has been reset. Send me a task.`);
        return NextResponse.json({ success: true });
      }

      if (!dialog) {
        debug(`Creating new Dialog for chat ${chatId}`);
        debug('Available tools:', tools?.map(t => t.name) || []);
        const provider = new OpenRouterProvider({ token: process.env.OPENROUTER_API_KEY, model: 'deepseek/deepseek-chat-v3-0324:free' });

        dialog = new Dialog({
          provider,
          tools,
          systemPrompt: getSystemPrompt(tools),
          onChange: (event: DialogEvent) => {
            debug(`Dialog onChange event for chat ${chatId}:`, event.type);
            return handleEvent(chatId, event);
          },
          onError: async (error) => {
            debug(`Dialog error for chat ${chatId}:`, error);
            await sendTelegramMessage(process.env.TELEGRAM_BOT_TOKEN!, chatId, `An error occurred: ${error}`);
          }
        });
        dialogs.set(chatId, dialog);
        debug(`Dialog created and stored for chat ${chatId}`);
      }

      const userMessage: AIMessage = { role: 'user', content: text };
      debug(`Sending message to dialog for chat ${chatId}:`, userMessage);
      dialog.ask(userMessage);
      debug(`Message sent to dialog for chat ${chatId}`);

      return NextResponse.json({ success: true, message: 'Processing started' });

    } catch (error) {
      debug('Error in telegram handler:', error);
      console.error('❌ Error processing Telegram webhook:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
} 