import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs-extra';
import path from 'path';
import { IntrospectionQuery, getIntrospectionQuery } from 'graphql';
import Debug from './debug';

dotenv.config();

const HASURA_GRAPHQL_URL = process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL;
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET;
const PUBLIC_OUTPUT_DIR = path.resolve(process.cwd(), 'public');
const PUBLIC_OUTPUT_PATH = path.join(PUBLIC_OUTPUT_DIR, 'hasura-schema.json');
const APP_OUTPUT_DIR = path.resolve(process.cwd(), 'app', 'hasyx');
const APP_OUTPUT_PATH = path.join(APP_OUTPUT_DIR, 'hasura-schema.json');

const debug = Debug('hasura:schema');

if (!HASURA_GRAPHQL_URL) {
  throw new Error('❌ Error: NEXT_PUBLIC_HASURA_GRAPHQL_URL is not defined in .env');
}

/**
 * Analyzes GraphQL schema types to identify PostgreSQL tables and their schemas
 * @param schemaTypes - Array of GraphQL types from introspection
 * @returns Mapping of GraphQL type names to their PostgreSQL schemas and table names
 */
function identifyTableSchemas(schemaTypes: any[]) {
  const tableMappings: Record<string, { schema: string, table: string }> = {};
  
  
  debug(`Total types in schema: ${schemaTypes.length}`);
  
  
  const allObjectTypes = schemaTypes.filter(type => type.kind === 'OBJECT' && type.name);
  debug(`Object types in schema: ${allObjectTypes.length}`);
  debug(`Object type names: ${allObjectTypes.map(t => t.name).join(', ')}`);
  
  

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

  debug(`Found ${potentialTableTypes.length} potential table types in schema`);
  
  
  if (potentialTableTypes.length === 0) {
    debug("No potential table types found, adding hard-coded mappings for common tables");
    
    
    tableMappings["accounts"] = { schema: "public", table: "accounts" };
    tableMappings["users"] = { schema: "public", table: "users" };
    tableMappings["notifications"] = { schema: "public", table: "notifications" };
    tableMappings["debug"] = { schema: "public", table: "debug" };
    
    
    tableMappings["payments_methods"] = { schema: "payments", table: "methods" };
    tableMappings["payments_operations"] = { schema: "payments", table: "operations" };
    tableMappings["payments_plans"] = { schema: "payments", table: "plans" };
    tableMappings["payments_providers"] = { schema: "payments", table: "providers" };
    tableMappings["payments_subscriptions"] = { schema: "payments", table: "subscriptions" };
    
    
    tableMappings["notification_messages"] = { schema: "notification", table: "messages" };
    tableMappings["notification_permissions"] = { schema: "notification", table: "permissions" };

    debug(`Added ${Object.keys(tableMappings).length} hard-coded table mappings`);
    return tableMappings;
  }
  
  
  for (const type of potentialTableTypes) {
    let schema = 'public';
    let tableName = type.name;
    
    
    const schemaTableMatch = type.name.match(/^([a-z0-9_]+)_([a-z0-9_]+)$/i);
    if (schemaTableMatch) {
      
      const potentialSchema = schemaTableMatch[1];
      const potentialTable = schemaTableMatch[2];

      const sameSchemaTypes = potentialTableTypes.filter(t =>
        t.name !== type.name && t.name.startsWith(`${potentialSchema}_`)
      );

      if (sameSchemaTypes.length > 0) {
        debug(`Type ${type.name} appears to belong to schema '${potentialSchema}' based on name pattern and other types with same prefix`);
        schema = potentialSchema;
        tableName = potentialTable;
      }
    }
    
    
    if (type.fields) {
      
      const schemaField = type.fields.find((f: any) =>
        f.name === '_hasyx_schema_name' ||
        f.name === 'schema_name' ||
        f.name === 'schema'
      );

      if (schemaField && schemaField.defaultValue) {
        const match = schemaField.defaultValue.match(/['"]([a-z0-9_]+)['"]/i);
        if (match) {
          schema = match[1];
          debug(`Type ${type.name} explicitly specifies schema '${schema}' in field ${schemaField.name}`);
        }
      }
      
      
      const tableField = type.fields.find((f: any) =>
        f.name === '_hasyx_table_name' ||
        f.name === 'table_name' ||
        f.name === 'table'
      );

      if (tableField && tableField.defaultValue) {
        const match = tableField.defaultValue.match(/['"]([a-z0-9_]+)['"]/i);
        if (match) {
          tableName = match[1];
          debug(`Type ${type.name} explicitly specifies table '${tableName}' in field ${tableField.name}`);
        }
      }
    }
    
    
    if (type.name.startsWith('payments_')) {
      const paymentsTableName = type.name.replace('payments_', '');
      tableMappings[type.name] = {
        schema: 'payments',
        table: paymentsTableName
      };
      debug(`Recognized payments entity: ${type.name} -> payments.${paymentsTableName}`);
    }

    else if (type.name.startsWith('notification_')) {
      const notificationTableName = type.name.replace('notification_', '');
      tableMappings[type.name] = {
        schema: 'notification',
        table: notificationTableName
      };
      debug(`Recognized notification entity: ${type.name} -> notification.${notificationTableName}`);
    }

    else {
      tableMappings[type.name] = {
        schema,
        table: tableName
      };
      debug(`Mapped type: ${type.name} -> ${schema}.${tableName}`);
    }
  }

  return tableMappings;
}

async function fetchSchema() {
  debug(`🚀 Requesting introspection schema from ${HASURA_GRAPHQL_URL}...`);
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (HASURA_ADMIN_SECRET) {
      headers['X-Hasura-Admin-Secret'] = HASURA_ADMIN_SECRET;
      debug('🔑 Using Hasura Admin Secret.');
    } else {
      debug('⚠️ HASURA_ADMIN_SECRET not found. Requesting schema without admin rights (may be incomplete).');
    }

    const response = await axios.post(
      HASURA_GRAPHQL_URL!,
      {
        query: getIntrospectionQuery(),
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
    
    // Analyze the schema and identify table mappings
    const schemaTypes = introspectionResult.data.__schema.types;
    const tableMappings = identifyTableSchemas(schemaTypes);
    
    // Add hasyx metadata to the schema
    introspectionResult.hasyx = {
      tableMappings,
      timestamp: new Date().valueOf(),
      version: "1.0.0"
    };

    const jsonContent = JSON.stringify(introspectionResult, null, 2);

    // Ensure directories exist
    fs.ensureDirSync(PUBLIC_OUTPUT_DIR);
    fs.ensureDirSync(APP_OUTPUT_DIR);

    // Save schema to public directory (for HTTP access)
    debug(`💾 Saving schema to public directory: ${PUBLIC_OUTPUT_PATH}...`);
    fs.writeFileSync(PUBLIC_OUTPUT_PATH, jsonContent);

    // Save schema to app/hasyx directory (for native import)
    debug(`💾 Saving schema to app directory: ${APP_OUTPUT_PATH}...`);
    fs.writeFileSync(APP_OUTPUT_PATH, jsonContent);

    debug(`✅ Schema successfully retrieved and saved to both directories`);
    debug(`📊 Table mappings included in schema file (${Object.keys(tableMappings).length} tables identified)`);
    console.log(`✅ Hasura schema saved to:`);
    console.log(`   📄 ${PUBLIC_OUTPUT_PATH} (for HTTP access)`);
    console.log(`   📄 ${APP_OUTPUT_PATH} (for native import)`);
  } catch (error: any) {
    throw new Error('❌ Error retrieving or saving schema:' + (error.response?.data || error.message || error));
  }
}

export { fetchSchema as generateHasuraSchema };

// Run schema generation if this file is executed directly
if (require.main === module) {
  fetchSchema();
} 