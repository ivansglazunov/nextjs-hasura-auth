import dotenv from 'dotenv';
import path from 'path';
import { Hasura } from './hasura';
import Debug from './debug';

// Initialize debug
const debug = Debug('migration:down');

// SQL for dropping tables
const dropTablesSQL = `
  DROP TABLE IF EXISTS public.accounts CASCADE;
  DROP TABLE IF EXISTS public.users CASCADE;
`;

// Metadata for untracking tables
const tablesToUntrack = [
  {
    type: 'pg_untrack_table',
    args: {
      source: 'default',
      table: {
        schema: 'public',
        name: 'accounts'
      },
      cascade: true // Delete related permissions and relationships
    }
  },
  {
    type: 'pg_untrack_table',
    args: {
      source: 'default',
      table: {
        schema: 'public',
        name: 'users'
      },
      cascade: true // Delete related permissions and relationships
    }
  }
];

// Metadata for dropping anonymous permissions
const permissionsToDropAnonymous = [
  {
    type: 'pg_drop_select_permission',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'users' },
      role: 'anonymous'
    }
  },
  {
    type: 'pg_drop_select_permission',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'accounts' },
      role: 'anonymous'
    }
  }
];

/**
 * Drop permissions and untrack tables
 */
export async function dropMetadata(hasura: Hasura) {
  debug('🧹 Dropping permissions and untracking tables...');

  // Drop anonymous permissions first
  debug('  🗑️ Dropping anonymous permissions...');
  for (const dropRequest of permissionsToDropAnonymous) {
    const perm = `${dropRequest.args.role} on ${dropRequest.args.table.schema}.${dropRequest.args.table.name}`;
    debug(`     Dropping select permission for ${perm}...`);
    await hasura.v1(dropRequest);
    // Note: hasura.v1 handles 'not found' messages internally
  }
  debug('  ✅ Anonymous permissions dropped.');

  debug('  🗑️ Untracking tables users and accounts...');
  for (const untrackRequest of tablesToUntrack) {
    const tableName = `${untrackRequest.args.table.schema}.${untrackRequest.args.table.name}`;
    debug(`  📝 Untracking table ${tableName}...`);
    await hasura.v1(untrackRequest);
     // Note: hasura.v1 handles 'not found' messages internally
  }
  debug('✅ Tables untracked.');
}

/**
 * Drop user and account tables
 */
export async function dropTables(hasura: Hasura) {
  debug('🧹 Dropping tables users and accounts...');
  await hasura.sql(dropTablesSQL);
  debug('✅ Tables dropped successfully.');
}

/**
 * Main migration function to remove hasyx tables
 */
export async function down(customHasura?: Hasura) {
  debug('🚀 Starting Hasura migration DOWN...');
  
  // Use provided hasura instance or create a new one
  const hasura = customHasura || new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!, 
    secret: process.env.HASURA_ADMIN_SECRET!,
  });
  
  try {
    // First remove metadata (tracking), as they depend on tables
    await dropMetadata(hasura);

    // Then drop the tables themselves
    await dropTables(hasura);

    debug('✨ Hasura migration DOWN completed successfully!');
    return true;
  } catch (error) {
    console.error('❗ Critical error during DOWN migration:', error);
    debug('❌ DOWN Migration failed.');
    return false;
  }
} 