import dotenv from 'dotenv';
import * as path from 'path';
import { Hasura } from './hasura';
import Debug from './debug';

// Initialize debug
const debug = Debug('migration:down-logs');

/**
 * Drop permissions and untrack tables using high-level methods
 */
export async function dropMetadata(hasura: Hasura) {
  debug('🧹 Dropping permissions and untracking tables...');

  debug('  🗑️ Dropping permissions...');
  
  // Drop permissions for diffs table
  await hasura.deletePermission({
    schema: 'logs',
    table: 'diffs',
    operation: 'select',
    role: ['user', 'admin']
  });
  
  // Drop permissions for states table
  await hasura.deletePermission({
    schema: 'logs',
    table: 'states',
    operation: 'select',
    role: ['user', 'admin']
  });
  
  debug('  ✅ Permissions dropped.');

  debug('  🗑️ Untracking tables diffs and states...');
  await hasura.untrackTable({ schema: 'logs', table: 'diffs' });
  await hasura.untrackTable({ schema: 'logs', table: 'states' });
  debug('✅ Tables untracked.');
}

/**
 * Drop logs tables and functions
 */
export async function dropTables(hasura: Hasura) {
  debug('🧹 Dropping logs tables and functions...');
  
  // Drop triggers and functions
  await hasura.sql(`DROP TRIGGER IF EXISTS prevent_diffs_update_trigger ON logs.diffs;`);
  await hasura.sql(`DROP FUNCTION IF EXISTS prevent_diffs_update();`);
  
  // Drop tables
  await hasura.deleteTable({ schema: 'logs', table: 'diffs' });
  await hasura.deleteTable({ schema: 'logs', table: 'states' });
  
  // Drop schema
  await hasura.deleteSchema({ schema: 'logs' });
  
  debug('✅ Logs tables and schema dropped successfully.');
}

/**
 * Main migration function to remove hasyx logs tables
 */
export async function down(customHasura?: Hasura) {
  debug('🚀 Starting Hasura Logs migration DOWN...');
  
  const hasura = customHasura || new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!, 
    secret: process.env.HASURA_ADMIN_SECRET!,
  });
  
  try {
    // First remove metadata (tracking), as they depend on tables
    await dropMetadata(hasura);

    // Then drop the tables themselves
    await dropTables(hasura);

    debug('✨ Hasura Logs migration DOWN completed successfully!');
    return true;
  } catch (error) {
    console.error('❗ Critical error during Logs DOWN migration:', error);
    debug('❌ Logs DOWN Migration failed.');
    return false;
  }
} 