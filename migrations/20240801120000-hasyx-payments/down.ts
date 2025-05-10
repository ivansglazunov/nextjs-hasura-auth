import { Hasura } from 'hasyx/lib/hasura'; // или правильный путь к вашему Hasura SDK
import Debug from 'hasyx/lib/debug';

const debug = Debug('migration:down-payments');
const MIGRATION_NAME = '20240801120000-hasyx-payments';

const sqlSchemaDown = `
  DROP TABLE IF EXISTS "public"."payments";
  DROP TABLE IF EXISTS "public"."subscriptions";
  DROP TABLE IF EXISTS "public"."subscription_plans";
  DROP TABLE IF EXISTS "public"."payment_methods";
`;

// В down-миграции мы обычно сначала удаляем метаданные (untrack, drop permissions, drop relationships),
// а потом таблицы. Hasura CLI делает это в определенном порядке.
// Здесь для простоты мы можем положиться на каскадное удаление зависимостей при untrack table
// или явно определить шаги по удалению метаданных.

const untrackTablesMetadata = {
    type: "bulk",
    source: "default",
    args: [
        {
            type: "pg_untrack_table",
            args: { table: { schema: "public", name: "payments" }, cascade_dependencies: true }
        },
        {
            type: "pg_untrack_table",
            args: { table: { schema: "public", name: "subscriptions" }, cascade_dependencies: true }
        },
        {
            type: "pg_untrack_table",
            args: { table: { schema: "public", name: "subscription_plans" }, cascade_dependencies: true }
        },
        {
            type: "pg_untrack_table",
            args: { table: { schema: "public", name: "payment_methods" }, cascade_dependencies: true }
        }
    ]
};

export async function down() {
  debug(`Starting migration: ${MIGRATION_NAME} - DOWN`);
  const hasura = new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
    secret: process.env.HASURA_ADMIN_SECRET!,
  });

  try {
    debug('Removing Hasura metadata (untracking tables, relationships, permissions)...');
    // Попытка сначала удалить метаданные, связанные с таблицами
    // Это безопаснее, чем просто удалять таблицы, так как Hasura может ругаться на зависимости
    await hasura.v1(untrackTablesMetadata as any); 
    debug('Hasura metadata removed successfully.');

    debug('Dropping SQL schema...');
    await hasura.sql(sqlSchemaDown);
    debug('SQL schema dropped successfully.');

    debug(`Migration ${MIGRATION_NAME} - DOWN completed successfully.`);
    return true;
  } catch (error) {
    console.error(`Error during migration ${MIGRATION_NAME} - DOWN:`, error);
    debug(`Migration ${MIGRATION_NAME} - DOWN failed: ${error}`);
    // Consider re-throwing the error if the migration CLI should stop on failure
    throw error;
  }
}

// Если вы используете этот файл напрямую с tsx, например: tsx migrations/..../down.ts
if (require.main === module) {
  const dotenv = require('dotenv');
  const path = require('path');
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });

  down().catch(e => console.error(e));
} 