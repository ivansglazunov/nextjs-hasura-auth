import { Hasura } from './hasura';
import Debug from './debug';

// Initialize debug
const debug = Debug('migration:up-debug');

// SQL schema for debug table
const sqlSchema = `
  CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- Ensure pgcrypto is enabled for gen_random_uuid()
  CREATE TABLE IF NOT EXISTS "public"."debug" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "value" jsonb,
      PRIMARY KEY ("id")
  );
`;

// Table to track in Hasura
const tablesToTrack = [
  { schema: 'public', name: 'debug' }
];

// Permissions for admin role
const adminPermissions = [
  {
    type: 'pg_create_select_permission',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'debug' },
      role: 'admin',
      permission: {
        columns: '*',
        filter: {}
      }
    }
  },
  {
    type: 'pg_create_insert_permission',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'debug' },
      role: 'admin',
      permission: {
        columns: ['value'], // Admin can only insert value, id and created_at are auto-generated
        check: {},
        set: {}
      }
    }
  },
  {
    type: 'pg_create_update_permission',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'debug' },
      role: 'admin',
      permission: {
        columns: ['value'],
        filter: {},
        check: null // Or check: {} if you prefer an explicit empty check
      }
    }
  },
  {
    type: 'pg_create_delete_permission',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'debug' },
      role: 'admin',
      permission: {
        filter: {}
      }
    }
  }
];

/**
 * Apply SQL schema for debug table
 */
export async function applySQLSchema(hasura: Hasura) {
  debug('🔧 Applying debug SQL schema...');
  await hasura.sql(sqlSchema, 'default', true);
  debug('✅ Debug SQL schema applied.');
}

/**
 * Track debug table in Hasura
 */
export async function trackTables(hasura: Hasura) {
  debug('🔍 Tracking debug table...');
  for (const table of tablesToTrack) {
    debug(`  📝 Tracking table ${table.schema}.${table.name}...`);
    await hasura.v1({
      type: 'pg_track_table',
      args: {
        source: 'default',
        schema: table.schema,
        name: table.name
      }
    });
  }
  debug('✅ Debug table tracking complete.');
}

/**
 * Apply all permissions for debug table
 */
export async function applyPermissions(hasura: Hasura) {
  debug('🔧 Applying debug permissions...');

  debug('  📝 Applying admin permissions...');
  for (const permission of adminPermissions) {
    const permType = permission.type.replace('pg_create_', '').replace('_permission', '');
    debug(`     Applying admin ${permType} permission on public.debug...`);
    await hasura.v1(permission);
  }
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