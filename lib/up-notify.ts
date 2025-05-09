import dotenv from 'dotenv';
import path from 'path';
import { Hasura } from './hasura';
import Debug from './debug';

// Initialize debug
const debug = Debug('migration:up-notify');

// SQL schema for notification tables
const sqlSchema = `
  -- Create notification_permissions table
  CREATE TABLE IF NOT EXISTS "public"."notification_permissions" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL,
      "provider" text NOT NULL,
      "device_token" text NOT NULL,
      "device_info" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "created_at" timestamptz NOT NULL,
      "updated_at" timestamptz NOT NULL,
      PRIMARY KEY ("id"),
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE
  );

  -- Create indexes for notification_permissions
  CREATE INDEX IF NOT EXISTS "idx_notification_permissions_device_token" ON "public"."notification_permissions" ("device_token");
  CREATE INDEX IF NOT EXISTS "idx_notification_permissions_user_id" ON "public"."notification_permissions" ("user_id");

  -- Create notification_messages table
  CREATE TABLE IF NOT EXISTS "public"."notification_messages" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "title" text NOT NULL,
      "body" text NOT NULL,
      "data" jsonb DEFAULT NULL,
      "user_id" uuid NOT NULL,
      "created_at" timestamptz NOT NULL,
      PRIMARY KEY ("id"),
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE
  );

  -- Create indexes for notification_messages
  CREATE INDEX IF NOT EXISTS "idx_notification_messages_user_id" ON "public"."notification_messages" ("user_id");

  -- Create notifications table
  CREATE TABLE IF NOT EXISTS "public"."notifications" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "message_id" uuid NOT NULL,
      "permission_id" uuid NOT NULL,
      "config" jsonb DEFAULT NULL,
      "status" text NOT NULL DEFAULT 'pending',
      "error" text DEFAULT NULL,
      "created_at" timestamptz NOT NULL,
      "updated_at" timestamptz NOT NULL,
      PRIMARY KEY ("id"),
      FOREIGN KEY ("message_id") REFERENCES "public"."notification_messages"("id") ON UPDATE CASCADE ON DELETE CASCADE,
      FOREIGN KEY ("permission_id") REFERENCES "public"."notification_permissions"("id") ON UPDATE CASCADE ON DELETE CASCADE
  );

  -- Create indexes for notifications
  CREATE INDEX IF NOT EXISTS "idx_notifications_status" ON "public"."notifications" ("status");
  CREATE INDEX IF NOT EXISTS "idx_notifications_message_id" ON "public"."notifications" ("message_id");
  CREATE INDEX IF NOT EXISTS "idx_notifications_permission_id" ON "public"."notifications" ("permission_id");
`;

// Tables to track in Hasura
const tablesToTrack = [
  { schema: 'public', name: 'notification_permissions' },
  { schema: 'public', name: 'notification_messages' },
  { schema: 'public', name: 'notifications' }
];

// Relationships to create
const relationships = [
  // User relationships
  {
    type: 'pg_create_object_relationship',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'notification_permissions' },
      name: 'user',
      using: {
        foreign_key_constraint_on: 'user_id'
      }
    }
  },
  {
    type: 'pg_create_object_relationship',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'notification_messages' },
      name: 'user',
      using: {
        foreign_key_constraint_on: 'user_id'
      }
    }
  },
  // Notification relationships
  {
    type: 'pg_create_object_relationship',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'notifications' },
      name: 'message',
      using: {
        foreign_key_constraint_on: 'message_id'
      }
    }
  },
  {
    type: 'pg_create_object_relationship',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'notifications' },
      name: 'permission',
      using: {
        foreign_key_constraint_on: 'permission_id'
      }
    }
  },
  // Reverse relationships
  {
    type: 'pg_create_array_relationship',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'notification_permissions' },
      name: 'notifications',
      using: {
        foreign_key_constraint_on: {
          table: { schema: 'public', name: 'notifications' },
          column: 'permission_id'
        }
      }
    }
  },
  {
    type: 'pg_create_array_relationship',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'notification_messages' },
      name: 'notifications',
      using: {
        foreign_key_constraint_on: {
          table: { schema: 'public', name: 'notifications' },
          column: 'message_id'
        }
      }
    }
  },
  {
    type: 'pg_create_array_relationship',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'users' },
      name: 'notification_permissions',
      using: {
        foreign_key_constraint_on: {
          table: { schema: 'public', name: 'notification_permissions' },
          column: 'user_id'
        }
      }
    }
  },
  {
    type: 'pg_create_array_relationship',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'users' },
      name: 'notification_messages',
      using: {
        foreign_key_constraint_on: {
          table: { schema: 'public', name: 'notification_messages' },
          column: 'user_id'
        }
      }
    }
  }
];

// Table select permissions for roles
const selectPermissions = [
  // User permissions
  {
    type: 'pg_create_select_permission',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'notification_permissions' },
      role: 'user',
      permission: {
        columns: ['id', 'user_id', 'provider', 'device_token', 'device_info', 'created_at', 'updated_at'],
        filter: {
          user_id: { _eq: 'X-Hasura-User-Id' }
        }
      },
      comment: 'Users can select their own notification permissions'
    }
  },
  {
    type: 'pg_create_select_permission',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'notification_messages' },
      role: 'user',
      permission: {
        columns: ['id', 'title', 'body', 'data', 'user_id', 'created_at'],
        filter: {
          notifications: {
            permission: {
              user_id: { _eq: 'X-Hasura-User-Id' }
            }
          }
        }
      },
      comment: 'Users can select messages they are recipients of'
    }
  },
  {
    type: 'pg_create_select_permission',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'notifications' },
      role: 'user',
      permission: {
        columns: ['id', 'message_id', 'permission_id', 'config', 'status', 'error', 'created_at', 'updated_at'],
        filter: {
          permission: {
            user_id: { _eq: 'X-Hasura-User-Id' }
          }
        }
      },
      comment: 'Users can select notifications linked to their permissions'
    }
  },
  // Admin permissions
  {
    type: 'pg_create_select_permission',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'notification_permissions' },
      role: 'admin',
      permission: {
        columns: '*',
        filter: {}
      },
      comment: 'Admins can select all notification permissions'
    }
  },
  {
    type: 'pg_create_select_permission',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'notification_messages' },
      role: 'admin',
      permission: {
        columns: '*',
        filter: {}
      },
      comment: 'Admins can select all notification messages'
    }
  },
  {
    type: 'pg_create_select_permission',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'notifications' },
      role: 'admin',
      permission: {
        columns: '*',
        filter: {}
      },
      comment: 'Admins can select all notifications'
    }
  },
  // Anonymous permissions (select only ID with an impossible filter)
  {
    type: 'pg_create_select_permission',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'notification_permissions' },
      role: 'anonymous',
      permission: {
        columns: ['id'],
        filter: { id: { _eq: "00000000-0000-0000-0000-000000000000" } }
      },
      comment: 'Anonymous can query table structure but not see data.'
    }
  },
  {
    type: 'pg_create_select_permission',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'notification_messages' },
      role: 'anonymous',
      permission: {
        columns: ['id'],
        filter: { id: { _eq: "00000000-0000-0000-0000-000000000000" } }
      },
      comment: 'Anonymous can query table structure but not see data.'
    }
  },
  {
    type: 'pg_create_select_permission',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'notifications' },
      role: 'anonymous',
      permission: {
        columns: ['id'],
        filter: { id: { _eq: "00000000-0000-0000-0000-000000000000" } }
      },
      comment: 'Anonymous can query table structure but not see data.'
    }
  }
];

// Table insert permissions for roles
const insertPermissions = [
  {
    type: 'pg_create_insert_permission',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'notification_permissions' },
      role: 'user',
      permission: {
        columns: ['provider', 'device_token', 'device_info', 'created_at', 'updated_at', 'id', 'user_id'],
        check: { user_id: { _eq: 'X-Hasura-User-Id' } },
        set: { user_id: 'X-Hasura-User-Id' }
      },
      comment: 'Users can insert their own notification permissions'
    }
  },
  {
    type: 'pg_create_insert_permission',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'notification_messages' },
      role: 'user',
      permission: {
        columns: ['title', 'body', 'data', 'created_at', 'id', 'user_id'],
        check: { user_id: { _eq: 'X-Hasura-User-Id' } },
        set: { user_id: 'X-Hasura-User-Id' }
      },
      comment: 'Users can insert their own notification messages'
    }
  },
  {
    type: 'pg_create_insert_permission',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'notifications' },
      role: 'user',
      permission: {
        columns: ['message_id', 'permission_id', 'config', 'status', 'created_at', 'updated_at', 'id'],
        check: {
          permission: {
            user_id: { _eq: 'X-Hasura-User-Id' }
          }
        }
      },
      comment: 'Users can insert notifications for their own permissions'
    }
  }
];

// Table delete permissions for roles
const deletePermissions = [
  {
    type: 'pg_create_delete_permission',
    args: {
      source: 'default',
      table: { schema: 'public', name: 'notification_permissions' },
      role: 'user',
      permission: {
        filter: { user_id: { _eq: 'X-Hasura-User-Id' } }
      },
      comment: 'Users can delete their own notification permissions'
    }
  }
];

/**
 * Apply SQL schema for notification tables
 */
export async function applySQLSchema(hasura: Hasura) {
  debug('🔧 Applying notification SQL schema...');
  await hasura.sql(sqlSchema, 'default', true);
  debug('✅ Notification SQL schema applied.');
}

/**
 * Track notification tables in Hasura
 */
export async function trackTables(hasura: Hasura) {
  debug('🔍 Tracking notification tables...');
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
  debug('✅ Notification table tracking complete.');
}

/**
 * Create relationships for notification tables
 */
export async function createRelationships(hasura: Hasura) {
  debug('🔗 Creating notification relationships...');
  for (const relationship of relationships) {
     debug(`  📝 Creating relationship ${relationship.args.name} for table ${relationship.args.table.name}...`);
     await hasura.v1(relationship);
     // Note: hasura.v1 handles 'already exists' messages internally
  }
  debug('✅ Notification relationships created.');
}

/**
 * Apply all permissions for notification tables
 */
export async function applyPermissions(hasura: Hasura) {
  debug('🔧 Applying notification permissions...');

  debug('  📝 Applying select permissions...');
  for (const permission of selectPermissions) {
    debug(`     Applying ${permission.args.role} select permission on ${permission.args.table.name}...`);
    await hasura.v1(permission);
  }

  debug('  📝 Applying insert permissions...');
  for (const permission of insertPermissions) {
    debug(`     Applying ${permission.args.role} insert permission on ${permission.args.table.name}...`);
    await hasura.v1(permission);
  }

  debug('  📝 Applying delete permissions...');
  for (const permission of deletePermissions) {
    debug(`     Applying ${permission.args.role} delete permission on ${permission.args.table.name}...`);
    await hasura.v1(permission);
  }

  debug('  ✅ Notification permissions applied.');
}

/**
 * Main migration function for notifications system
 */
export async function up(customHasura?: Hasura) {
  debug('🚀 Starting Hasura Notify migration UP...');
  
  // Use provided hasura instance or create a new one
  const hasura = customHasura || new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!, 
    secret: process.env.HASURA_ADMIN_SECRET!,
  });
  
  try {
    await applySQLSchema(hasura);
    await trackTables(hasura);
    await createRelationships(hasura);
    await applyPermissions(hasura);
    debug('✨ Hasura Notify migration UP completed successfully!');
    return true;
  } catch (error) {
    console.error('❗ Critical error during Notify UP migration:', error);
    debug('❌ Notify UP Migration failed.');
    return false;
  }
} 