import dotenv from 'dotenv';
import path from 'path';
import { Hasura, ColumnType } from './hasura';
import Debug from './debug';

// Initialize debug
const debug = Debug('migration:up-users');

export async function applySQLSchema(hasura: Hasura) {
  debug('🔧 Applying users SQL schema...');
  
  // Ensure public schema exists
  await hasura.defineSchema({ schema: 'public' });
  
  // Define users table
  await hasura.defineTable({
    schema: 'public',
    table: 'users',
    id: 'id',
    type: ColumnType.UUID
  });
  
  // Add users table columns
  await hasura.defineColumn({
    schema: 'public',
    table: 'users',
    name: 'name',
    type: ColumnType.TEXT,
    comment: 'User display name'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'users',
    name: 'email',
    type: ColumnType.TEXT,
    unique: true,
    comment: 'User email address'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'users',
    name: 'email_verified',
    type: ColumnType.BIGINT,
    comment: 'Email verification timestamp'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'users',
    name: 'image',
    type: ColumnType.TEXT,
    comment: 'User profile image URL'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'users',
    name: 'password',
    type: ColumnType.TEXT,
    comment: 'User password hash'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'users',
    name: 'is_admin',
    type: ColumnType.BOOLEAN,
    postfix: 'DEFAULT FALSE',
    comment: 'Admin flag'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'users',
    name: 'hasura_role',
    type: ColumnType.TEXT,
    postfix: "DEFAULT 'user'",
    comment: 'Hasura role for permissions'
  });
  
  // Define accounts table
  await hasura.defineTable({
    schema: 'public',
    table: 'accounts',
    id: 'id',
    type: ColumnType.UUID
  });
  
  // Add accounts table columns
  await hasura.defineColumn({
    schema: 'public',
    table: 'accounts',
    name: 'user_id',
    type: ColumnType.UUID,
    postfix: 'NOT NULL',
    comment: 'Reference to users table'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'accounts',
    name: 'type',
    type: ColumnType.TEXT,
    postfix: 'NOT NULL',
    comment: 'Account type'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'accounts',
    name: 'provider',
    type: ColumnType.TEXT,
    postfix: 'NOT NULL',
    comment: 'OAuth provider'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'accounts',
    name: 'provider_account_id',
    type: ColumnType.TEXT,
    postfix: 'NOT NULL',
    comment: 'Provider account ID'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'accounts',
    name: 'refresh_token',
    type: ColumnType.TEXT,
    comment: 'OAuth refresh token'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'accounts',
    name: 'access_token',
    type: ColumnType.TEXT,
    comment: 'OAuth access token'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'accounts',
    name: 'expires_at',
    type: ColumnType.BIGINT,
    comment: 'Token expiration timestamp'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'accounts',
    name: 'token_type',
    type: ColumnType.TEXT,
    comment: 'Token type'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'accounts',
    name: 'scope',
    type: ColumnType.TEXT,
    comment: 'OAuth scope'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'accounts',
    name: 'id_token',
    type: ColumnType.TEXT,
    comment: 'OAuth ID token'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'accounts',
    name: 'session_state',
    type: ColumnType.TEXT,
    comment: 'OAuth session state'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'accounts',
    name: 'oauth_token_secret',
    type: ColumnType.TEXT,
    comment: 'OAuth token secret'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'accounts',
    name: 'oauth_token',
    type: ColumnType.TEXT,
    comment: 'OAuth token'
  });
  
  // Create foreign key constraint
  await hasura.defineForeignKey({
    from: { schema: 'public', table: 'accounts', column: 'user_id' },
    to: { schema: 'public', table: 'users', column: 'id' },
    on_delete: 'CASCADE',
    on_update: 'CASCADE'
  });
  
  // Create unique constraint for provider + provider_account_id
  await hasura.sql(`
    ALTER TABLE "public"."accounts" 
    DROP CONSTRAINT IF EXISTS "accounts_provider_provider_account_id_unique";
    ALTER TABLE "public"."accounts" 
    ADD CONSTRAINT "accounts_provider_provider_account_id_unique" 
    UNIQUE ("provider", "provider_account_id");
  `);
  
  debug('✅ Users SQL schema applied.');
}

export async function trackTables(hasura: Hasura) {
  debug('🔍 Tracking users tables...');
  
  await hasura.trackTable({ schema: 'public', table: 'users' });
  await hasura.trackTable({ schema: 'public', table: 'accounts' });
  
  debug('✅ Users tables tracking complete.');
}

export async function createRelationships(hasura: Hasura) {
  debug('🔗 Creating users relationships...');
  
  // Object relationship: accounts -> user
  await hasura.defineObjectRelationshipForeign({
    schema: 'public',
    table: 'accounts',
    name: 'user',
    key: 'user_id'
  });
  
  // Array relationship: users -> accounts
  await hasura.defineArrayRelationshipForeign({
    schema: 'public',
    table: 'users',
    name: 'accounts',
    key: 'accounts.user_id'
  });
  
  debug('✅ Users relationships created.');
}

export async function applyPermissions(hasura: Hasura) {
  debug('🔧 Applying users permissions...');

  // User permissions
  await hasura.definePermission({
    schema: 'public',
    table: 'users',
    operation: 'select',
    role: 'user',
    filter: {},
    columns: ['id', 'name', 'image', 'created_at', 'updated_at', 'hasura_role']
  });

  // Me permissions (user can see their own full data)
  await hasura.definePermission({
    schema: 'public',
    table: 'users',
    operation: 'select',
    role: 'me',
    filter: { id: { _eq: 'X-Hasura-User-Id' } },
    columns: ['id', 'name', 'email', 'email_verified', 'image', 'created_at', 'updated_at', 'is_admin', 'hasura_role']
  });

  await hasura.definePermission({
    schema: 'public',
    table: 'accounts',
    operation: 'select',
    role: 'me',
    filter: { user_id: { _eq: 'X-Hasura-User-Id' } },
    columns: ['id', 'user_id', 'type', 'provider', 'provider_account_id', 'refresh_token', 'access_token', 'expires_at', 'token_type', 'scope', 'id_token', 'session_state', 'created_at']
  });

  await hasura.definePermission({
    schema: 'public',
    table: 'accounts',
    operation: 'select',
    role: 'user',
    filter: {},
    columns: ['id', 'provider', 'user_id']
  });

  // Admin permissions
  await hasura.definePermission({
    schema: 'public',
    table: 'users',
    operation: 'select',
    role: 'admin',
    filter: {},
    columns: ['id', 'name', 'email', 'email_verified', 'image', 'created_at', 'updated_at', 'is_admin', 'hasura_role']
  });

  await hasura.definePermission({
    schema: 'public',
    table: 'accounts',
    operation: 'select',
    role: 'admin',
    filter: {},
    columns: ['id', 'user_id', 'type', 'provider', 'provider_account_id', 'created_at']
  });

  debug('✅ Users permissions applied.');
}

export async function up(customHasura?: Hasura) {
  debug('🚀 Starting Hasura Users migration UP...');
  
  const hasura = customHasura || new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
    secret: process.env.HASURA_ADMIN_SECRET!,
  });
  
  try {
    await applySQLSchema(hasura);
    await trackTables(hasura);
    await createRelationships(hasura);
    await applyPermissions(hasura);
    debug('✨ Hasura Users migration UP completed successfully!');
    return true;
  } catch (error) {
    console.error('❗ Critical error during Users UP migration:', error);
    debug('❌ Users UP Migration failed.');
    return false;
  }
} 