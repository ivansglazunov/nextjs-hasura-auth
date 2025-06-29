import { NextRequest, NextResponse } from 'next/server';
import { validateTelegramInitData } from 'hasyx/lib/telegram-miniapp-server';
import Debug from 'hasyx/lib/debug';
import { withCors } from 'hasyx/lib/cors';

const debug = Debug('api:auth:verify-telegram-webapp');

export async function POST(request: NextRequest) {
  console.log('🚀 Server: verify-telegram-webapp POST request received');
  
  try {
    const { initData } = await request.json();
    console.log('🔍 Server: Request body initData length:', initData?.length);
    
    if (!initData) {
      console.error('🔴 Server: No initData in request');
      return NextResponse.json({ error: 'No initData provided' }, { status: 400 });
    }

    const botToken = process.env.TELEGRAM_LOGIN_BOT_TOKEN;
    console.log('🔍 Server: Bot token present:', !!botToken);
    
    if (!botToken) {
      console.error('🔴 Server: No bot token in environment');
      return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 });
    }

    console.log('🔍 Server: Calling validateTelegramInitData...');
    const isValid = validateTelegramInitData(initData, botToken);
    console.log('🔍 Server: Validation result:', isValid);

    if (!isValid) {
      console.error('🔴 Server: Validation failed, returning 401');
      return NextResponse.json({ error: 'Invalid Telegram data' }, { status: 401 });
    }

    console.log('✅ Server: Validation successful, returning 200');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('🔴 Server: Error in verify-telegram-webapp:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest) {
  return withCors(request, () => {
    return new NextResponse(null, { status: 200 });
  });
} 