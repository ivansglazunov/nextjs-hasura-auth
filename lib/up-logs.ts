import dotenv from 'dotenv';
import * as path from 'path';
import { Hasura, ColumnType } from './hasura';
import Debug from './debug';

// Initialize debug
const debug = Debug('migration:up-logs');

export async function applySQLSchema(hasura: Hasura) {
  debug('🔧 Applying logs SQL schema...');
  
  // Ensure logs schema exists
  await hasura.defineSchema({ schema: 'logs' });
  
  // Define diffs table
  await hasura.defineTable({
    schema: 'logs',
    table: 'diffs',
    id: 'id',
    type: ColumnType.UUID
  });
  
  // Add diffs table columns
  await hasura.defineColumn({
    schema: 'logs',
    table: 'diffs',
    name: '_schema',
    type: ColumnType.TEXT,
    postfix: 'NOT NULL',
    comment: 'Source schema name'
  });
  
  await hasura.defineColumn({
    schema: 'logs',
    table: 'diffs',
    name: '_table',
    type: ColumnType.TEXT,
    postfix: 'NOT NULL',
    comment: 'Source table name'
  });
  
  await hasura.defineColumn({
    schema: 'logs',
    table: 'diffs',
    name: '_column',
    type: ColumnType.TEXT,
    postfix: 'NOT NULL',
    comment: 'Source column name'
  });
  
  await hasura.defineColumn({
    schema: 'logs',
    table: 'diffs',
    name: '_id',
    type: ColumnType.TEXT,
    postfix: 'NOT NULL',
    comment: 'Source record identifier'
  });
  
  await hasura.defineColumn({
    schema: 'logs',
    table: 'diffs',
    name: 'user_id',
    type: ColumnType.UUID,
    comment: 'User who made the change'
  });
  
  await hasura.defineColumn({
    schema: 'logs',
    table: 'diffs',
    name: 'created_at',
    type: ColumnType.TIMESTAMPTZ,
    postfix: 'DEFAULT NOW()',
    comment: 'When the diff was created'
  });
  
  await hasura.defineColumn({
    schema: 'logs',
    table: 'diffs',
    name: 'updated_at',
    type: ColumnType.TIMESTAMPTZ,
    comment: 'When the diff was updated (should error on update)'
  });
  
  await hasura.defineColumn({
    schema: 'logs',
    table: 'diffs',
    name: '_value',
    type: ColumnType.TEXT,
    comment: 'New value before diff calculation'
  });
  
  await hasura.defineColumn({
    schema: 'logs',
    table: 'diffs',
    name: 'diff',
    type: ColumnType.TEXT,
    comment: 'Calculated diff from previous state'
  });
  
  await hasura.defineColumn({
    schema: 'logs',
    table: 'diffs',
    name: 'processed',
    type: ColumnType.BOOLEAN,
    postfix: 'DEFAULT FALSE',
    comment: 'Whether the diff has been processed by event trigger'
  });
  
  // Define states table
  await hasura.defineTable({
    schema: 'logs',
    table: 'states',
    id: 'id',
    type: ColumnType.UUID
  });
  
  // Add states table columns
  await hasura.defineColumn({
    schema: 'logs',
    table: 'states',
    name: '_schema',
    type: ColumnType.TEXT,
    postfix: 'NOT NULL',
    comment: 'Source schema name'
  });
  
  await hasura.defineColumn({
    schema: 'logs',
    table: 'states',
    name: '_table',
    type: ColumnType.TEXT,
    postfix: 'NOT NULL',
    comment: 'Source table name'
  });
  
  await hasura.defineColumn({
    schema: 'logs',
    table: 'states',
    name: '_column',
    type: ColumnType.TEXT,
    postfix: 'NOT NULL',
    comment: 'Source column name'
  });
  
  await hasura.defineColumn({
    schema: 'logs',
    table: 'states',
    name: '_id',
    type: ColumnType.TEXT,
    postfix: 'NOT NULL',
    comment: 'Source record identifier'
  });
  
  await hasura.defineColumn({
    schema: 'logs',
    table: 'states',
    name: 'user_id',
    type: ColumnType.UUID,
    comment: 'User who made the change'
  });
  
  await hasura.defineColumn({
    schema: 'logs',
    table: 'states',
    name: 'created_at',
    type: ColumnType.TIMESTAMPTZ,
    postfix: 'DEFAULT NOW()',
    comment: 'When the state was captured'
  });
  
  await hasura.defineColumn({
    schema: 'logs',
    table: 'states',
    name: 'state',
    type: ColumnType.JSONB,
    comment: 'State snapshot (null for delete)'
  });
  
  // Create constraint for diffs to prevent updates (except for diff and processed fields)
  await hasura.sql(`
    CREATE OR REPLACE FUNCTION prevent_diffs_update()
    RETURNS TRIGGER AS $$
    BEGIN
      IF TG_OP = 'UPDATE' THEN
        -- Allow updates only to diff and processed fields
        IF (OLD._schema IS DISTINCT FROM NEW._schema OR
            OLD._table IS DISTINCT FROM NEW._table OR
            OLD._column IS DISTINCT FROM NEW._column OR
            OLD._id IS DISTINCT FROM NEW._id OR
            OLD.user_id IS DISTINCT FROM NEW.user_id OR
            OLD.created_at IS DISTINCT FROM NEW.created_at OR
            OLD._value IS DISTINCT FROM NEW._value) THEN
          RAISE EXCEPTION 'Updates to core diffs fields are not allowed to preserve history integrity. Only diff and processed fields can be updated.';
        END IF;
      END IF;
      RETURN COALESCE(NEW, OLD);
    END;
    $$ LANGUAGE plpgsql;
  `);
  
  await hasura.sql(`
    DROP TRIGGER IF EXISTS prevent_diffs_update_trigger ON logs.diffs;
    CREATE TRIGGER prevent_diffs_update_trigger
      BEFORE UPDATE ON logs.diffs
      FOR EACH ROW
      EXECUTE FUNCTION prevent_diffs_update();
  `);
  
  debug('✅ Logs SQL schema applied successfully.');
}

export async function trackTables(hasura: Hasura) {
  debug('🔍 Tracking logs tables...');
  
  await hasura.trackTable({ schema: 'logs', table: 'diffs' });
  await hasura.trackTable({ schema: 'logs', table: 'states' });
  
  debug('✅ Logs tables tracked successfully.');
}

export async function applyPermissions(hasura: Hasura) {
  debug('🔐 Applying permissions for logs tables...');
  
  // Diffs permissions - read-only for users
  await hasura.definePermission({
    schema: 'logs',
    table: 'diffs',
    operation: 'select',
    role: 'user',
    filter: {},
    columns: ['id', '_schema', '_table', '_column', '_id', 'user_id', 'created_at', 'diff']
  });
  
  await hasura.definePermission({
    schema: 'logs',
    table: 'diffs',
    operation: 'select',
    role: 'admin',
    filter: {},
    columns: ['id', '_schema', '_table', '_column', '_id', 'user_id', 'created_at', 'updated_at', '_value', 'diff']
  });
  
  // States permissions - read-only for users
  await hasura.definePermission({
    schema: 'logs',
    table: 'states',
    operation: 'select',
    role: 'user',
    filter: {},
    columns: ['id', '_schema', '_table', '_column', '_id', 'user_id', 'created_at', 'state']
  });
  
  await hasura.definePermission({
    schema: 'logs',
    table: 'states',
    operation: 'select',
    role: 'admin',
    filter: {},
    columns: ['id', '_schema', '_table', '_column', '_id', 'user_id', 'created_at', 'state']
  });
  
  debug('✅ Logs permissions applied successfully.');
}

/**
 * Main migration function to create hasyx logs tables
 */
export async function up(customHasura?: Hasura) {
  debug('🚀 Starting Hasura Logs migration UP...');
  
  const hasura = customHasura || new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!, 
    secret: process.env.HASURA_ADMIN_SECRET!,
  });
  
  try {
    // Apply SQL schema
    await applySQLSchema(hasura);

    // Track tables in Hasura metadata
    await trackTables(hasura);

    // Apply permissions
    await applyPermissions(hasura);

    debug('✨ Hasura Logs migration UP completed successfully!');
    return true;
  } catch (error) {
    console.error('❗ Critical error during Logs UP migration:', error);
    debug('❌ Logs UP Migration failed.');
    return false;
  }
} 