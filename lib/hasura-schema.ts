// lib/hasura-schema.ts
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs-extra'; // Use fs-extra for ensureDirSync
import path from 'path';
import { IntrospectionQuery, getIntrospectionQuery } from 'graphql'; // Use standard introspection query function

dotenv.config();

const HASURA_GRAPHQL_URL = process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL;
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET;
const OUTPUT_DIR = path.resolve(process.cwd(), 'public');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'hasura-schema.json');

if (!HASURA_GRAPHQL_URL) {
  console.error('❌ Error: NEXT_PUBLIC_HASURA_GRAPHQL_URL is not defined in .env');
  process.exit(1);
}

/**
 * Analyzes GraphQL schema types to identify PostgreSQL tables and their schemas
 * @param schemaTypes - Array of GraphQL types from introspection
 * @returns Mapping of GraphQL type names to their PostgreSQL schemas and table names
 */
function identifyTableSchemas(schemaTypes: any[]) {
  const tableMappings: Record<string, { schema: string, table: string }> = {};
  
  // Добавим отладочный вывод
  console.log(`Total types in schema: ${schemaTypes.length}`);
  
  // Выведем все объектные типы для анализа
  const allObjectTypes = schemaTypes.filter(type => type.kind === 'OBJECT' && type.name);
  console.log(`Object types in schema: ${allObjectTypes.length}`);
  console.log(`Object type names: ${allObjectTypes.map(t => t.name).join(', ')}`);
  
  // Шаг 1: поиск объектных типов, которые выглядят как таблицы
  // Предварительная идентификация, чтобы исключить агрегатные и служебные типы
  const potentialTableTypes = schemaTypes.filter(type => 
    type.kind === 'OBJECT' && 
    type.name && 
    !type.name.startsWith('__') &&
    !type.name.endsWith('_aggregate') && 
    !type.name.endsWith('_aggregate_fields') &&
    !type.name.endsWith('_avg_fields') && 
    !type.name.endsWith('_max_fields') && 
    !type.name.endsWith('_min_fields') && 
    !type.name.endsWith('_stddev_fields') && 
    !type.name.endsWith('_stddev_pop_fields') && 
    !type.name.endsWith('_stddev_samp_fields') && 
    !type.name.endsWith('_sum_fields') && 
    !type.name.endsWith('_var_pop_fields') && 
    !type.name.endsWith('_var_samp_fields') && 
    !type.name.endsWith('_variance_fields') &&
    !type.name.endsWith('_mutation_response') &&
    type.name !== 'query_root' && 
    type.name !== 'mutation_root' && 
    type.name !== 'subscription_root'
  );
  
  console.log(`Found ${potentialTableTypes.length} potential table types in schema`);
  
  // Если не нашли потенциальных типов таблиц, добавим явное мапирование для известных типов
  if (potentialTableTypes.length === 0) {
    console.log("No potential table types found, adding hard-coded mappings for common tables");
    
    // Добавляем явное мапирование для известных таблиц
    tableMappings["accounts"] = { schema: "public", table: "accounts" };
    tableMappings["users"] = { schema: "public", table: "users" };
    tableMappings["notifications"] = { schema: "public", table: "notifications" };
    tableMappings["debug"] = { schema: "public", table: "debug" };
    
    // Схема payments
    tableMappings["payments_methods"] = { schema: "payments", table: "methods" };
    tableMappings["payments_operations"] = { schema: "payments", table: "operations" };
    tableMappings["payments_plans"] = { schema: "payments", table: "plans" };
    tableMappings["payments_providers"] = { schema: "payments", table: "providers" };
    tableMappings["payments_subscriptions"] = { schema: "payments", table: "subscriptions" };
    
    // Схема notification
    tableMappings["notification_messages"] = { schema: "notification", table: "messages" };
    tableMappings["notification_permissions"] = { schema: "notification", table: "permissions" };
    
    console.log(`Added ${Object.keys(tableMappings).length} hard-coded table mappings`);
    return tableMappings;
  }
  
  // Шаг 2: анализ типов
  for (const type of potentialTableTypes) {
    let schema = 'public'; // Предполагаем public по умолчанию
    let tableName = type.name;
    
    // Поиск схемы из имени типа (payments_methods -> schema: payments, table: methods)
    const schemaTableMatch = type.name.match(/^([a-z0-9_]+)_([a-z0-9_]+)$/i);
    if (schemaTableMatch) {
      // Проверяем, есть ли другие типы с тем же префиксом - это признак схемы
      const potentialSchema = schemaTableMatch[1];
      const potentialTable = schemaTableMatch[2];
      
      const sameSchemaTypes = potentialTableTypes.filter(t => 
        t.name !== type.name && t.name.startsWith(`${potentialSchema}_`)
      );
      
      if (sameSchemaTypes.length > 0) {
        console.log(`Type ${type.name} appears to belong to schema '${potentialSchema}' based on name pattern and other types with same prefix`);
        schema = potentialSchema;
        tableName = potentialTable;
      }
    }
    
    // Если у типа есть поля, проверим также наличие поля с именем схемы
    if (type.fields) {
      // Проверка по полям, которые могут содержать метаданные о схеме
      const schemaField = type.fields.find((f: any) => 
        f.name === '_hasyx_schema_name' || 
        f.name === 'schema_name' || 
        f.name === 'schema'
      );
      
      if (schemaField && schemaField.defaultValue) {
        const match = schemaField.defaultValue.match(/['"]([a-z0-9_]+)['"]/i);
        if (match) {
          schema = match[1];
          console.log(`Type ${type.name} explicitly specifies schema '${schema}' in field ${schemaField.name}`);
        }
      }
      
      // Проверка по полям, которые могут содержать метаданные о таблице
      const tableField = type.fields.find((f: any) => 
        f.name === '_hasyx_table_name' || 
        f.name === 'table_name' || 
        f.name === 'table'
      );
      
      if (tableField && tableField.defaultValue) {
        const match = tableField.defaultValue.match(/['"]([a-z0-9_]+)['"]/i);
        if (match) {
          tableName = match[1];
          console.log(`Type ${type.name} explicitly specifies table '${tableName}' in field ${tableField.name}`);
        }
      }
    }
    
    // Особое распознавание для сущностей из схемы payments
    if (type.name.startsWith('payments_')) {
      const paymentsTableName = type.name.replace('payments_', '');
      tableMappings[type.name] = {
        schema: 'payments',
        table: paymentsTableName
      };
      console.log(`Recognized payments entity: ${type.name} -> payments.${paymentsTableName}`);
    }
    // Особое распознавание для сущностей из схемы notification
    else if (type.name.startsWith('notification_')) {
      const notificationTableName = type.name.replace('notification_', '');
      tableMappings[type.name] = {
        schema: 'notification',
        table: notificationTableName
      };
      console.log(`Recognized notification entity: ${type.name} -> notification.${notificationTableName}`);
    }
    // Для всех остальных сущностей
    else {
      tableMappings[type.name] = {
        schema,
        table: tableName
      };
      console.log(`Mapped type: ${type.name} -> ${schema}.${tableName}`);
    }
  }
  
  return tableMappings;
}

async function fetchSchema() {
  console.log(`🚀 Requesting introspection schema from ${HASURA_GRAPHQL_URL}...`);
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (HASURA_ADMIN_SECRET) {
      headers['X-Hasura-Admin-Secret'] = HASURA_ADMIN_SECRET;
      console.log('🔑 Using Hasura Admin Secret.');
    } else {
       console.warn('⚠️ HASURA_ADMIN_SECRET not found. Requesting schema without admin rights (may be incomplete).');
    }

    const response = await axios.post(
      HASURA_GRAPHQL_URL!, // Add non-null assertion here
      {
        query: getIntrospectionQuery(), // Use the function to get the query string
      },
      { headers }
    );

    if (response.data.errors) {
       throw new Error(`GraphQL error when requesting schema: ${JSON.stringify(response.data.errors)}`);
    }

    if (!response.data || !response.data.data || !response.data.data.__schema) {
        throw new Error('Invalid response from Hasura server. Missing data.__schema.');
    }

    const introspectionResult = response.data;
    
    // Analyze schema types to identify tables and their schemas
    const schemaTypes = introspectionResult.data.__schema.types;
    const tableMappings = identifyTableSchemas(schemaTypes);
    
    // Add table mappings directly into the schema file
    introspectionResult.hasyx = {
      tableMappings,
      timestamp: new Date().toISOString(),
      version: "1.0.0"
    };

    console.log(`💾 Saving schema with table mappings to ${OUTPUT_PATH}...`);
    fs.ensureDirSync(OUTPUT_DIR);
    // Ensure we're writing proper JSON without any additional unexpected characters
    const jsonContent = JSON.stringify(introspectionResult, null, 2);
    fs.writeFileSync(OUTPUT_PATH, jsonContent);

    console.log(`✅ Schema successfully retrieved and saved to ${OUTPUT_PATH}`);
    console.log(`📊 Table mappings included in schema file (${Object.keys(tableMappings).length} tables identified)`);
  } catch (error: any) {
    console.error('❌ Error retrieving or saving schema:', error.response?.data || error.message || error);
    process.exit(1);
  }
}

fetchSchema(); 