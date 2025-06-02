import { NextRequest, NextResponse } from 'next/server';
import { handleWstunnel, WstunnelOptions } from 'hasyx/lib/wstunnel';
import Debug from 'hasyx/lib/debug';

const debug = Debug('api:wstunnel');

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
): Promise<NextResponse> {
  const { uuid } = await params;
  debug(`Received POST request to /api/wstunnel/${uuid}`);
  
  try {
    if (!uuid) {
      debug('Missing UUID parameter');
      return NextResponse.json(
        { success: false, error: 'UUID parameter is required' },
        { status: 400 }
      );
    }
    
    // Parse query parameters for undefine option
    const url = new URL(request.url);
    const undefine = url.searchParams.get('undefine') === '1';
    
    debug(`Processing wstunnel request for UUID: ${uuid}, undefine: ${undefine}`);
    
    // Prepare options
    const options: WstunnelOptions = {
      uuid: uuid,
      undefine: undefine
    };
    
    // Call handleWstunnel function
    const result = await handleWstunnel(options);
    
    debug(`Wstunnel request processed with result:`, result);
    
    if (result.success) {
      return NextResponse.json(result, { status: 200 });
    } else {
      return NextResponse.json(result, { status: 500 });
    }
    
  } catch (error) {
    debug('Error in /api/wstunnel POST handler:', error);
    console.error('Error processing wstunnel request:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process wstunnel request', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    );
  }
} 