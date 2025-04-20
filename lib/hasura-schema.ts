// lib/hasura-schema.ts
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { IntrospectionQuery, getIntrospectionQuery } from 'graphql'; // Use standard introspection query function

// Загружаем переменные окружения из корневого .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const HASURA_GRAPHQL_URL = process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL;
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET;
const OUTPUT_PATH = path.resolve(__dirname, '../public/hasura-schema.json');

if (!HASURA_GRAPHQL_URL) {
  console.error('❌ Ошибка: NEXT_PUBLIC_HASURA_GRAPHQL_URL не определен в .env');
  process.exit(1);
}

async function fetchSchema() {
  console.log(`🚀 Запрос схемы интроспекции с ${HASURA_GRAPHQL_URL}...`);
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (HASURA_ADMIN_SECRET) {
      headers['X-Hasura-Admin-Secret'] = HASURA_ADMIN_SECRET;
      console.log('🔑 Используется Hasura Admin Secret.');
    } else {
       console.warn('⚠️ HASURA_ADMIN_SECRET не найден. Запрос схемы без админ-прав (может быть неполным).');
    }

    const response = await axios.post(
      HASURA_GRAPHQL_URL!, // Add non-null assertion here
      {
        query: getIntrospectionQuery(), // Use the function to get the query string
      },
      { headers }
    );

    if (response.data.errors) {
       throw new Error(`Ошибка GraphQL при запросе схемы: ${JSON.stringify(response.data.errors)}`);
    }

    if (!response.data || !response.data.data || !response.data.data.__schema) {
        throw new Error('Некорректный ответ от сервера Hasura. Отсутствует data.__schema.');
    }


    // Структурируем схему для совместимости с генератором (опционально, можно просто сохранить __schema)
    // Пока оставим простую структуру, аналогичную schema.js, но только с __schema
    // const structuredSchema = {
    //   __schema: response.data.data.__schema
    // };
    // Для начала сохраним полный результат интроспекции, codegen его поймет
    const introspectionResult = response.data; 

    console.log(`💾 Сохранение схемы в ${OUTPUT_PATH}...`);
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(introspectionResult, null, 2)); // Сохраняем весь результат

    console.log(`✅ Схема успешно получена и сохранена в ${OUTPUT_PATH}`);
  } catch (error: any) {
    console.error('❌ Ошибка при получении или сохранении схемы:', error.response?.data || error.message || error);
    process.exit(1);
  }
}

fetchSchema(); 