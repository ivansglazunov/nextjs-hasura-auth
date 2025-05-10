import fs from 'fs-extra';
import path from 'path';
import spawn from 'cross-spawn';
import { Hasura } from './hasura'; // Assuming Hasura class is in ./hasura.ts
import Debug from './debug';
import { DEFAULT_NAMESPACE } from './hid'; // Import DEFAULT_NAMESPACE

const debug = Debug('migration:up-hasyx');

async function runHasyxSchemaCommand(projectRoot: string): Promise<void> {
  debug('Running "npx hasyx schema"...');
  const result = spawn.sync('npx', ['hasyx', 'schema'], {
    stdio: 'inherit',
    cwd: projectRoot,
  });
  if (result.error) {
    debug('Failed to run "npx hasyx schema":', result.error);
    throw new Error(`Failed to run "npx hasyx schema": ${result.error.message}`);
  }
  if (result.status !== 0) {
    debug('"npx hasyx schema" command failed with status:', result.status);
    throw new Error(`"npx hasyx schema" command failed with status ${result.status}`);
  }
  debug('"npx hasyx schema" command completed successfully.');
}

function getCurrentProjectName(projectRoot: string): string {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  let projectName = path.basename(projectRoot); // Fallback
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      if (pkg.name) {
        projectName = pkg.name;
      }
    } catch (e: any) {
      debug('Could not read project name from package.json:', e.message);
    }
  }
  return projectName.replace(/[^a-zA-Z0-9-]/g, '_'); // Sanitize for use in names
}

interface HasuraTableColumn {
  name: string;
  type: string; // e.g. "uuid", "text", "integer", "bigint"
  // Add other properties if needed, like "is_nullable"
}

interface HasuraTable {
  table: {
    schema: string;
    name: string;
  };
  columns?: HasuraTableColumn[]; // Make columns optional as schema might not always have it
  primary_key?: {
    columns: string[];
  } | null;
  // Add other properties like relationships if needed for schema parsing
}

// Helper to extract relevant table information from GraphQL schema types
function getTablesFromGraphQLSchema(schemaTypes: any[]): HasuraTable[] {
  const tables: HasuraTable[] = [];
  if (!Array.isArray(schemaTypes)) {
    debug('Schema types is not an array, cannot extract tables.');
    return tables;
  }

  for (const type of schemaTypes) {
    // Basic filter: OBJECT kind, not starting with __ (GraphQL internal), and has fields
    if (type.kind === 'OBJECT' && type.name && !type.name.startsWith('__') && type.fields) {
      // Further checks to differentiate tables from other object types (like query_root, etc.)
      // Aggregation types often end with _aggregate, _avg_fields etc.
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

      // Attempt to find a primary key (assuming 'id' or 'uuid') - THIS IS A HUGE ASSUMPTION
      let pkColumnName: string | undefined = undefined;
      const idField = type.fields.find((f: any) => f.name === 'id');
      if (idField) pkColumnName = 'id';
      else {
        const uuidField = type.fields.find((f: any) => f.name === 'uuid');
        if (uuidField) pkColumnName = 'uuid';
      }
      
      // If no assumed PK, we might not be able to use this table for the view in current logic
      // However, the UP script's loop later checks for pkColumns from a potentially different source or makes its own decisions
      // For now, we just gather table name and assume schema is public.
      // The main loop in up() must have a more reliable way to get PK for each table.

      tables.push({
        table: {
          // ASSUMPTION: schema is public. This needs to be more robust.
          schema: 'public', 
          name: type.name
        },
        // The `columns` and `primary_key` here are for the HasuraTable interface structure.
        // The actual primary_key for SQL generation in the main `up` function MUST come from a more reliable source.
        // This `primary_key` field based on assumption might not be accurate for all tables.
        primary_key: pkColumnName ? { columns: [pkColumnName] } : null 
      });
    }
  }
  debug(`Extracted ${tables.length} potential tables from GraphQL schema types.`);
  return tables;
}

export async function up(): Promise<boolean> {
  const projectRoot = process.cwd();
  debug('🚀 Starting Hasyx View migration UP...');

  if (!process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL || !process.env.HASURA_ADMIN_SECRET) {
    console.error('❌ Hasura URL or Admin Secret not found in environment variables.');
    debug('Missing Hasura credentials in .env');
    return false;
  }

  const hasura = new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
    secret: process.env.HASURA_ADMIN_SECRET!,
  });

  const currentProjectName = getCurrentProjectName(projectRoot);
  const hidNamespace = DEFAULT_NAMESPACE;

  try {
    await runHasyxSchemaCommand(projectRoot);

    const schemaPath = path.join(projectRoot, 'public', 'hasura-schema.json');
    let tablesToProcess: HasuraTable[] = [];

    if (!fs.existsSync(schemaPath)) {
      console.error(`❌ Hasura schema file not found at ${schemaPath}. Make sure 'npx hasyx schema' ran successfully. Cannot proceed.`);
      return false;
    } else {
      try {
        const rawSchemaFileContent = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
        // Adjust parsing based on actual schema structure (GraphQL introspection result)
        if (rawSchemaFileContent && rawSchemaFileContent.data && rawSchemaFileContent.data.__schema && rawSchemaFileContent.data.__schema.types) {
          // Pass the array of types to the helper function
          tablesToProcess = getTablesFromGraphQLSchema(rawSchemaFileContent.data.__schema.types);
          if (tablesToProcess.length === 0) {
             console.warn(`⚠️ Parsed GraphQL schema but found no suitable table objects in data.__schema.types. Check filter logic in getTablesFromGraphQLSchema.`);
          }
        } else {
          console.error(`❌ Hasura schema file at ${schemaPath} does not have the expected structure (data.__schema.types). Cannot proceed.`);
          debug('Unexpected schema file content:', rawSchemaFileContent);
          return false;
        }
      } catch (parseError: any) {
        console.error(`❌ Error parsing ${schemaPath}: ${parseError.message}. Cannot proceed.`);
        debug('JSON parse error for schema file:', parseError);
        return false;
      }
    }
    
    if (tablesToProcess.length === 0) {
      console.warn('⚠️ No tables found in schema to process for Hasyx view. Migration will complete, but view might be empty or not created/updated optimally.');
      // Continue to allow schema command to run at the end, but view-related operations will be skipped if no tables.
    }

    let viewSqlUnionParts: string[] = [];

    // CRITICAL CHANGE: The loop below needs reliable schema_name and pkColumn.
    // The tablesToProcess now provides table.name and an *assumed* pk (if 'id' or 'uuid').
    // It still assumes schema = 'public'. This part is fragile.
    for (const tableDef of tablesToProcess) {
      const schemaName = tableDef.table.schema; // Still an ASSUMPTION (public)
      const tableName = tableDef.table.name;

      // We MUST have a reliable way to get the Primary Key for tableDef
      // The pkColumn from getTablesFromGraphQLSchema is a GUESS.
      // If your `npx hasyx schema` could output a simpler list of tables with their actual schemas and PKs, that would be far better.
      // For now, we proceed with the potentially guessed PK from tablesToProcess.
      const pkColumns = tableDef.primary_key?.columns;
      if (!pkColumns || pkColumns.length === 0) {
        debug(`⚠️ Table ${schemaName}.${tableName} has no determinable primary key (based on 'id' or 'uuid' assumption). Skipping for HID view.`);
        continue;
      }
      const pkColumn = pkColumns[0];

      if (['pg_catalog', 'information_schema', 'hdb_catalog', 'graphql_public'].includes(schemaName)) {
        // This check might be redundant if getTablesFromGraphQLSchema already filters these out by name pattern
        debug(`Skipping system or internal table: ${schemaName}.${tableName}`);
        continue;
      }
      if (tableName === 'hasyx' && schemaName === 'public') {
        debug('Skipping self-reference to public.hasyx view');
        continue;
      }

      const addColsSql = `
        ALTER TABLE "${schemaName}"."${tableName}"
        ADD COLUMN IF NOT EXISTS "_hasyx_schema_name" TEXT GENERATED ALWAYS AS ('${schemaName}') STORED,
        ADD COLUMN IF NOT EXISTS "_hasyx_table_name" TEXT GENERATED ALWAYS AS ('${tableName}') STORED;`;
      debug('Adding generated columns to ' + schemaName + '.' + tableName + ':\n' + addColsSql);
      await hasura.sql(addColsSql);

      viewSqlUnionParts.push(
        `SELECT
          '${hidNamespace}' || '/' || '${currentProjectName}' || '/' || '${schemaName}' || '/' || '${tableName}' || '/' || "${pkColumn}"::text AS hid,
          '${hidNamespace}' AS namespace,
          '${currentProjectName}' AS project,
          '${schemaName}' AS schema,
          '${tableName}' AS table,
          "${pkColumn}"::text AS id
        FROM "${schemaName}"."${tableName}"`
      );
    }

    if (viewSqlUnionParts.length > 0) {
      const createViewSql = `CREATE OR REPLACE VIEW "public"."hasyx" AS\n${viewSqlUnionParts.join('\nUNION ALL\n')};`;
      debug('Creating/Replacing view public.hasyx:\n' + createViewSql);
      await hasura.sql(createViewSql);

      debug('Tracking view public.hasyx...');
      await hasura.v1({
        type: 'pg_track_table',
        args: { source: 'default', schema: 'public', name: 'hasyx' },
      });
    } else {
      console.warn("⚠️ No suitable tables (with assumed PKs) found to include in the hasyx view. View will not be created/updated.");
      const dropViewSql = 'DROP VIEW IF EXISTS "public"."hasyx";';
      debug('No tables for hasyx view, ensuring it is dropped if it exists:\n' + dropViewSql);
      await hasura.sql(dropViewSql);
      try {
        await hasura.v1({ type: 'pg_untrack_table', args: { source: 'default', table: { schema: 'public', name: 'hasyx' } } });
      } catch (e) { /* ignore if not tracked */ }
    }
    
    if (tablesToProcess.length > 0) {
        for (const tableDef of tablesToProcess) {
            const schemaName = tableDef.table.schema; // Assumed public
            const tableName = tableDef.table.name;

            const pkColumns = tableDef.primary_key?.columns; // Assumed 'id' or 'uuid'
            if (!pkColumns || pkColumns.length === 0) continue;
            const pkColumn = pkColumns[0];
            
            if (tableName === 'hasyx' && schemaName === 'public') continue; // Already handled
            if (['pg_catalog', 'information_schema', 'hdb_catalog', 'graphql_public'].includes(schemaName)) continue;

            const relToHasyxName = 'hasyx';
            debug(`Creating relationship ${relToHasyxName} from ${schemaName}.${tableName} to public.hasyx`);
            await hasura.v1({
                type: 'pg_create_object_relationship',
                args: {
                source: 'default',
                table: { schema: schemaName, name: tableName },
                name: relToHasyxName,
                using: {
                    manual_configuration: {
                    remote_table: { schema: 'public', name: 'hasyx' },
                    column_mapping: {
                        [pkColumn]: 'id',
                        '_hasyx_schema_name': 'schema',
                        '_hasyx_table_name': 'table',
                    },
                    },
                },
                },
            });

            if (viewSqlUnionParts.length > 0) { // Only create reverse relationships if view has content
                const relFromHasyxName = `${schemaName}_${tableName}`;
                debug(`Creating relationship ${relFromHasyxName} from public.hasyx to ${schemaName}.${tableName}`);
                await hasura.v1({
                    type: 'pg_create_object_relationship',
                    args: {
                        source: 'default',
                        table: { schema: 'public', name: 'hasyx' },
                        name: relFromHasyxName,
                        using: {
                        manual_configuration: {
                            remote_table: { schema: schemaName, name: tableName },
                            column_mapping: {
                            id: pkColumn,
                            },
                        },
                        },
                        comment: `Points to ${schemaName}.${tableName} if this HID entry corresponds to it.`
                    },
                });
            }
        }
    }

    await runHasyxSchemaCommand(projectRoot);

    debug('✨ Hasyx View migration UP completed successfully!');
    return true;
  } catch (error: any) {
    console.error('❗ Critical error during Hasyx View UP migration:', error.message);
    debug('❌ Hasyx View UP Migration failed:', error);
    return false;
  }
} 