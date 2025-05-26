import dotenv from 'dotenv';
import path from 'path';
import { Hasura } from './hasura';
import Debug from './debug';

// Initialize debug
const debug = Debug('migration:down-notify');

/**
 * Drop permissions and relationships using high-level methods
 */
export async function dropMetadata(hasura: Hasura) {
  debug('🧹 Dropping notification permissions, relationships, and untracking tables...');
  
  debug('  🗑️ Dropping permissions...');
  
  // Drop permissions for notification_permissions
  await hasura.deletePermission({
    schema: 'public',
    table: 'notification_permissions',
    operation: 'select',
    role: ['user', 'admin', 'anonymous']
  });
  
  await hasura.deletePermission({
    schema: 'public',
    table: 'notification_permissions',
    operation: 'insert',
    role: ['user', 'admin']
  });
  
  await hasura.deletePermission({
    schema: 'public',
    table: 'notification_permissions',
    operation: 'update',
    role: ['user', 'admin']
  });
  
  await hasura.deletePermission({
    schema: 'public',
    table: 'notification_permissions',
    operation: 'delete',
    role: ['user', 'admin']
  });
  
  // Drop permissions for notification_messages
  await hasura.deletePermission({
    schema: 'public',
    table: 'notification_messages',
    operation: 'select',
    role: ['user', 'admin', 'anonymous']
  });
  
  await hasura.deletePermission({
    schema: 'public',
    table: 'notification_messages',
    operation: 'insert',
    role: ['user', 'admin']
  });
  
  await hasura.deletePermission({
    schema: 'public',
    table: 'notification_messages',
    operation: 'update',
    role: ['user', 'admin']
  });
  
  await hasura.deletePermission({
    schema: 'public',
    table: 'notification_messages',
    operation: 'delete',
    role: ['user', 'admin']
  });
  
  // Drop permissions for notifications
  await hasura.deletePermission({
    schema: 'public',
    table: 'notifications',
    operation: 'select',
    role: ['user', 'admin', 'anonymous']
  });
  
  await hasura.deletePermission({
    schema: 'public',
    table: 'notifications',
    operation: 'insert',
    role: ['user', 'admin']
  });
  
  await hasura.deletePermission({
    schema: 'public',
    table: 'notifications',
    operation: 'update',
    role: ['user', 'admin']
  });
  
  await hasura.deletePermission({
    schema: 'public',
    table: 'notifications',
    operation: 'delete',
    role: ['user', 'admin']
  });
  
  debug('  ✅ Permissions dropped.');
  
  debug('  🗑️ Dropping relationships...');
  
  // Drop relationships from notification tables
  await hasura.deleteRelationship({
    schema: 'public',
    table: 'notification_permissions',
    name: 'user'
  });
  
  await hasura.deleteRelationship({
    schema: 'public',
    table: 'notification_messages',
    name: 'user'
  });
  
  await hasura.deleteRelationship({
    schema: 'public',
    table: 'notifications',
    name: 'message'
  });
  
  await hasura.deleteRelationship({
    schema: 'public',
    table: 'notifications',
    name: 'permission'
  });
  
  // Drop reverse relationships
  await hasura.deleteRelationship({
    schema: 'public',
    table: 'notification_permissions',
    name: 'notifications'
  });
  
  await hasura.deleteRelationship({
    schema: 'public',
    table: 'notification_messages',
    name: 'notifications'
  });
  
  await hasura.deleteRelationship({
    schema: 'public',
    table: 'users',
    name: 'notification_permissions'
  });
  
  await hasura.deleteRelationship({
    schema: 'public',
    table: 'users',
    name: 'notification_messages'
  });
  
  debug('  ✅ Relationships dropped.');

  debug('  🗑️ Untracking notification tables...');
  await hasura.untrackTable({ schema: 'public', table: 'notifications' });
  await hasura.untrackTable({ schema: 'public', table: 'notification_messages' });
  await hasura.untrackTable({ schema: 'public', table: 'notification_permissions' });
  debug('✅ Tables untracked.');
}

/**
 * Drop notification tables using high-level methods
 */
export async function dropTables(hasura: Hasura) {
  debug('🧹 Dropping notification tables...');
  
  // Drop triggers first
  await hasura.deleteTrigger({
    schema: 'public',
    table: 'notification_permissions',
    name: 'set_public_notification_permissions_updated_at'
  });
  
  await hasura.deleteTrigger({
    schema: 'public',
    table: 'notifications',
    name: 'set_public_notifications_updated_at'
  });
  
  // Drop foreign key constraints
  await hasura.deleteForeignKey({
    schema: 'public',
    table: 'notifications',
    name: 'notifications_message_id_fkey'
  });
  
  await hasura.deleteForeignKey({
    schema: 'public',
    table: 'notifications',
    name: 'notifications_permission_id_fkey'
  });
  
  await hasura.deleteForeignKey({
    schema: 'public',
    table: 'notification_messages',
    name: 'notification_messages_user_id_fkey'
  });
  
  await hasura.deleteForeignKey({
    schema: 'public',
    table: 'notification_permissions',
    name: 'notification_permissions_user_id_fkey'
  });
  
  // Drop tables in proper order (dependent tables first)
  await hasura.deleteTable({ schema: 'public', table: 'notifications' });
  await hasura.deleteTable({ schema: 'public', table: 'notification_messages' });
  await hasura.deleteTable({ schema: 'public', table: 'notification_permissions' });
  
  // Drop trigger function
  await hasura.deleteFunction({
    schema: 'public',
    name: 'set_current_timestamp_updated_at'
  });
  
  debug('✅ Notification tables dropped successfully.');
}

/**
 * Main migration function to remove notification tables
 */
export async function down(customHasura?: Hasura) {
  debug('🚀 Starting Hasura Notify migration DOWN...');
  
  const hasura = customHasura || new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!, 
    secret: process.env.HASURA_ADMIN_SECRET!,
  });
  
  try {
    // First remove metadata (permissions, relationships, tracking),
    // as they depend on tables
    await dropMetadata(hasura);

    // Then drop the tables themselves
    await dropTables(hasura);

    debug('✨ Hasura Notify migration DOWN completed successfully!');
    return true;
  } catch (error) {
    console.error('❗ Critical error during Notify DOWN migration:', error);
    debug('❌ Notify DOWN Migration failed.');
    return false;
  }
} 