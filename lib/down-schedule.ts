import dotenv from 'dotenv';
import path from 'path';
import { Hasura } from './hasura';
import Debug from './debug';

// Initialize debug
const debug = Debug('migration:down-schedule');

/**
 * Drop permissions and untrack tables using high-level methods
 */
export async function dropMetadata(hasura: Hasura) {
  debug('🧹 Dropping permissions and untracking tables...');

  debug('  🗑️ Dropping permissions...');
  
  // Drop permissions for schedule table
  await hasura.deletePermission({
    schema: 'public',
    table: 'schedule',
    operation: 'select',
    role: ['user', 'admin']
  });
  
  await hasura.deletePermission({
    schema: 'public',
    table: 'schedule',
    operation: 'insert',
    role: ['user']
  });
  
  await hasura.deletePermission({
    schema: 'public',
    table: 'schedule',
    operation: 'update',
    role: ['user']
  });
  
  await hasura.deletePermission({
    schema: 'public',
    table: 'schedule',
    operation: 'delete',
    role: ['user']
  });
  
  // Drop permissions for events table
  await hasura.deletePermission({
    schema: 'public',
    table: 'events',
    operation: 'select',
    role: ['user', 'admin']
  });
  
  await hasura.deletePermission({
    schema: 'public',
    table: 'events',
    operation: 'insert',
    role: ['user']
  });
  
  await hasura.deletePermission({
    schema: 'public',
    table: 'events',
    operation: 'update',
    role: ['user']
  });
  
  await hasura.deletePermission({
    schema: 'public',
    table: 'events',
    operation: 'delete',
    role: ['user']
  });
  
  debug('  ✅ Permissions dropped.');

  debug('  🗑️ Dropping relationships...');
  
  // Drop relationships
  await hasura.deleteRelationship({
    schema: 'public',
    table: 'events',
    name: 'schedule'
  });
  
  await hasura.deleteRelationship({
    schema: 'public',
    table: 'schedule',
    name: 'events'
  });
  
  debug('  ✅ Relationships dropped.');

  debug('  🗑️ Untracking tables schedule and events...');
  await hasura.untrackTable({ schema: 'public', table: 'events' });
  await hasura.untrackTable({ schema: 'public', table: 'schedule' });
  debug('✅ Tables untracked.');
}

/**
 * Drop schedule and events tables using high-level methods
 */
export async function dropTables(hasura: Hasura) {
  debug('🧹 Dropping tables schedule and events...');
  
  // Drop foreign key constraints first
  await hasura.deleteForeignKey({
    schema: 'public',
    table: 'events',
    name: 'events_schedule_id_fkey'
  });
  
  // Drop tables
  await hasura.deleteTable({ schema: 'public', table: 'events' });
  await hasura.deleteTable({ schema: 'public', table: 'schedule' });
  
  debug('✅ Tables dropped successfully.');
}

/**
 * Main migration function to remove hasyx schedule tables
 */
export async function down(customHasura?: Hasura) {
  debug('🚀 Starting Hasura Schedule migration DOWN...');
  
  const hasura = customHasura || new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!, 
    secret: process.env.HASURA_ADMIN_SECRET!,
  });
  
  try {
    // First remove metadata (tracking), as they depend on tables
    await dropMetadata(hasura);

    // Then drop the tables themselves
    await dropTables(hasura);

    debug('✨ Hasura Schedule migration DOWN completed successfully!');
    return true;
  } catch (error) {
    console.error('❗ Critical error during Schedule DOWN migration:', error);
    debug('❌ Schedule DOWN Migration failed.');
    return false;
  }
} 