import dotenv from 'dotenv';
import path from 'path';
import { Hasura, ColumnType } from './hasura';
import Debug from './debug';

// Initialize debug
const debug = Debug('migration:up-schedule');

export async function applySQLSchema(hasura: Hasura) {
  debug('🔧 Applying schedule SQL schema...');
  
  // Ensure public schema exists
  await hasura.defineSchema({ schema: 'public' });
  
  // Define schedule table
  await hasura.defineTable({
    schema: 'public',
    table: 'schedule',
    id: 'id',
    type: ColumnType.UUID
  });
  
  // Add schedule table columns
  await hasura.defineColumn({
    schema: 'public',
    table: 'schedule',
    name: 'message_id',
    type: ColumnType.UUID,
    comment: 'Message ID reference'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'schedule',
    name: 'cron',
    type: ColumnType.TEXT,
    postfix: 'NOT NULL',
    comment: 'Cron expression for scheduling'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'schedule',
    name: 'start_at',
    type: ColumnType.BIGINT,
    postfix: 'NOT NULL',
    comment: 'Unix timestamp start time'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'schedule',
    name: 'end_at',
    type: ColumnType.BIGINT,
    postfix: 'NOT NULL',
    comment: 'Unix timestamp end time'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'schedule',
    name: 'user_id',
    type: ColumnType.UUID,
    comment: 'User who created this schedule'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'schedule',
    name: 'created_at',
    type: ColumnType.TIMESTAMPTZ,
    postfix: 'DEFAULT NOW()',
    comment: 'Creation timestamp'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'schedule',
    name: 'updated_at',
    type: ColumnType.TIMESTAMPTZ,
    postfix: 'DEFAULT NOW()',
    comment: 'Last update timestamp'
  });
  
  // Define events table
  await hasura.defineTable({
    schema: 'public',
    table: 'events',
    id: 'id',
    type: ColumnType.UUID
  });
  
  // Add events table columns
  await hasura.defineColumn({
    schema: 'public',
    table: 'events',
    name: 'schedule_id',
    type: ColumnType.UUID,
    comment: 'Reference to schedule table'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'events',
    name: 'message_id',
    type: ColumnType.UUID,
    postfix: 'NOT NULL',
    comment: 'Message ID reference'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'events',
    name: 'user_id',
    type: ColumnType.UUID,
    comment: 'User who created this event'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'events',
    name: 'plan_start',
    type: ColumnType.BIGINT,
    comment: 'Planned start unix timestamp'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'events',
    name: 'start',
    type: ColumnType.BIGINT,
    comment: 'Actual start unix timestamp'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'events',
    name: 'end',
    type: ColumnType.BIGINT,
    comment: 'Actual end unix timestamp'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'events',
    name: 'plan_end',
    type: ColumnType.BIGINT,
    comment: 'Planned end unix timestamp'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'events',
    name: 'status',
    type: ColumnType.TEXT,
    postfix: "DEFAULT 'pending'",
    comment: 'Event status: pending, in_progress, completed, cancelled'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'events',
    name: 'scheduled',
    type: ColumnType.BOOLEAN,
    postfix: 'DEFAULT FALSE',
    comment: 'Whether event has been processed by scheduler'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'events',
    name: 'created_at',
    type: ColumnType.TIMESTAMPTZ,
    postfix: 'DEFAULT NOW()',
    comment: 'Creation timestamp'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'events',
    name: 'updated_at',
    type: ColumnType.TIMESTAMPTZ,
    postfix: 'DEFAULT NOW()',
    comment: 'Last update timestamp'
  });
  
  debug('✅ Schedule SQL schema applied successfully.');
}

export async function trackTables(hasura: Hasura) {
  debug('📊 Tracking schedule tables...');
  
  await hasura.trackTable({ schema: 'public', table: 'schedule' });
  await hasura.trackTable({ schema: 'public', table: 'events' });
  
  debug('✅ Schedule tables tracked successfully.');
}

export async function createRelationships(hasura: Hasura) {
  debug('🔗 Creating schedule relationships...');
  
  // events -> schedule relationship
  await hasura.defineRelationship({
    schema: 'public',
    table: 'events',
    name: 'schedule',
    type: 'object',
    using: {
      foreign_key_constraint_on: 'schedule_id'
    }
  });
  
  // schedule -> events relationship
  await hasura.defineRelationship({
    schema: 'public',
    table: 'schedule',
    name: 'events',
    type: 'array',
    using: {
      foreign_key_constraint_on: {
        table: { schema: 'public', name: 'events' },
        column: 'schedule_id'
      }
    }
  });
  
  debug('✅ Schedule relationships created successfully.');
}

export async function applyPermissions(hasura: Hasura) {
  debug('🔒 Applying schedule permissions...');
  
  // Schedule table permissions
  await hasura.definePermission({
    schema: 'public',
    table: 'schedule',
    operation: 'select',
    role: 'user',
    filter: { user_id: { _eq: 'X-Hasura-User-Id' } },
    columns: ['id', 'message_id', 'cron', 'start_at', 'end_at', 'user_id', 'created_at', 'updated_at']
  });
  
  await hasura.definePermission({
    schema: 'public',
    table: 'schedule',
    operation: 'insert',
    role: 'user',
    filter: { user_id: { _eq: 'X-Hasura-User-Id' } },
    columns: ['message_id', 'cron', 'start_at', 'end_at'],
  });
  
  await hasura.definePermission({
    schema: 'public',
    table: 'schedule',
    operation: 'update',
    role: 'user',
    filter: { user_id: { _eq: 'X-Hasura-User-Id' } },
    columns: ['message_id', 'cron', 'start_at', 'end_at']
  });
  
  await hasura.definePermission({
    schema: 'public',
    table: 'schedule',
    operation: 'delete',
    role: 'user',
    filter: { user_id: { _eq: 'X-Hasura-User-Id' } },
  });
  
  // Events table permissions
  await hasura.definePermission({
    schema: 'public',
    table: 'events',
    operation: 'select',
    role: 'user',
    filter: { user_id: { _eq: 'X-Hasura-User-Id' } },
    columns: ['id', 'schedule_id', 'message_id', 'user_id', 'plan_start', 'start', 'end', 'plan_end', 'status', 'scheduled', 'created_at', 'updated_at'],
  });
  
  await hasura.definePermission({
    schema: 'public',
    table: 'events',
    operation: 'insert',
    role: 'user',
    filter: { user_id: { _eq: 'X-Hasura-User-Id' } },
    columns: ['schedule_id', 'message_id', 'plan_start', 'plan_end'],
  });
  
  await hasura.definePermission({
    schema: 'public',
    table: 'events',
    operation: 'update',
    role: 'user',
    filter: { user_id: { _eq: 'X-Hasura-User-Id' } },
    columns: ['plan_start', 'start', 'end', 'plan_end', 'status']
  });
  
  await hasura.definePermission({
    schema: 'public',
    table: 'events',
    operation: 'delete',
    role: 'user',
    filter: { user_id: { _eq: 'X-Hasura-User-Id' } },
  });
  
  // Admin permissions for both tables
  await hasura.definePermission({
    schema: 'public',
    table: 'schedule',
    operation: 'select',
    role: 'admin',
    filter: {},
    columns: ['id', 'message_id', 'cron', 'start_at', 'end_at', 'user_id', 'created_at', 'updated_at']
  });
  
  await hasura.definePermission({
    schema: 'public',
    table: 'events',
    operation: 'select',
    role: 'admin',
    filter: {},
    columns: ['id', 'schedule_id', 'message_id', 'user_id', 'plan_start', 'start', 'end', 'plan_end', 'status', 'scheduled', 'created_at', 'updated_at'],
  });
  
  debug('✅ Schedule permissions applied successfully.');
}

/**
 * Main migration function to create schedule and events tables
 */
export async function up(customHasura?: Hasura) {
  debug('🚀 Starting Hasura Schedule migration UP...');
  
  const hasura = customHasura || new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!, 
    secret: process.env.HASURA_ADMIN_SECRET!,
  });
  
  try {
    // First create the schema and tables
    await applySQLSchema(hasura);

    // Track tables so they show up in Hasura console
    await trackTables(hasura);

    // Create relationships between tables
    await createRelationships(hasura);

    // Apply permissions for proper access control
    await applyPermissions(hasura);

    debug('✨ Hasura Schedule migration UP completed successfully!');
    return true;
  } catch (error) {
    console.error('❗ Critical error during Schedule UP migration:', error);
    debug('❌ Schedule UP Migration failed.');
    return false;
  }
}