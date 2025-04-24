import dotenv from 'dotenv';
import path from 'path';
import { Hasura } from '../../lib/hasura'; // Путь относительно файла миграции
import Debug from '../../lib/debug';

// Инициализация debug
const debug = Debug('migration:up');

// Загружаем переменные окружения из корневого .env файла
dotenv.config();

// Валидация происходит внутри конструктора Hasura
const hasura = new Hasura({
  url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!, // Используем non-null assertion
  secret: process.env.HASURA_ADMIN_SECRET!,
});

const sqlSchema = `
  -- Create schema if not exists
  CREATE SCHEMA IF NOT EXISTS public;

  -- Users table
  CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    email TEXT UNIQUE,
    email_verified TIMESTAMPTZ,
    image TEXT,
    password TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_admin BOOLEAN DEFAULT FALSE,
    hasura_role TEXT DEFAULT 'user' -- Убедитесь, что роль по умолчанию 'user'
  );

  -- Accounts table
  CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_account_id TEXT NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at BIGINT,
    token_type TEXT,
    scope TEXT,
    id_token TEXT,
    session_state TEXT,
    oauth_token_secret TEXT,
    oauth_token TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, provider_account_id)
  );
`;

const tablesToTrack = [
  { schema: 'public', name: 'users' },
  { schema: 'public', name: 'accounts' }
];

const relationships = [
  {
    type: 'pg_create_object_relationship',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'accounts' },
      name: 'user',
      using: {
        foreign_key_constraint_on: 'user_id'
      }
    }
  },
  {
    type: 'pg_create_array_relationship',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'users' },
      name: 'accounts',
      using: {
        foreign_key_constraint_on: {
          table: { schema: 'public', name: 'accounts' },
          column: 'user_id'
        }
      }
    }
  }
];

// Определения прав из init-gql.js
const permissionsToDrop = [
  { type: 'pg_drop_select_permission', args: { source: 'default', table: { schema: 'public', name: 'users' }, role: 'user' } },
  { type: 'pg_drop_select_permission', args: { source: 'default', table: { schema: 'public', name: 'users' }, role: 'admin' } },
  { type: 'pg_drop_select_permission', args: { source: 'default', table: { schema: 'public', name: 'accounts' }, role: 'admin' } },
];

const userPermissions = [
  {
    type: 'pg_create_select_permission',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'users' },
      role: 'user',
      permission: {
        columns: ['id', 'created_at', 'updated_at', 'hasura_role'],
        filter: {}
      },
      comment: 'Users can see limited data of other users' // Changed to English
    }
  },
  {
    type: 'pg_create_select_permission',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'users' },
      role: 'me',
      permission: {
        columns: [
          'id',
          'name',
          'email',
          'email_verified',
          'image',
          'created_at',
          'updated_at',
          'is_admin',
          'hasura_role'
        ],
        filter: {
          id: { _eq: 'X-Hasura-User-Id' }
        }
      },
      comment: 'Users can see their own full information'
    }
  }
];

const adminPermissions = [
  {
    type: 'pg_create_select_permission',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'users' },
      role: 'admin',
      permission: {
        columns: ['id', 'name', 'email', 'email_verified', 'image', 'created_at', 'updated_at', 'is_admin', 'hasura_role'],
        filter: {}
      },
      comment: 'Admins can see full info of all users (excluding password)' // Changed comment
    }
  },
  {
    type: 'pg_create_select_permission',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'accounts' },
      role: 'admin',
      permission: {
        columns: ['id', 'user_id', 'type', 'provider', 'provider_account_id', 'created_at'],
        filter: {}
      },
      comment: 'Admins can see basic account info' // Changed to English
    }
  }
];

// --- NEW: Anonymous Permissions Definition ---

const anonymousPermissions = [
  {
    type: 'pg_create_select_permission',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'users' },
      role: 'anonymous',
      permission: {
        columns: ['id', 'created_at', 'updated_at'],
        filter: {} // Allow access to all rows
      },
      comment: 'Anonymous users can see basic user info'
    }
  },
  {
    type: 'pg_create_select_permission',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'accounts' },
      role: 'anonymous',
      permission: {
        columns: ['id', 'created_at'],
        filter: {} // Allow access to all rows
      },
      comment: 'Anonymous users can see basic account info'
    }
  }
];

// --- END NEW ---

async function applySQLSchema() {
  debug('🔧 Applying SQL schema...');
  await hasura.sql(sqlSchema, 'default', true); // cascade = true
  debug('✅ SQL schema applied.');
}

async function trackTables() {
  debug('🔍 Tracking tables...');
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
    // Note: hasura.v1 handles 'already tracked' messages internally
  }
  debug('✅ Table tracking complete.');
}

async function createRelationships() {
  debug('🔗 Creating relationships...');
  for (const relationship of relationships) {
     debug(`  📝 Creating relationship ${relationship.args.name} for table ${relationship.args.table.name}...`);
     await hasura.v1(relationship);
     // Note: hasura.v1 handles 'already exists' messages internally
  }
  debug('✅ Relationships created.');
}

async function applyPermissions() {
  debug('🔧 Applying permissions...');

  debug('  🗑️ Dropping existing permissions (if any)...');
  for (const permToDrop of permissionsToDrop) {
    debug(`     Dropping ${permToDrop.args.role}.${permToDrop.args.table.name}...`);
    await hasura.v1(permToDrop);
    // Note: hasura.v1 handles 'not found' messages internally
  }
  debug('  ✅ Existing permissions dropped.');

  debug('  📝 Applying user permissions...');
  for (const permission of userPermissions) {
    debug(`     Applying ${permission.args.role}.${permission.args.table.name}...`);
    await hasura.v1(permission);
    // Note: hasura.v1 handles 'already defined' messages internally
  }
  debug('  ✅ User permissions applied.');

  debug('  📝 Applying admin permissions...');
  for (const permission of adminPermissions) {
     debug(`     Applying ${permission.args.role}.${permission.args.table.name}...`);
     await hasura.v1(permission);
     // Note: hasura.v1 handles 'already defined' messages internally
  }
  debug('  ✅ Admin permissions applied.');

  // --- NEW: Apply anonymous permissions ---
  debug('  📝 Applying anonymous permissions...');
  for (const permission of anonymousPermissions) {
     debug(`     Applying ${permission.args.role}.${permission.args.table.name}...`);
     await hasura.v1(permission);
     // Note: hasura.v1 handles 'already defined' messages internally
  }
  debug('  ✅ Anonymous permissions applied.');
  // --- END NEW ---

  debug('✅ Permissions successfully applied.');
}

async function up() {
  debug('🚀 Starting Hasura migration UP...');
  try {
    await applySQLSchema();
    await trackTables();
    await createRelationships();
    await applyPermissions(); // Apply GQL permissions after tables/relationships
    debug('✨ Hasura migration UP completed successfully!');
  } catch (error) {
    console.error('❗ Critical error during UP migration:', error);
    debug('❌ UP Migration failed.');
    process.exit(1); // Exit with error code on failure
  }
}

// Run the migration
up();
