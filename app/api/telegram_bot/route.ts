'use server';

import { NextRequest, NextResponse } from 'next/server';
import { TelegramBot } from 'hasyx/lib/telegram-bot';
import { handleTelegramBot } from 'hasyx/lib/telegram-handler';
import Debug from 'hasyx/lib/debug';

const debug = Debug('api:telegram_bot:route');

export async function POST(request: NextRequest) {
  debug('POST /api/telegram_bot request received');
  
  return handleTelegramBot(request, async ({ bot, chat, message, username }) => {
    await chat.sendMessage(`Hello ${username}, I received your message: "${message?.text}"`);
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  debug('GET /api/telegram_bot request received');
  return handleTelegramBot(request);
} 
