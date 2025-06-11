import { NextResponse } from 'next/server';
import { Dialog, DialogEvent } from '../dialog';
import { OpenRouterProvider } from '../providers/openrouter';
import { AIMessage } from '../ai';
import { Tool } from '../tool';
import Debug from '../../debug';

const debug = Debug('handler:api-dialog');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

interface DialogHandlerOptions {
  tools: Tool[];
  systemPrompt: string;
}

export function generateDialogHandler(options: DialogHandlerOptions) {
  const { tools, systemPrompt } = options;

  return async function handleDialogRequest(request: Request) {
    debug('Handling dialog API request');
    
    if (request.method === 'OPTIONS') {
      debug('Received OPTIONS request, responding with CORS headers');
      return new NextResponse(null, { status: 204, headers: corsHeaders });
    }

    try {
      const body = await request.json();
      const messages: AIMessage[] = body.messages;
      debug('Request body parsed, %d messages received', messages?.length || 0);

      if (!messages) {
        debug('Missing messages in request body');
        return NextResponse.json({ error: 'Missing messages in request body' }, { status: 400, headers: corsHeaders });
      }

      if (!process.env.OPENROUTER_API_KEY) {
        console.error('OPENROUTER_API_KEY is not set.');
        return NextResponse.json({ error: 'Server not configured' }, { status: 500, headers: corsHeaders });
      }

      debug('Initializing OpenRouterProvider...');
      const provider = new OpenRouterProvider({
          token: process.env.OPENROUTER_API_KEY,
          model: 'anthropic/claude-3.5-sonnet',
      });

      let responseMessage: AIMessage | undefined;
      let hasError = false;

      debug('Creating new Dialog instance for the request');
      const dialog = new Dialog({
        provider,
        tools,
        systemPrompt,
        method: 'query',
        onChange: (event: DialogEvent) => {
          debug('Dialog event in API route: %s', event.type);
          if (event.type === 'ai_response') {
            responseMessage = { role: 'assistant', content: event.content };
          }
        },
        onError: (error) => {
          console.error('Dialog error in API route:', error);
          debug('Dialog error in API route: %o', error);
          hasError = true;
        }
      });

      const lastMessage = messages.pop();
      if (lastMessage) {
          debug('Asking dialog with message: "%s"', lastMessage.content);
          await dialog.ask(lastMessage);
      }
      
      if (hasError) {
        throw new Error('Dialog encountered an error during processing.');
      }

      debug('Returning response: %o', responseMessage);
      return NextResponse.json({ message: responseMessage }, { headers: corsHeaders });

    } catch (error) {
      debug('Error in /api/dialog handler: %o', error);
      console.error('Error in /api/dialog handler:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders });
    }
  }
} 