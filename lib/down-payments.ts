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

export async function down(customHasura?: Hasura) {
  debug(`Starting migration: ${MIGRATION_NAME} - DOWN`);
  const hasura = customHasura || new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
    secret: process.env.HASURA_ADMIN_SECRET!,
  });

  try {
    debug('Removing Hasura metadata (untracking tables, which should cascade to relationships and permissions)...');
    // It is generally safer to untrack tables first. 
    // The `cascade: true` option in pg_untrack_table should handle removing dependent items like relationships and permissions.
    // If specific order or more granular control is needed, individual drop commands for permissions/relationships would be added here.
    const argsWithSource = untrackTablesPayload.map(payload => ({ ...payload, source: "default" }));
    await hasura.v1({ type: "bulk", args: argsWithSource });
    debug('Hasura metadata related to tables removed successfully.');

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