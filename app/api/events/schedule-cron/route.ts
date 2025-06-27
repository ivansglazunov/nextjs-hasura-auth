import { NextRequest, NextResponse } from 'next/server';
import { Hasyx } from 'hasyx/lib/hasyx';
import { createApolloClient } from 'hasyx/lib/apollo';
import { Generator } from 'hasyx/lib/generator';
import schema from 'hasyx/app/hasyx/hasura-schema.json';
import { handleScheduleEvent } from 'hasyx/lib/schedule-event';

export async function GET(request: NextRequest) {
  return handleCron();
}

export async function POST(request: NextRequest) {
  return handleCron();
}

async function handleCron() {
  try {
    // Create admin client for database operations
    const adminClient = createApolloClient({
      url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
      secret: process.env.HASURA_ADMIN_SECRET!,
    });
    
    const hasyx = new Hasyx(adminClient, Generator(schema));
    
    // Process scheduled events with default handler
    await handleScheduleEvent(hasyx);
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: 'Schedule cron processing completed'
    });
  } catch (error) {
    console.error('Schedule cron processing error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 