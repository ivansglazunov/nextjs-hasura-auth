import * as fs from 'fs-extra';
import * as path from 'path';
import { Hasura } from './hasura';
import Debug from './debug';

const debug = Debug('logs-diffs');

export interface DiffConfig {
  schema?: string;
  table: string;
  column: string;
}

export interface LogsDiffsConfig {
  diffs: DiffConfig[];
}

export async function applyLogsDiffs(hasura: Hasura, config: LogsDiffsConfig) {
  debug('🔧 Applying logs-diffs configuration...');
  
  // Remove all existing hasyx diffs triggers
  await removeAllDiffsTriggers(hasura);
  
  // Create new triggers for specified tables/columns
  for (const diffConfig of config.diffs) {
    await createDiffsTrigger(hasura, diffConfig);
  }
  
  debug('✅ Logs-diffs configuration applied successfully.');
}

async function removeAllDiffsTriggers(hasura: Hasura) {
  debug('🧹 Removing all existing hasyx diffs triggers...');
  
  // Get all schemas to check for triggers
  const schemas = await hasura.schemas();
  
  for (const schema of schemas) {
    if (schema === 'information_schema' || schema === 'pg_catalog') continue;
    
    try {
      const tables = await hasura.tables({ schema });
      
      for (const table of tables) {
        const triggerName = `hasyx_diffs_${schema}_${table}`;
        await hasura.sql(`DROP TRIGGER IF EXISTS ${triggerName} ON ${schema}.${table};`);
        debug(`Removed trigger ${triggerName} if existed`);
      }
    } catch (error) {
      debug(`Error checking schema ${schema}: ${error}`);
    }
  }
  
  // Drop the trigger function
  await hasura.sql(`DROP FUNCTION IF EXISTS hasyx_record_diff();`);
  
  debug('✅ All existing diffs triggers removed.');
}

async function createDiffsTrigger(hasura: Hasura, config: DiffConfig) {
  const schema = config.schema || 'public';
  const { table, column } = config;
  
  debug(`Creating diffs trigger for ${schema}.${table}.${column}`);
  
  // Create the trigger function if it doesn't exist
  await hasura.sql(`
    CREATE OR REPLACE FUNCTION hasyx_record_diff()
    RETURNS TRIGGER AS $$
    DECLARE
      user_id_val UUID;
      record_id TEXT;
    BEGIN
      -- Get user_id from Hasura session variable
      user_id_val := NULLIF(current_setting('hasura.user.id', true), '')::UUID;
      
      -- Get record ID (try common ID column names)
      IF TG_TABLE_SCHEMA = 'public' AND TG_TABLE_NAME = 'users' THEN
        record_id := NEW.id::TEXT;
      ELSIF TG_TABLE_SCHEMA = 'logs' THEN
        record_id := NEW.id::TEXT;
      ELSE
        -- Fallback: try to find an id column
        BEGIN
          record_id := (row_to_json(NEW)->'id')::TEXT;
          IF record_id IS NULL THEN
            record_id := (row_to_json(NEW)->'uuid')::TEXT;
          END IF;
        EXCEPTION WHEN OTHERS THEN
          record_id := 'unknown';
        END;
      END IF;
      
      -- Record the diff
      INSERT INTO logs.diffs (_schema, _table, _column, _id, user_id, _value)
      VALUES (
        TG_TABLE_SCHEMA,
        TG_TABLE_NAME,
        TG_ARGV[0], -- column name passed as argument
        record_id,
        user_id_val,
        (row_to_json(NEW)->>TG_ARGV[0])::TEXT
      );
      
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
  
  // Create trigger for the specific table/column
  const triggerName = `hasyx_diffs_${schema}_${table}_${column}`;
  await hasura.sql(`
    DROP TRIGGER IF EXISTS ${triggerName} ON ${schema}.${table};
    CREATE TRIGGER ${triggerName}
      AFTER INSERT OR UPDATE OF ${column} ON ${schema}.${table}
      FOR EACH ROW
      EXECUTE FUNCTION hasyx_record_diff('${column}');
  `);
  
  debug(`✅ Created diffs trigger: ${triggerName}`);
}

export async function loadConfigFromFile(): Promise<LogsDiffsConfig | null> {
  const configPath = path.join(process.cwd(), 'hasyx.config.json');
  
  if (!(await fs.pathExists(configPath))) {
    debug('No hasyx.config.json found');
    return null;
  }
  
  try {
    const config = await fs.readJSON(configPath);
    return config['logs-diffs'] || null;
  } catch (error) {
    debug(`Error reading hasyx.config.json: ${error}`);
    return null;
  }
}

export async function processConfiguredDiffs(hasura?: Hasura) {
  debug('🔄 Processing configured diffs from hasyx.config.json...');
  
  const config = await loadConfigFromFile();
  if (!config) {
    console.log('⚠️ No logs-diffs configuration found in hasyx.config.json');
    return;
  }
  
  const hasu = hasura || new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!, 
    secret: process.env.HASURA_ADMIN_SECRET!,
  });
  
  await applyLogsDiffs(hasu, config);
  console.log('✅ Logs-diffs configuration applied successfully');
} 