import dotenv from 'dotenv';
import path from 'path';
import { Hasura } from './hasura';
import Debug from './debug';

// Initialize debug
const debug = Debug('migration:down-users');

/**
 * Drop permissions and untrack tables using high-level methods
 */
export async function dropMetadata(hasura: Hasura) {
  debug('🧹 Dropping permissions and untracking tables...');

  debug('  🗑️ Dropping permissions...');
  
  // Drop permissions for users table
  await hasura.deletePermission({
    schema: 'public',
    table: 'users',
    operation: 'select',
    role: ['user', 'me', 'admin', 'anonymous']
  });
  
  // Drop permissions for accounts table
  await hasura.deletePermission({
    schema: 'public',
    table: 'accounts',
    operation: 'select',
    role: ['user', 'me', 'admin', 'anonymous']
  });
  
  // Drop permissions for auth_passive table
  await hasura.deletePermission({
    schema: 'public',
    table: 'auth_passive',
    operation: 'select',
    role: ['admin']
  });
  
  debug('  ✅ Permissions dropped.');

  debug('  🗑️ Dropping relationships...');
  
  // Drop relationships
  await hasura.deleteRelationship({
    schema: 'public',
    table: 'accounts',
    name: 'user'
  });
  
  await hasura.deleteRelationship({
    schema: 'public',
    table: 'users',
    name: 'accounts'
  });
  
  debug('  ✅ Relationships dropped.');

  debug('  🗑️ Untracking tables users, accounts and auth_passive...');
  await hasura.untrackTable({ schema: 'public', table: 'auth_passive' });
  await hasura.untrackTable({ schema: 'public', table: 'accounts' });
  await hasura.untrackTable({ schema: 'public', table: 'users' });
  debug('✅ Tables untracked.');
}

/**
 * Drop user and account tables using high-level methods
 */
export async function dropTables(hasura: Hasura) {
  debug('🧹 Dropping tables users and accounts...');
  
  // Drop foreign key constraints first
  await hasura.deleteForeignKey({
    schema: 'public',
    table: 'accounts',
    name: 'accounts_user_id_fkey'
  });
  
  // Drop tables
  await hasura.deleteTable({ schema: 'public', table: 'auth_passive' });
  await hasura.deleteTable({ schema: 'public', table: 'accounts' });
  await hasura.deleteTable({ schema: 'public', table: 'users' });
  
  debug('✅ Tables dropped successfully.');
}

/**
 * Main migration function to remove hasyx users tables
 */
export async function down(customHasura?: Hasura) {
  debug('🚀 Starting Hasura Users migration DOWN...');
  
  const hasura = customHasura || new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!, 
    secret: process.env.HASURA_ADMIN_SECRET!,
  });
  
  try {
    // First remove metadata (tracking), as they depend on tables
    await dropMetadata(hasura);

    // Then drop the tables themselves
    await dropTables(hasura);

    debug('✨ Hasura Users migration DOWN completed successfully!');
    return true;
  } catch (error) {
    console.error('❗ Critical error during Users DOWN migration:', error);
    debug('❌ Users DOWN Migration failed.');
    return false;
  }
} 