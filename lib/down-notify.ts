import dotenv from 'dotenv';
import path from 'path';
import { Hasura } from './hasura';
import Debug from './debug';

// Initialize debug
const debug = Debug('migration:down-notify');

// SQL for dropping notification tables in proper order
const dropTablesSQL = `
  DROP TABLE IF EXISTS "public"."notifications";
  DROP TABLE IF EXISTS "public"."notification_messages";
  DROP TABLE IF EXISTS "public"."notification_permissions";
`;

// Metadata for untracking tables
const tablesToUntrack = [
  {
    type: 'pg_untrack_table',
    args: {
      source: 'default',
      table: {
        schema: 'public',
        name: 'notifications'
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
        name: 'notification_messages'
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
        name: 'notification_permissions'
      },
      cascade: true // Delete related permissions and relationships
    }
  }
];

// Metadata for dropping permissions (EXPANDED)
const permissionsToDrop = [
  // === notification_permissions ===
  // User role
  { type: 'pg_drop_select_permission', args: { source: 'default', table: { schema: 'public', name: 'notification_permissions' }, role: 'user' } },
  { type: 'pg_drop_insert_permission', args: { source: 'default', table: { schema: 'public', name: 'notification_permissions' }, role: 'user' } },
  { type: 'pg_drop_update_permission', args: { source: 'default', table: { schema: 'public', name: 'notification_permissions' }, role: 'user' } }, // Assuming update might exist
  { type: 'pg_drop_delete_permission', args: { source: 'default', table: { schema: 'public', name: 'notification_permissions' }, role: 'user' } },
  // Admin role
  { type: 'pg_drop_select_permission', args: { source: 'default', table: { schema: 'public', name: 'notification_permissions' }, role: 'admin' } },
  { type: 'pg_drop_insert_permission', args: { source: 'default', table: { schema: 'public', name: 'notification_permissions' }, role: 'admin' } }, // Assuming full admin crud
  { type: 'pg_drop_update_permission', args: { source: 'default', table: { schema: 'public', name: 'notification_permissions' }, role: 'admin' } },
  { type: 'pg_drop_delete_permission', args: { source: 'default', table: { schema: 'public', name: 'notification_permissions' }, role: 'admin' } },
  // Anonymous role (if any select permission was defined, even restrictive)
  { type: 'pg_drop_select_permission', args: { source: 'default', table: { schema: 'public', name: 'notification_permissions' }, role: 'anonymous' } }, 

  // === notification_messages ===
  // User role
  { type: 'pg_drop_select_permission', args: { source: 'default', table: { schema: 'public', name: 'notification_messages' }, role: 'user' } },
  { type: 'pg_drop_insert_permission', args: { source: 'default', table: { schema: 'public', name: 'notification_messages' }, role: 'user' } },
  { type: 'pg_drop_update_permission', args: { source: 'default', table: { schema: 'public', name: 'notification_messages' }, role: 'user' } },
  { type: 'pg_drop_delete_permission', args: { source: 'default', table: { schema: 'public', name: 'notification_messages' }, role: 'user' } },
  // Admin role
  { type: 'pg_drop_select_permission', args: { source: 'default', table: { schema: 'public', name: 'notification_messages' }, role: 'admin' } },
  { type: 'pg_drop_insert_permission', args: { source: 'default', table: { schema: 'public', name: 'notification_messages' }, role: 'admin' } },
  { type: 'pg_drop_update_permission', args: { source: 'default', table: { schema: 'public', name: 'notification_messages' }, role: 'admin' } },
  { type: 'pg_drop_delete_permission', args: { source: 'default', table: { schema: 'public', name: 'notification_messages' }, role: 'admin' } },
  // Anonymous role
  { type: 'pg_drop_select_permission', args: { source: 'default', table: { schema: 'public', name: 'notification_messages' }, role: 'anonymous' } }, 

  // === notifications ===
  // User role
  { type: 'pg_drop_select_permission', args: { source: 'default', table: { schema: 'public', name: 'notifications' }, role: 'user' } },
  { type: 'pg_drop_insert_permission', args: { source: 'default', table: { schema: 'public', name: 'notifications' }, role: 'user' } }, // This was the problematic one
  { type: 'pg_drop_update_permission', args: { source: 'default', table: { schema: 'public', name: 'notifications' }, role: 'user' } },
  { type: 'pg_drop_delete_permission', args: { source: 'default', table: { schema: 'public', name: 'notifications' }, role: 'user' } },
  // Admin role
  { type: 'pg_drop_select_permission', args: { source: 'default', table: { schema: 'public', name: 'notifications' }, role: 'admin' } },
  { type: 'pg_drop_insert_permission', args: { source: 'default', table: { schema: 'public', name: 'notifications' }, role: 'admin' } },
  { type: 'pg_drop_update_permission', args: { source: 'default', table: { schema: 'public', name: 'notifications' }, role: 'admin' } },
  { type: 'pg_drop_delete_permission', args: { source: 'default', table: { schema: 'public', name: 'notifications' }, role: 'admin' } },
  // Anonymous role
  { type: 'pg_drop_select_permission', args: { source: 'default', table: { schema: 'public', name: 'notifications' }, role: 'anonymous' } }, 
];

// Metadata for dropping relationships
const relationshipsToDrop = [
  // User relationships
  {
    type: 'pg_drop_relationship',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'notification_permissions' },
      relationship: 'user'
    }
  },
  {
    type: 'pg_drop_relationship',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'notification_messages' },
      relationship: 'user'
    }
  },
  // Notification relationships
  {
    type: 'pg_drop_relationship',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'notifications' },
      relationship: 'message'
    }
  },
  {
    type: 'pg_drop_relationship',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'notifications' },
      relationship: 'permission'
    }
  },
  // Reverse relationships
  {
    type: 'pg_drop_relationship',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'notification_permissions' },
      relationship: 'notifications'
    }
  },
  {
    type: 'pg_drop_relationship',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'notification_messages' },
      relationship: 'notifications'
    }
  },
  {
    type: 'pg_drop_relationship',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'users' },
      relationship: 'notification_permissions'
    }
  },
  {
    type: 'pg_drop_relationship',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'users' },
      relationship: 'notification_messages'
    }
  }
];

/**
 * Drop permissions and relationships
 */
export async function dropMetadata(hasura: Hasura) {
  debug('🧹 Dropping notification permissions, relationships, and untracking tables...');
  
  debug('  🗑️ Dropping all known permissions first...');
  for (const dropRequest of permissionsToDrop) {
    const permType = dropRequest.type.replace('pg_drop_', '').replace('_permission', '');
    const tableName = `${dropRequest.args.table.schema}.${dropRequest.args.table.name}`;
    const role = dropRequest.args.role;
    debug(`     Dropping ${permType} permission for role [${role}] on table [${tableName}]...`);
    try {
        await hasura.v1(dropRequest);
    } catch (e: any) {
        // Log non-critical errors, e.g., if permission was already deleted
        if (e.message && (e.message.includes('does not exist') || e.message.includes('not found') || e.message.includes('permission-denied'))) {
            debug(`     Permission ${permType} for ${role} on ${tableName} likely already deleted or never existed. Skipping.`);
        } else {
            throw e; // Re-throw if it's a different error
        }
    }
  }
  debug('  ✅ All known permissions dropped (or confirmed absent).');
  
  debug('  🗑️ Dropping relationships...');
  for (const relToDrop of relationshipsToDrop) {
    const rel = `${relToDrop.args.relationship} on ${relToDrop.args.table.schema}.${relToDrop.args.table.name}`;
    debug(`     Dropping relationship ${rel}...`);
    try {
        await hasura.v1(relToDrop);
    } catch (e: any) {
        if (e.message && (e.message.includes('does not exist') || e.message.includes('not-exists'))) {
            debug(`     Relationship ${rel} likely already deleted or never existed. Skipping.`);
        } else {
            throw e;
        }
    }
  }
  debug('  ✅ Relationships dropped (or confirmed absent).');

  debug('  🗑️ Untracking notification tables...');
  for (const untrackRequest of tablesToUntrack) {
    const tableName = `${untrackRequest.args.table.schema}.${untrackRequest.args.table.name}`;
    debug(`  📝 Untracking table ${tableName}...`);
    try {
        await hasura.v1(untrackRequest);
    } catch (e: any) {
        if (e.message && (e.message.includes('already untracked') || e.message.includes('not-exists'))) {
            debug(`     Table ${tableName} likely already untracked or never existed. Skipping.`);
        } else {
            throw e;
        }
    }
  }
  debug('✅ Tables untracked (or confirmed absent/untracked).');
}

/**
 * Drop notification tables
 */
export async function dropTables(hasura: Hasura) {
  debug('🧹 Dropping notification tables...');
  await hasura.sql(dropTablesSQL);
  debug('✅ Notification tables dropped successfully.');
}

/**
 * Main migration function to remove notification tables
 */
export async function down(customHasura?: Hasura) {
  debug('🚀 Starting Hasura Notify migration DOWN...');
  
  // Use provided hasura instance or create a new one
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