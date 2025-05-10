import { Hasura } from './hasura';
import Debug from './debug';

const debug = Debug('lib:down-payments');
const MIGRATION_NAME = '20240801120000-hasyx-payments';

const sqlSchemaDown = `
  DROP TABLE IF EXISTS "public"."payments" CASCADE;
  DROP TABLE IF EXISTS "public"."subscriptions" CASCADE;
  DROP TABLE IF EXISTS "public"."subscription_plans" CASCADE;
  DROP TABLE IF EXISTS "public"."payment_methods" CASCADE;
`;

// In down-migrations, we typically first remove metadata (untrack, drop permissions, drop relationships),
// and then the tables. Hasura CLI does this in a specific order.
// Here, we first untrack tables which should cascade and remove dependent metadata.

const untrackTablesPayload = [
    {
        type: "pg_untrack_table",
        args: { table: { schema: "public", name: "payments" }, cascade: true }
    },
    {
        type: "pg_untrack_table",
        args: { table: { schema: "public", name: "subscriptions" }, cascade: true }
    },
    {
        type: "pg_untrack_table",
        args: { table: { schema: "public", name: "subscription_plans" }, cascade: true }
    },
    {
        type: "pg_untrack_table",
        args: { table: { schema: "public", name: "payment_methods" }, cascade: true }
    }
];

const relationshipsToDropPayload = [
  // Existing relationships to drop (if any, from payment_methods, etc. TO user)
  // Assuming these might exist based on the up-migration's object relationships
  { type: "pg_drop_relationship", args: { table: { schema: "public", name: "payment_methods" }, relationship: "user" } },
  { type: "pg_drop_relationship", args: { table: { schema: "public", name: "subscription_plans" }, relationship: "user" } },
  { type: "pg_drop_relationship", args: { table: { schema: "public", name: "subscriptions" }, relationship: "user" } },
  { type: "pg_drop_relationship", args: { table: { schema: "public", name: "subscriptions" }, relationship: "payment_method" } },
  { type: "pg_drop_relationship", args: { table: { schema: "public", name: "subscriptions" }, relationship: "plan" } },
  { type: "pg_drop_relationship", args: { table: { schema: "public", name: "payments" }, relationship: "user" } },
  { type: "pg_drop_relationship", args: { table: { schema: "public", name: "payments" }, relationship: "payment_method" } },
  { type: "pg_drop_relationship", args: { table: { schema: "public", name: "payments" }, relationship: "subscription" } },

  // New array relationships from users to drop
  { type: "pg_drop_relationship", args: { table: { schema: "public", name: "users" }, relationship: "payment_methods" } },
  { type: "pg_drop_relationship", args: { table: { schema: "public", name: "users" }, relationship: "payments" } },
  { type: "pg_drop_relationship", args: { table: { schema: "public", name: "users" }, relationship: "subscription_plans_created" } },
  { type: "pg_drop_relationship", args: { table: { schema: "public", name: "users" }, relationship: "subscriptions" } }
];

export async function down(customHasura?: Hasura) {
  debug(`Starting migration: ${MIGRATION_NAME} - DOWN`);
  const hasura = customHasura || new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
    secret: process.env.HASURA_ADMIN_SECRET!,
  });

  try {
    debug('Removing Hasura metadata (dropping relationships, then untracking tables)...');
    // It's often safer to drop relationships explicitly before untracking if `cascade: true` on untrack is not fully relied upon
    // or if specific order is needed.
    const dropRelArgs = relationshipsToDropPayload.map(payload => ({ ...payload, source: "default" }));
    await hasura.v1({ type: "bulk", args: dropRelArgs });
    debug('Relationships dropped successfully.');

    const untrackArgs = untrackTablesPayload.map(payload => ({ ...payload, source: "default" }));
    await hasura.v1({ type: "bulk", args: untrackArgs });
    debug('Hasura metadata related to tables removed successfully (untracked).');

    debug('Dropping SQL schema (tables)... ');
    await hasura.sql(sqlSchemaDown, 'default', true); // cascade = true in SQL DROP TABLE as well, for safety
    debug('SQL schema (tables) dropped successfully.');

    debug(`Migration ${MIGRATION_NAME} - DOWN completed successfully.`);
    return true;
  } catch (error) {
    console.error('Error during migration ' + MIGRATION_NAME + ' - DOWN:', error);
    debug('Migration ' + MIGRATION_NAME + ' - DOWN failed.');
    throw error;
  }
} 