import { Hasura } from './hasura';
import Debug from './debug';

// Initialize debug
const debug = Debug('migration:down-debug');

/**
 * Drop permissions and untrack table using high-level methods
 */
export async function dropMetadata(hasura: Hasura) {
  debug('🧹 Dropping debug permissions and untracking table...');

  debug('  🗑️ Dropping permissions...');
  
  // Drop all permissions for admin role
  await hasura.deletePermission({
    schema: 'public',
    table: 'debug',
    operation: 'select',
    role: 'admin'
  });
  
  await hasura.deletePermission({
    schema: 'public',
    table: 'debug',
    operation: 'insert',
    role: 'admin'
  });
  
  await hasura.deletePermission({
    schema: 'public',
    table: 'debug',
    operation: 'update',
    role: 'admin'
  });
  
  await hasura.deletePermission({
    schema: 'public',
    table: 'debug',
    operation: 'delete',
    role: 'admin'
  });
  
  debug('  ✅ Permissions dropped.');
  
  debug('  🗑️ Untracking table debug...');
  await hasura.untrackTable({ 
    schema: 'public', 
    table: 'debug' 
  });
  debug('✅ Table untracked.');
}

/**
 * Drop debug table using high-level methods
 */
export async function dropTables(hasura: Hasura) {
  debug('🧹 Dropping debug table...');
  await hasura.deleteTable({ 
    schema: 'public', 
    table: 'debug' 
  });
  debug('✅ Debug table dropped successfully.');
}

/**
 * Main migration function to remove debug table
 */
export async function down(customHasura?: Hasura) {
  debug('🚀 Starting Hasura Debug migration DOWN...');
  
  const hasura = customHasura || new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
    secret: process.env.HASURA_ADMIN_SECRET!,
  });
  
  try {
    await dropMetadata(hasura);
    await dropTables(hasura);
    debug('✨ Hasura Debug migration DOWN completed successfully!');
    return true;
  } catch (error) {
    console.error('❗ Critical error during Debug DOWN migration:', error);
    debug('❌ Debug DOWN Migration failed.');
    return false;
  }
} 