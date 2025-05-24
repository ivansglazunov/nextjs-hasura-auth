import { Hasura } from './hasura';
import Debug from './debug';

const debug = Debug('lib:down-payments');
const MIGRATION_NAME = '20240801120000-hasyx-payments';

// Order of operations for down migration:
// 1. Drop permissions for all tables in payments schema.
// 2. Drop relationships for all tables in payments schema (and from public.users to payments schema).
// 3. Untrack all tables in payments schema.
// 4. Drop all tables in payments schema.
// 5. Drop the payments schema itself.

const tablesInPaymentsSchema = ["operations", "subscriptions", "plans", "methods", "providers", "user_payment_provider_mappings"];

const permissionsToDropPayload: any[] = [];
const roles = ["public", "user", "me", "admin"]; // Roles for which permissions were created

tablesInPaymentsSchema.forEach(table => {
  roles.forEach(role => {
    permissionsToDropPayload.push({ type: "pg_drop_select_permission", args: { table: { schema: "payments", name: table }, role: role, source: "default" } });
    permissionsToDropPayload.push({ type: "pg_drop_insert_permission", args: { table: { schema: "payments", name: table }, role: role, source: "default" } });
    permissionsToDropPayload.push({ type: "pg_drop_update_permission", args: { table: { schema: "payments", name: table }, role: role, source: "default" } });
    permissionsToDropPayload.push({ type: "pg_drop_delete_permission", args: { table: { schema: "payments", name: table }, role: role, source: "default" } });
  });
});

const relationshipsToDropPayload = [
  // Relationships from public.users to payments schema tables
  { type: "pg_drop_relationship", args: { table: { schema: "public", name: "users" }, relationship: "payment_providers", source: "default" } },
  { type: "pg_drop_relationship", args: { table: { schema: "public", name: "users" }, relationship: "payment_methods", source: "default" } },
  { type: "pg_drop_relationship", args: { table: { schema: "public", name: "users" }, relationship: "payment_operations", source: "default" } },
  { type: "pg_drop_relationship", args: { table: { schema: "public", name: "users" }, relationship: "subscription_plans_created", source: "default" } },
  { type: "pg_drop_relationship", args: { table: { schema: "public", name: "users" }, relationship: "subscriptions", source: "default" } },

  // Relationships within payments.providers
  { type: "pg_drop_relationship", args: { table: { schema: "payments", name: "providers" }, relationship: "user", source: "default" } },
  { type: "pg_drop_relationship", args: { table: { schema: "payments", name: "providers" }, relationship: "methods", source: "default" } },
  { type: "pg_drop_relationship", args: { table: { schema: "payments", name: "providers" }, relationship: "subscriptions", source: "default" } },
  { type: "pg_drop_relationship", args: { table: { schema: "payments", name: "providers" }, relationship: "operations", source: "default" } },
  
  // Relationships within payments.methods
  { type: "pg_drop_relationship", args: { table: { schema: "payments", name: "methods" }, relationship: "user", source: "default" } },
  { type: "pg_drop_relationship", args: { table: { schema: "payments", name: "methods" }, relationship: "provider", source: "default" } },
  { type: "pg_drop_relationship", args: { table: { schema: "payments", name: "methods" }, relationship: "subscriptions", source: "default" } },
  { type: "pg_drop_relationship", args: { table: { schema: "payments", name: "methods" }, relationship: "operations", source: "default" } },

  // Relationships within payments.plans
  { type: "pg_drop_relationship", args: { table: { schema: "payments", name: "plans" }, relationship: "user", source: "default" } },
  { type: "pg_drop_relationship", args: { table: { schema: "payments", name: "plans" }, relationship: "subscriptions", source: "default" } },

  // Relationships within payments.subscriptions
  { type: "pg_drop_relationship", args: { table: { schema: "payments", name: "subscriptions" }, relationship: "user", source: "default" } },
  { type: "pg_drop_relationship", args: { table: { schema: "payments", name: "subscriptions" }, relationship: "method", source: "default" } },
  { type: "pg_drop_relationship", args: { table: { schema: "payments", name: "subscriptions" }, relationship: "plan", source: "default" } },
  { type: "pg_drop_relationship", args: { table: { schema: "payments", name: "subscriptions" }, relationship: "provider", source: "default" } },
  { type: "pg_drop_relationship", args: { table: { schema: "payments", name: "subscriptions" }, relationship: "operations", source: "default" } },

  // Relationships within payments.operations
  { type: "pg_drop_relationship", args: { table: { schema: "payments", name: "operations" }, relationship: "user", source: "default" } },
  { type: "pg_drop_relationship", args: { table: { schema: "payments", name: "operations" }, relationship: "method", source: "default" } },
  { type: "pg_drop_relationship", args: { table: { schema: "payments", name: "operations" }, relationship: "provider", source: "default" } },
  { type: "pg_drop_relationship", args: { table: { schema: "payments", name: "operations" }, relationship: "subscription", source: "default" } },

  // Relationships within payments.user_payment_provider_mappings
  { type: "pg_drop_relationship", args: { table: { schema: "payments", name: "user_payment_provider_mappings" }, relationship: "user", source: "default" } },
  { type: "pg_drop_relationship", args: { table: { schema: "payments", name: "user_payment_provider_mappings" }, relationship: "provider", source: "default" } },

  // Relationships from payments.providers to user_payment_provider_mappings
  { type: "pg_drop_relationship", args: { table: { schema: "payments", name: "providers" }, relationship: "user_mappings", source: "default" } },

  // Relationships from public.users to user_payment_provider_mappings
  { type: "pg_drop_relationship", args: { table: { schema: "public", name: "users" }, relationship: "payment_provider_mappings", source: "default" } }
];

const untrackTablesPayload = tablesInPaymentsSchema.map(table => ({
  type: "pg_untrack_table",
  args: { table: { schema: "payments", name: table }, cascade: true, source: "default" } // cascade true should also remove permissions and relationships
}));

const sqlSchemaDown = `
  DROP TABLE IF EXISTS "payments"."operations" CASCADE;
  DROP TABLE IF EXISTS "payments"."subscriptions" CASCADE;
  DROP TABLE IF EXISTS "payments"."plans" CASCADE;
  DROP TABLE IF EXISTS "payments"."methods" CASCADE;
  DROP TABLE IF EXISTS "payments"."user_payment_provider_mappings" CASCADE;
  DROP TABLE IF EXISTS "payments"."providers" CASCADE;
  DROP SCHEMA IF EXISTS "payments" CASCADE;
`;

// Fallback for dropping old public tables if they were not handled during up migration
// and this down script is run on a database that had the old structure.
const sqlDropOldPublicTables = `
  DROP TABLE IF EXISTS "public"."payments" CASCADE;
  DROP TABLE IF EXISTS "public"."subscriptions" CASCADE;
  DROP TABLE IF EXISTS "public"."subscription_plans" CASCADE;
  DROP TABLE IF EXISTS "public"."payment_methods" CASCADE;
`;

export async function down(customHasura?: Hasura) {
  debug(`Starting migration: ${MIGRATION_NAME} - DOWN (new payments schema)`);
  const hasura = customHasura || new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
    secret: process.env.HASURA_ADMIN_SECRET!,
  });

  try {
    debug('Attempting to remove Hasura metadata (permissions, relationships, untrack tables) for "payments" schema...');
    // Explicitly drop permissions and relationships first, although untrack with cascade might do it.
    // This order is generally safer.
    // Hasura might error if a permission/relationship doesn't exist, so these calls should be idempotent or errors ignored.
    // For simplicity, we assume they exist or errors are handled by Hasura gracefully (e.g., not found is not a fatal error for drop_..._permission).

    // Drop Permissions (Best effort, Hasura might ignore if not found)
    // Note: pg_drop_..._permission does not support bulk, so we would loop or use multiple v1 calls.
    // However, untracking with cascade:true is the more common approach.
    // For this script, we will rely on untrack cascade for permissions and relationships removal primarily.
    // If specific relationship/permission drops are needed before untrack, they must be precise.

    // Drop Relationships (Explicitly listed)
    // Filter out any relationships that might not exist to avoid errors if run multiple times or on a clean slate.
    // This typically involves querying metadata first, which is complex for a simple script.
    // We will proceed with the defined list. If Hasura errors on non-existent items, that's acceptable for a down script.
    if (relationshipsToDropPayload.length > 0) {
        debug('Dropping relationships explicitly...');
        try {
            await hasura.v1({ type: "bulk", args: relationshipsToDropPayload.filter(r => r.args.table && r.args.relationship) });
            debug('Relationships dropped successfully or already absent.');
        } catch (e: any) {
            debug('Error or partial success dropping relationships (some might not have existed):', e.message);
        }
    }

    // Untrack Tables (with cascade)
    if (untrackTablesPayload.length > 0) {
        debug('Untracking tables from "payments" schema with cascade...');
        try {
            await hasura.v1({ type: "bulk", args: untrackTablesPayload });
            debug('Tables from "payments" schema untracked successfully.');
        } catch (e: any) {
            debug('Error or partial success untracking tables (some might not have been tracked):', e.message);
        }
    }

    debug('Dropping SQL schema ("payments" schema and its tables)... ');
    await hasura.sql(sqlSchemaDown, 'default', true); // cascade = true in SQL DROP
    debug('"payments" SQL schema and tables dropped successfully.');
    
    debug('(Optional) Attempting to drop old public payment tables if they exist...');
    await hasura.sql(sqlDropOldPublicTables, 'default', true);
    debug('Old public payment tables dropped successfully or were not present.');

    debug(`Migration ${MIGRATION_NAME} - DOWN (new payments schema) completed successfully.`);
    return true;
  } catch (error) {
    console.error('Error during migration ' + MIGRATION_NAME + ' - DOWN (new payments schema):', error);
    debug('Migration ' + MIGRATION_NAME + ' - DOWN (new payments schema) failed.');
    throw error;
  }
} 