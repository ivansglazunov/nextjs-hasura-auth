import fs from 'fs-extra';
import path from 'path';
import spawn from 'cross-spawn';
import { Hasura } from './hasura';
import Debug from './debug';

const debug = Debug('migration:down-hasyx');

interface HasuraTable {
  table: {
    schema: string;
    name: string;
  };
  primary_key?: {
    columns: string[];
  } | null;
}


function getProperSchemaAndTable(graphQLTypeName: string, tableMappings: Record<string, { schema: string, table: string }> | undefined): { schema: string, table: string } {
  if (tableMappings && tableMappings[graphQLTypeName]) {
    return {
      schema: tableMappings[graphQLTypeName].schema,
      table: tableMappings[graphQLTypeName].table
    };
  }

  return {
    schema: 'public',
    table: graphQLTypeName
  };
}


function getTablesFromGraphQLSchema(schemaTypes: any[], tableMappings?: Record<string, { schema: string, table: string }>): HasuraTable[] {
  const tables: HasuraTable[] = [];
  if (!Array.isArray(schemaTypes)) {
    debug('Schema types is not an array, cannot extract tables.');
    return tables;
  }

  for (const type of schemaTypes) {
    if (type.kind === 'OBJECT' && type.name && !type.name.startsWith('__') && type.fields) {
      if (type.name.endsWith('_aggregate') ||
        type.name.endsWith('_avg_fields') ||
        type.name.endsWith('_max_fields') ||
        type.name.endsWith('_min_fields') ||
        type.name.endsWith('_stddev_fields') ||
        type.name.endsWith('_stddev_pop_fields') ||
        type.name.endsWith('_stddev_samp_fields') ||
        type.name.endsWith('_sum_fields') ||
        type.name.endsWith('_var_pop_fields') ||
        type.name.endsWith('_var_samp_fields') ||
        type.name.endsWith('_variance_fields') ||
        type.name === 'query_root' ||
        type.name === 'mutation_root' ||
        type.name === 'subscription_root') {
        continue;
      }


      const { schema, table } = getProperSchemaAndTable(type.name, tableMappings);

      tables.push({
        table: {
          schema,
          name: table
        }

      });
    }
  }
  debug(`Extracted ${tables.length} potential tables from GraphQL schema types for cleanup.`);
  return tables;
}

export async function down(): Promise<boolean> {
  const projectRoot = process.cwd();
  debug('🚀 Starting Hasyx View migration DOWN...');

  if (!process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL || !process.env.HASURA_ADMIN_SECRET) {
    console.error('❌ Hasura URL or Admin Secret not found in environment variables.');
    debug('Missing Hasura credentials in .env');
    return false;
  }

  const hasura = new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
    secret: process.env.HASURA_ADMIN_SECRET!,
  });

  try {



    const schemaPath = path.join(projectRoot, 'public', 'hasura-schema.json');
    let tablesToClean: HasuraTable[] = [];
    let tableMappings: Record<string, { schema: string, table: string }> | undefined;

    if (!fs.existsSync(schemaPath)) {
      console.warn(`⚠️ Hasura schema file not found at ${schemaPath}. Skipping schema-dependent cleanup steps.`);
    } else {
      try {
        const rawSchemaFileContent = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));


        if (rawSchemaFileContent && rawSchemaFileContent.hasyx && rawSchemaFileContent.hasyx.tableMappings) {
          tableMappings = rawSchemaFileContent.hasyx.tableMappings;
          debug(`Found ${Object.keys(tableMappings || {}).length} table mappings in hasura-schema.json`);
          console.log(`Found ${Object.keys(tableMappings || {}).length} table mappings in schema file`);


          if (tableMappings) {
            tablesToClean = Object.entries(tableMappings).map(([typeName, mapping]) => {
              return {
                table: {
                  schema: mapping.schema,
                  name: mapping.table
                }
              };
            });

            console.log(`Created ${tablesToClean.length} table definitions from mappings for cleanup`);
          }
        } else {
          console.warn('⚠️ Table mappings not found in hasura-schema.json. Will use basic heuristics for schema detection.');
          debug('No tableMappings found in schema file');

          if (rawSchemaFileContent && rawSchemaFileContent.data && rawSchemaFileContent.data.__schema && rawSchemaFileContent.data.__schema.types) {
            tablesToClean = getTablesFromGraphQLSchema(rawSchemaFileContent.data.__schema.types, tableMappings);
            if (tablesToClean.length === 0) {
              console.warn(`⚠️ Parsed GraphQL schema but found no suitable table objects to clean up. Check filter logic.`);
            }
          } else {
            console.warn(`⚠️ Hasura schema file at ${schemaPath} does not have the expected structure. Skipping schema-dependent cleanup.`);
            debug('Unexpected schema file content for down script:', rawSchemaFileContent);
          }
        }
      } catch (parseError: any) {
        console.error(`❌ Error parsing ${schemaPath}: ${parseError.message}. Skipping schema-dependent cleanup.`);
        debug('JSON parse error for schema file (down script): ', parseError);
      }
    }

    for (const tableDef of tablesToClean) {
      const schemaName = tableDef.table.schema;
      const tableName = tableDef.table.name;

      if (tableName === 'hasyx' && schemaName === 'public') continue;

      const relToHasyxName = 'hasyx';
      debug(`Dropping relationship ${relToHasyxName} from ${schemaName}.${tableName}`);
      try {
        await hasura.v1({
          type: 'pg_drop_relationship',
          args: {
            source: 'default',
            table: { schema: schemaName, name: tableName },
            relationship: relToHasyxName,
          },
        });
      } catch (e: any) {
        debug(`Failed to drop relationship ${relToHasyxName} from ${schemaName}.${tableName} (may not exist):`, e.message);
      }

      const dropColsSql = `
        ALTER TABLE IF EXISTS "${schemaName}"."${tableName}"
        DROP COLUMN IF EXISTS "_hasyx_schema_name",
        DROP COLUMN IF EXISTS "_hasyx_table_name";`;
      debug('Dropping generated columns from ' + schemaName + '.' + tableName + ':\n' + dropColsSql);
      await hasura.sql(dropColsSql);


      const relFromHasyxName = `${schemaName}_${tableName}`;
      debug(`Dropping relationship ${relFromHasyxName} from public.hasyx to ${schemaName}.${tableName}`);
      try {
        await hasura.v1({
          type: 'pg_drop_relationship',
          args: {
            source: 'default',
            table: { schema: 'public', name: 'hasyx' },
            relationship: relFromHasyxName,
          },
        });
      } catch (e: any) {
        debug(`Failed to drop relationship ${relFromHasyxName} from public.hasyx (may not exist):`, e.message);
      }
    }

    debug('Untracking view public.hasyx...');
    try {
      await hasura.v1({
        type: 'pg_untrack_table',
        args: {
          source: 'default',
          table: { schema: 'public', name: 'hasyx' },
          cascade: true,
        },
      });
    } catch (e: any) {
      debug('Failed to untrack public.hasyx (may not exist or already untracked):', e.message);
    }

    const dropViewSql = 'DROP VIEW IF EXISTS "public"."hasyx";';
    debug('Dropping view public.hasyx...\n' + dropViewSql);
    await hasura.sql(dropViewSql);




    debug('✨ Hasyx View migration DOWN completed successfully!');
    return true;
  } catch (error: any) {
    console.error('❗ Critical error during Hasyx View DOWN migration:', error.message);
    debug('❌ Hasyx View DOWN Migration failed:', error);
    return false;
  }
} 