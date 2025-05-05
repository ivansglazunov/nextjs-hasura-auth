import dotenv from 'dotenv';
import path from 'path';
import { Hasura } from '../../lib/hasura'; // Path relative to migration file
import Debug from '../../lib/debug';

// Initialize debug
const debug = Debug('migration:down');

// Load environment variables from root .env file
dotenv.config();

// Validation happens inside the Hasura constructor
const hasura = new Hasura({
  url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!, // Using non-null assertion
  secret: process.env.HASURA_ADMIN_SECRET!,
});

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

async function dropMetadata() {
  debug('🧹 Dropping permissions and untracking tables...');

  // --- NEW: Drop anonymous permissions first ---
  debug('  🗑️ Dropping anonymous permissions...');
  for (const dropRequest of permissionsToDropAnonymous) {
    const perm = `${dropRequest.args.role} on ${dropRequest.args.table.schema}.${dropRequest.args.table.name}`;
    debug(`     Dropping select permission for ${perm}...`);
    await hasura.v1(dropRequest);
    // Note: hasura.v1 handles 'not found' messages internally
  }
  debug('  ✅ Anonymous permissions dropped.');
  // --- END NEW ---

  debug('  🗑️ Untracking tables users and accounts...');
  for (const untrackRequest of tablesToUntrack) {
    const tableName = `${untrackRequest.args.table.schema}.${untrackRequest.args.table.name}`;
    debug(`  📝 Untracking table ${tableName}...`);
    await hasura.v1(untrackRequest);
     // Note: hasura.v1 handles 'not found' messages internally
  }
  debug('✅ Tables untracked.');
}

async function dropTables() {
  debug('🧹 Dropping tables users and accounts...');
  await hasura.sql(dropTablesSQL);
  debug('✅ Tables dropped successfully.');
}

async function down() {
  debug('🚀 Starting Hasura migration DOWN...');
  try {
    // First remove metadata (tracking), as they depend on tables
    await dropMetadata();

    // Then drop the tables themselves
    await dropTables();

    debug('✨ Hasura migration DOWN completed successfully!');
  } catch (error) {
    console.error('❗ Critical error during DOWN migration:', error);
    debug('❌ DOWN Migration failed.');
    process.exit(1); // Exit with error code on failure
  }
}

// Run the migration
down();
