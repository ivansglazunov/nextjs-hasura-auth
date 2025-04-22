// codegen.ts
import type { CodegenConfig } from '@graphql-codegen/cli';
import dotenv from 'dotenv';
import path from 'path';

// Загружаем переменные окружения (путь к .env файлу)
dotenv.config();

const config: CodegenConfig = {
  overwrite: true,
  // Указываем путь к файлу схемы, который мы генерируем
  schema: './public/hasura-schema.json',
  // Можно также указать URL и заголовки, если хотим запрашивать схему напрямую
  // schema: [
  //   {
  //     [process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!]: {
  //       headers: {
  //         'X-Hasura-Admin-Secret': process.env.HASURA_ADMIN_SECRET!,
  //       },
  //     },
  //   },
  // ],
  documents: undefined, // Мы не используем отдельные .graphql файлы для операций
  generates: {
    // Путь к файлу, куда будут сгенерированы типы
    'types/hasura-types.d.ts': {
      plugins: ['typescript'], // Используем базовый плагин typescript
      config: {
        // Настройки плагина typescript (можно добавить позже по необходимости)
        // Например:
        // scalars: { // Маппинг скаляров Hasura/Postgres на типы TS
        //   uuid: 'string',
        //   timestamptz: 'string',
        //   numeric: 'number',
        //   // ... другие скаляры
        // },
        // avoidOptionals: true, // Сделать необязательные поля обязательными (осторожно)
        // maybeValue: 'T | null | undefined', // Как представлять nullable типы
      },
    },
    // Можно добавить другие выходные файлы или плагины сюда
    // Например, для генерации типов операций:
    // './path/to/graphql.ts': {
    //   preset: 'import-types',
    //   documents: 'src/**/*.graphql', // Если бы у нас были .graphql файлы
    //   plugins: ['typescript-operations'],
    //   presetConfig: {
    //     typesPath: './hasura-types.d.ts', // Ссылка на базовые типы
    //   },
    // },
  },
  hooks: { // Запускается после генерации
      afterAllFileWrite: ['prettier --write'] // Форматируем сгенерированные файлы
  }
};

module.exports = config;