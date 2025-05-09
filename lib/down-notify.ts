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

// Metadata for dropping permissions
const permissionsToDrop = [
  // User permissions
  {
    type: 'pg_drop_select_permission',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'notification_permissions' },
      role: 'user'
    }
  },
  {
    type: 'pg_drop_select_permission',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'notification_messages' },
      role: 'user'
    }
  },
  {
    type: 'pg_drop_select_permission',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'notifications' },
      role: 'user'
    }
  },
  // Admin permissions
  {
    type: 'pg_drop_select_permission',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'notification_permissions' },
      role: 'admin'
    }
  },
  {
    type: 'pg_drop_select_permission',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'notification_messages' },
      role: 'admin'
    }
  },
  {
    type: 'pg_drop_select_permission',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'notifications' },
      role: 'admin'
    }
  }
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
  debug('🧹 Dropping notification permissions...');
  
  // Drop all permissions first
  debug('  🗑️ Dropping permissions...');
  for (const dropRequest of permissionsToDrop) {
    const perm = `${dropRequest.args.role} on ${dropRequest.args.table.schema}.${dropRequest.args.table.name}`;
    debug(`     Dropping select permission for ${perm}...`);
    await hasura.v1(dropRequest);
    // Note: hasura.v1 handles 'not found' messages internally
  }
  debug('  ✅ Permissions dropped.');
  
  // Drop relationships
  debug('  🗑️ Dropping relationships...');
  for (const relToDrop of relationshipsToDrop) {
    const rel = `${relToDrop.args.relationship} on ${relToDrop.args.table.schema}.${relToDrop.args.table.name}`;
    debug(`     Dropping relationship ${rel}...`);
    await hasura.v1(relToDrop);
    // Note: hasura.v1 handles 'not found' messages internally
  }
  debug('  ✅ Relationships dropped.');

  // Untrack tables
  debug('  🗑️ Untracking notification tables...');
  for (const untrackRequest of tablesToUntrack) {
    const tableName = `${untrackRequest.args.table.schema}.${untrackRequest.args.table.name}`;
    debug(`  📝 Untracking table ${tableName}...`);
    await hasura.v1(untrackRequest);
     // Note: hasura.v1 handles 'not found' messages internally
  }
  debug('✅ Tables untracked.');
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