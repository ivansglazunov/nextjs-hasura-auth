import { Hasura, ColumnType } from './hasura';
import Debug from './debug';

// Initialize debug
const debug = Debug('migration:up-debug');

/**
 * Apply SQL schema for debug table using high-level methods
 */
export async function applySQLSchema(hasura: Hasura) {
  debug('🔧 Applying debug SQL schema...');
  
  // Ensure pgcrypto extension exists
  await hasura.sql('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
  
  // Define debug table with columns
  await hasura.defineTable({ 
    schema: 'public', 
    table: 'debug',
    id: 'id',
    type: ColumnType.UUID
  });
  
  // Add value column
  await hasura.defineColumn({
    schema: 'public',
    table: 'debug',
    name: 'value',
    type: ColumnType.JSONB,
    comment: 'Debug value data'
  });
  
  debug('✅ Debug SQL schema applied.');
}

/**
 * Track debug table in Hasura using high-level methods
 */
export async function trackTables(hasura: Hasura) {
  debug('🔍 Tracking debug table...');
  
  await hasura.trackTable({ 
    schema: 'public', 
    table: 'debug' 
  });
  
  debug('✅ Debug table tracking complete.');
}

/**
 * Apply all permissions for debug table using high-level methods
 */
export async function applyPermissions(hasura: Hasura) {
  debug('🔧 Applying debug permissions...');

  debug('  📝 Applying admin permissions...');
  
  // Select permission for admin
  await hasura.definePermission({
    schema: 'public',
    table: 'debug',
    operation: 'select',
    role: 'admin',
    filter: {},
    columns: true // All columns
  });
  
  // Insert permission for admin
  await hasura.definePermission({
    schema: 'public',
    table: 'debug',
    operation: 'insert',
    role: 'admin',
    filter: {},
    columns: ['value'] // Admin can only insert value, id and timestamps are auto-generated
  });
  
  // Update permission for admin
  await hasura.definePermission({
    schema: 'public',
    table: 'debug',
    operation: 'update',
    role: 'admin',
    filter: {},
    columns: ['value']
  });
  
  // Delete permission for admin
  await hasura.definePermission({
    schema: 'public',
    table: 'debug',
    operation: 'delete',
    role: 'admin',
    filter: {}
  });
  
  debug('  ✅ Admin permissions applied.');
  debug('✅ Debug permissions successfully applied.');
}

/**
 * Main migration function for debug system
 */
export async function up(customHasura?: Hasura) {
  debug('🚀 Starting Hasura Debug migration UP...');
  
  const hasura = customHasura || new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
    secret: process.env.HASURA_ADMIN_SECRET!,
  });
  
  try {
    await applySQLSchema(hasura);
    await trackTables(hasura);
    await applyPermissions(hasura);
    debug('✨ Hasura Debug migration UP completed successfully!');
    return true;
  } catch (error) {
    console.error('❗ Critical error during Debug UP migration:', error);
    debug('❌ Debug UP Migration failed.');
    return false;
  }
} 