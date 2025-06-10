import { NextResponse } from 'next/server';
import { TelegramUpdate, sendTelegramMessage } from 'hasyx/lib/telegram-bot';
import Debug from 'hasyx/lib/debug';
import { Dialog, DialogEvent } from 'hasyx/lib/ai/dialog';
import { OpenRouterProvider } from 'hasyx/lib/ai/providers/openrouter';
import { AIMessage } from 'hasyx/lib/ai/ai';
import { ExecJSTool } from 'hasyx/lib/ai/tools/exec-js-tool';
import { TerminalTool } from 'hasyx/lib/ai/tools/terminal-tool';
import { Tool } from 'hasyx/lib/ai/tool';

const debug = Debug('api:telegram_bot');

const dialogs = new Map<number, Dialog>();

const getSystemPrompt = (tools: Tool[]) => `
You are a helpful assistant integrated into Telegram.
You have access to the following tools:
${tools.map(t => `- ${t.name}: ${t.contextPreprompt}`).join('\n')}
`;

const handleEvent = async (chatId: number, event: DialogEvent) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN!;
  debug(`Dialog event for chat ${chatId}:`, event.type);
  switch (event.type) {
    case 'error':
      await sendTelegramMessage(botToken, chatId, `An error occurred: ${event.error}`);
      break;
    case 'tool_call':
      await sendTelegramMessage(botToken, chatId, `*Calling tool:* \`${event.name}\`\n*Command:* \`${event.command}\`\n\`\`\`\n${event.content}\n\`\`\``, { parse_mode: 'Markdown' });
      break;
    case 'tool_result':
      const output = event.result.length > 3800 ? `${event.result.substring(0, 3800)}... (truncated)` : event.result;
      await sendTelegramMessage(botToken, chatId, `*Tool result for* \`${event.id}\`:\n\`\`\`\n${output}\n\`\`\``, { parse_mode: 'Markdown' });
      break;
    case 'ai_chunk':
      // This is where message streaming would be handled.
      // For Telegram, this typically involves editing a message repeatedly.
      // Let's leave this blank for now and just send the final message.
      break;
    case 'ai_response':
      // To avoid sending an empty message if ai_chunk is not handled, check content
      if (event.content) {
        await sendTelegramMessage(botToken, chatId, event.content);
      }
      break;
  }
};

export async function POST(request: Request) {
  debug('Received POST request to /api/telegram_bot');

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

    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.OPENROUTER_API_KEY) {
      console.error('TELEGRAM_BOT_TOKEN or OPENROUTER_API_KEY is not set.');
      await sendTelegramMessage(process.env.TELEGRAM_BOT_TOKEN!, chatId, `Server is not configured correctly.`);
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    let dialog = dialogs.get(chatId);

    if (text.toLowerCase().trim() === '/start') {
        dialogs.delete(chatId); // Reset dialog on /start
        dialog = undefined;
        await sendTelegramMessage(process.env.TELEGRAM_BOT_TOKEN!, chatId, `Hello! I am your AI assistant. Your session has been reset. Send me a task.`);
        return NextResponse.json({ success: true });
    }
      
    if (!dialog) {
      debug(`Creating new Dialog for chat ${chatId}`);
      const provider = new OpenRouterProvider({ token: process.env.OPENROUTER_API_KEY, model: 'google/gemini-flash-1.5' });
      const tools = [new ExecJSTool(), new TerminalTool()];
      
      dialog = new Dialog({
        provider,
        tools,
        systemPrompt: getSystemPrompt(tools),
        onChange: (event: DialogEvent) => handleEvent(chatId, event),
        onError: async (error) => {
          debug(`Dialog error for chat ${chatId}:`, error);
          await sendTelegramMessage(process.env.TELEGRAM_BOT_TOKEN!, chatId, `An error occurred: ${error}`);
        }
      });
      dialogs.set(chatId, dialog);
    }

    const userMessage: AIMessage = { role: 'user', content: text };
    dialog.ask(userMessage);

    return NextResponse.json({ success: true, message: 'Processing started' });

  } catch (error) {
    debug('Error in telegram_bot route:', error);
    console.error('❌ Error processing Telegram webhook:', error);
    // We cannot reliably get chatId here if payload parsing fails
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 