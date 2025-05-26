import dotenv from 'dotenv';
import path from 'path';
import { Hasura, ColumnType } from './hasura';
import Debug from './debug';

// Initialize debug
const debug = Debug('migration:up-notify');

export async function applySQLSchema(hasura: Hasura) {
  debug('🔧 Applying notification SQL schema...');
  
  // Define notification_permissions table
  await hasura.defineTable({
    schema: 'public',
    table: 'notification_permissions',
    id: 'id',
    type: ColumnType.UUID
  });
  
  // Add notification_permissions columns
  await hasura.defineColumn({
    schema: 'public',
    table: 'notification_permissions',
    name: 'user_id',
    type: ColumnType.UUID,
    postfix: 'NOT NULL',
    comment: 'Reference to users table'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'notification_permissions',
    name: 'provider',
    type: ColumnType.TEXT,
    postfix: 'NOT NULL',
    comment: 'Notification provider (e.g., fcm, apns)'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'notification_permissions',
    name: 'device_token',
    type: ColumnType.TEXT,
    postfix: 'NOT NULL',
    comment: 'Device token for push notifications'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'notification_permissions',
    name: 'device_info',
    type: ColumnType.JSONB,
    postfix: "NOT NULL DEFAULT '{}'::jsonb",
    comment: 'Device information'
  });
  
  // Create foreign key for notification_permissions
  await hasura.defineForeignKey({
    from: { schema: 'public', table: 'notification_permissions', column: 'user_id' },
    to: { schema: 'public', table: 'users', column: 'id' },
    on_delete: 'CASCADE',
    on_update: 'CASCADE'
  });
  
  // Define notification_messages table
  await hasura.defineTable({
    schema: 'public',
    table: 'notification_messages',
    id: 'id',
    type: ColumnType.UUID
  });
  
  // Add notification_messages columns
  await hasura.defineColumn({
    schema: 'public',
    table: 'notification_messages',
    name: 'title',
    type: ColumnType.TEXT,
    postfix: 'NOT NULL',
    comment: 'Notification title'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'notification_messages',
    name: 'body',
    type: ColumnType.TEXT,
    postfix: 'NOT NULL',
    comment: 'Notification body'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'notification_messages',
    name: 'data',
    type: ColumnType.JSONB,
    comment: 'Additional notification data'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'notification_messages',
    name: 'user_id',
    type: ColumnType.UUID,
    postfix: 'NOT NULL',
    comment: 'Target user for notification'
  });
  
  // Create foreign key for notification_messages
  await hasura.defineForeignKey({
    from: { schema: 'public', table: 'notification_messages', column: 'user_id' },
    to: { schema: 'public', table: 'users', column: 'id' },
    on_delete: 'CASCADE',
    on_update: 'CASCADE'
  });
  
  // Define notifications table
  await hasura.defineTable({
    schema: 'public',
    table: 'notifications',
    id: 'id',
    type: ColumnType.UUID
  });
  
  // Add notifications columns
  await hasura.defineColumn({
    schema: 'public',
    table: 'notifications',
    name: 'message_id',
    type: ColumnType.UUID,
    postfix: 'NOT NULL',
    comment: 'Reference to notification message'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'notifications',
    name: 'permission_id',
    type: ColumnType.UUID,
    postfix: 'NOT NULL',
    comment: 'Reference to notification permission'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'notifications',
    name: 'config',
    type: ColumnType.JSONB,
    comment: 'Notification configuration'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'notifications',
    name: 'status',
    type: ColumnType.TEXT,
    postfix: "NOT NULL DEFAULT 'pending'",
    comment: 'Notification status'
  });
  
  await hasura.defineColumn({
    schema: 'public',
    table: 'notifications',
    name: 'error',
    type: ColumnType.TEXT,
    comment: 'Error message if notification failed'
  });
  
  // Create foreign keys for notifications
  await hasura.defineForeignKey({
    from: { schema: 'public', table: 'notifications', column: 'message_id' },
    to: { schema: 'public', table: 'notification_messages', column: 'id' },
    on_delete: 'CASCADE',
    on_update: 'CASCADE'
  });
  
  await hasura.defineForeignKey({
    from: { schema: 'public', table: 'notifications', column: 'permission_id' },
    to: { schema: 'public', table: 'notification_permissions', column: 'id' },
    on_delete: 'CASCADE',
    on_update: 'CASCADE'
  });
  
  // Create trigger function for updated_at
  await hasura.defineFunction({
    schema: 'public',
    name: 'set_current_timestamp_updated_at',
    definition: `()
      RETURNS TRIGGER AS $$
      DECLARE
        _new RECORD;
      BEGIN
        _new := NEW;
        _new."updated_at" = EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000;
        RETURN _new;
      END;
      $$`,
    language: 'plpgsql'
  });
  
  // Create triggers for updated_at
  await hasura.defineTrigger({
    schema: 'public',
    table: 'notification_permissions',
    name: 'set_public_notification_permissions_updated_at',
    timing: 'BEFORE',
    event: 'UPDATE',
    function_name: 'public.set_current_timestamp_updated_at'
  });
  
  await hasura.defineTrigger({
    schema: 'public',
    table: 'notifications',
    name: 'set_public_notifications_updated_at',
    timing: 'BEFORE',
    event: 'UPDATE',
    function_name: 'public.set_current_timestamp_updated_at'
  });
  
  // Create indexes
  await hasura.sql(`
    CREATE INDEX IF NOT EXISTS "idx_notification_permissions_device_token" ON "public"."notification_permissions" ("device_token");
    CREATE INDEX IF NOT EXISTS "idx_notification_permissions_user_id" ON "public"."notification_permissions" ("user_id");
    CREATE INDEX IF NOT EXISTS "idx_notification_messages_user_id" ON "public"."notification_messages" ("user_id");
    CREATE INDEX IF NOT EXISTS "idx_notifications_status" ON "public"."notifications" ("status");
    CREATE INDEX IF NOT EXISTS "idx_notifications_message_id" ON "public"."notifications" ("message_id");
    CREATE INDEX IF NOT EXISTS "idx_notifications_permission_id" ON "public"."notifications" ("permission_id");
  `);
  
  debug('✅ Notification SQL schema applied.');
}

export async function trackTables(hasura: Hasura) {
  debug('🔍 Tracking notification tables...');
  
  await hasura.trackTable({ schema: 'public', table: 'notification_permissions' });
  await hasura.trackTable({ schema: 'public', table: 'notification_messages' });
  await hasura.trackTable({ schema: 'public', table: 'notifications' });
  
  debug('✅ Notification tables tracking complete.');
}

export async function createRelationships(hasura: Hasura) {
  debug('🔗 Creating notification relationships...');
  
  // User relationships
  await hasura.defineObjectRelationshipForeign({
    schema: 'public',
    table: 'notification_permissions',
    name: 'user',
    key: 'user_id'
  });
  
  await hasura.defineObjectRelationshipForeign({
    schema: 'public',
    table: 'notification_messages',
    name: 'user',
    key: 'user_id'
  });
  
  // Notification relationships
  await hasura.defineObjectRelationshipForeign({
    schema: 'public',
    table: 'notifications',
    name: 'message',
    key: 'message_id'
  });
  
  await hasura.defineObjectRelationshipForeign({
    schema: 'public',
    table: 'notifications',
    name: 'permission',
    key: 'permission_id'
  });
  
  // Reverse relationships
  await hasura.defineArrayRelationshipForeign({
    schema: 'public',
    table: 'notification_permissions',
    name: 'notifications',
    key: 'notifications.permission_id'
  });
  
  await hasura.defineArrayRelationshipForeign({
    schema: 'public',
    table: 'notification_messages',
    name: 'notifications',
    key: 'notifications.message_id'
  });
  
  await hasura.defineArrayRelationshipForeign({
    schema: 'public',
    table: 'users',
    name: 'notification_permissions',
    key: 'notification_permissions.user_id'
  });
  
  await hasura.defineArrayRelationshipForeign({
    schema: 'public',
    table: 'users',
    name: 'notification_messages',
    key: 'notification_messages.user_id'
  });
  
  debug('✅ Notification relationships created.');
}

export async function applyPermissions(hasura: Hasura) {
  debug('🔧 Applying notification permissions...');

  // User permissions - can manage their own notifications
  await hasura.definePermission({
    schema: 'public',
    table: 'notification_permissions',
    operation: 'select',
    role: 'user',
    filter: { user_id: { _eq: 'X-Hasura-User-Id' } },
    columns: true
  });
  
  await hasura.definePermission({
    schema: 'public',
    table: 'notification_permissions',
    operation: 'insert',
    role: 'user',
    filter: { user_id: { _eq: 'X-Hasura-User-Id' } },
    columns: ['user_id', 'provider', 'device_token', 'device_info']
  });
  
  await hasura.definePermission({
    schema: 'public',
    table: 'notification_permissions',
    operation: 'update',
    role: 'user',
    filter: { user_id: { _eq: 'X-Hasura-User-Id' } },
    columns: ['provider', 'device_token', 'device_info']
  });
  
  await hasura.definePermission({
    schema: 'public',
    table: 'notification_permissions',
    operation: 'delete',
    role: 'user',
    filter: { user_id: { _eq: 'X-Hasura-User-Id' } }
  });

  // User can see their own notification messages
  await hasura.definePermission({
    schema: 'public',
    table: 'notification_messages',
    operation: 'select',
    role: 'user',
    filter: { user_id: { _eq: 'X-Hasura-User-Id' } },
    columns: true
  });

  // User can see their own notifications
  await hasura.definePermission({
    schema: 'public',
    table: 'notifications',
    operation: 'select',
    role: 'user',
    filter: { 
      permission: { user_id: { _eq: 'X-Hasura-User-Id' } }
    },
    columns: true
  });

  // Admin permissions - full access
  await hasura.definePermission({
    schema: 'public',
    table: 'notification_permissions',
    operation: 'select',
    role: 'admin',
    filter: {},
    columns: true
  });
  
  await hasura.definePermission({
    schema: 'public',
    table: 'notification_messages',
    operation: 'select',
    role: 'admin',
    filter: {},
    columns: true
  });
  
  await hasura.definePermission({
    schema: 'public',
    table: 'notification_messages',
    operation: 'insert',
    role: 'admin',
    filter: {},
    columns: ['title', 'body', 'data', 'user_id']
  });
  
  await hasura.definePermission({
    schema: 'public',
    table: 'notifications',
    operation: 'select',
    role: 'admin',
    filter: {},
    columns: true
  });

  debug('✅ Notification permissions applied.');
}

export async function up(customHasura?: Hasura) {
  debug('🚀 Starting Hasura Notification migration UP...');
  
  const hasura = customHasura || new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
    secret: process.env.HASURA_ADMIN_SECRET!,
  });
  
  try {
    await applySQLSchema(hasura);
    await trackTables(hasura);
    await createRelationships(hasura);
    await applyPermissions(hasura);
    debug('✨ Hasura Notification migration UP completed successfully!');
    return true;
  } catch (error) {
    console.error('❗ Critical error during Notification UP migration:', error);
    debug('❌ Notification UP Migration failed.');
    return false;
  }
} 