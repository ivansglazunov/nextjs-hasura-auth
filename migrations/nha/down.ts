import dotenv from 'dotenv';
import path from 'path';
import { Hasura } from '../../lib/hasura'; // Путь относительно файла миграции
import Debug from '../../lib/debug';

// Инициализация debug
const debug = Debug('nha:migration:down');

// Загружаем переменные окружения из корневого .env файла
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Валидация происходит внутри конструктора Hasura
const hasura = new Hasura({
  url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!, // Используем non-null assertion
  secret: process.env.HASURA_ADMIN_SECRET!,
});

// SQL для удаления таблиц
const dropTablesSQL = `
  DROP TABLE IF EXISTS public.accounts CASCADE;
  DROP TABLE IF EXISTS public.users CASCADE;
`;

// Метаданные для удаления отслеживания таблиц
const tablesToUntrack = [
  {
    type: 'pg_untrack_table',
    args: {
      source: 'default',
      table: {
        schema: 'public',
        name: 'accounts'
      },
      cascade: true // Удаляем связанные разрешения и отношения
    }
  },
  {
    type: 'pg_untrack_table',
    args: {
      source: 'default',
      table: {
        schema: 'public',
        name: 'users'
      },
      cascade: true // Удаляем связанные разрешения и отношения
    }
  }
];

async function dropMetadata() {
  debug('🧹 Untracking tables users and accounts...');
  for (const untrackRequest of tablesToUntrack) {
    const tableName = `${untrackRequest.args.table.schema}.${untrackRequest.args.table.name}`;
    debug(`  📝 Untracking table ${tableName}...`);
    await hasura.v1(untrackRequest);
     // Note: hasura.v1 handles 'not found' messages internally
  }
  debug('✅ Tables untracked.');
}

async function dropTables() {
  debug('🧹 Dropping tables users and accounts...');
  await hasura.sql(dropTablesSQL);
  debug('✅ Tables dropped successfully.');
}

async function down() {
  debug('🚀 Starting Hasura migration DOWN...');
  try {
    // Сначала удаляем метаданные (отслеживание), т.к. они зависят от таблиц
    await dropMetadata();

    // Затем удаляем сами таблицы
    await dropTables();

    debug('✨ Hasura migration DOWN completed successfully!');
  } catch (error) {
    console.error('❗ Critical error during DOWN migration:', error);
    debug('❌ DOWN Migration failed.');
    process.exit(1); // Exit with error code on failure
  }
}

// Run the migration
down();
