import { NextRequest, NextResponse } from 'next/server';
import { validateTelegramInitData } from 'hasyx/lib/telegram-miniapp-server';
import Debug from 'hasyx/lib/debug';
import { withCors } from 'hasyx/lib/cors';

const debug = Debug('api:auth:verify-telegram-webapp');

export async function POST(request: NextRequest) {
  return withCors(request, async (req) => {
    debug('Telegram WebApp verification request received');
    
    try {
      const body = await req.json();
      const { initData } = body;

      if (!initData) {
        debug('No initData provided');
        return NextResponse.json(
          { valid: false, error: 'Missing initData' },
          { status: 400 }
        );
      }

      debug('Validating initData...');
      const isValid = await validateTelegramInitData(initData);
      
      debug('Validation result:', { valid: isValid });

      if (isValid) {
        return NextResponse.json({ valid: true });
      } else {
        return NextResponse.json(
          { valid: false, error: 'Invalid Telegram data' },
          { status: 401 }
        );
      }

    } catch (error: any) {
      debug('Error during verification:', error);
      return NextResponse.json(
        { 
          valid: false, 
          error: 'Server error during verification' 
        },
        { status: 500 }
      );
    }
  });
}

export async function OPTIONS(request: NextRequest) {
  return withCors(request, () => {
    return new NextResponse(null, { status: 200 });
  });
} 