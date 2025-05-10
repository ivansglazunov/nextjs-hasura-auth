import { Hasura } from './hasura';
import Debug from './debug';

// Initialize debug
const debug = Debug('migration:down-debug');

// SQL for dropping debug table
const dropTablesSQL = `
  DROP TABLE IF EXISTS "public"."debug" CASCADE;
`;

// Metadata for untracking table
const tablesToUntrack = [
  {
    type: 'pg_untrack_table',
    args: {
      source: 'default',
      table: {
        schema: 'public',
        name: 'debug'
      },
      cascade: true
    }
  }
];

// Metadata for dropping permissions
const permissionsToDrop = [
  { type: 'pg_drop_select_permission', args: { source: 'default', table: { schema: 'public', name: 'debug' }, role: 'admin' } },
  { type: 'pg_drop_insert_permission', args: { source: 'default', table: { schema: 'public', name: 'debug' }, role: 'admin' } },
  { type: 'pg_drop_update_permission', args: { source: 'default', table: { schema: 'public', name: 'debug' }, role: 'admin' } },
  { type: 'pg_drop_delete_permission', args: { source: 'default', table: { schema: 'public', name: 'debug' }, role: 'admin' } }
];

/**
 * Drop permissions and untrack table
 */
export async function dropMetadata(hasura: Hasura) {
  debug('🧹 Dropping debug permissions and untracking table...');

  debug('  🗑️ Dropping permissions...');
  for (const dropRequest of permissionsToDrop) {
    const permType = dropRequest.type.replace('pg_drop_', '').replace('_permission', '');
    debug(`     Dropping ${permType} permission for admin on public.debug...`);
    await hasura.v1(dropRequest);
  }
  debug('  ✅ Permissions dropped.');
  
  debug('  🗑️ Untracking table debug...');
  for (const untrackRequest of tablesToUntrack) {
    const tableName = `${untrackRequest.args.table.schema}.${untrackRequest.args.table.name}`;
    debug(`  📝 Untracking table ${tableName}...`);
    await hasura.v1(untrackRequest);
  }
  debug('✅ Table untracked.');
}

/**
 * Drop debug table
 */
export async function dropTables(hasura: Hasura) {
  debug('🧹 Dropping debug table...');
  await hasura.sql(dropTablesSQL);
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