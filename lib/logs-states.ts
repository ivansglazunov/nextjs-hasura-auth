import fs from 'fs-extra';
import path from 'path';
import { Hasura } from './hasura';
import Debug from './debug';

const debug = Debug('logs-states');

export interface StateConfig {
  schema?: string;
  table: string;
  columns: string[];
}

export interface LogsStatesConfig {
  states: StateConfig[];
}

export async function applyLogsStates(hasura: Hasura, config: LogsStatesConfig) {
  debug('🔧 Applying logs-states configuration...');
  
  // Remove all existing hasyx states triggers
  await removeAllStatesTriggers(hasura);
  
  // Create new triggers for specified tables/columns
  for (const stateConfig of config.states) {
    await createStatesTrigger(hasura, stateConfig);
  }
  
  debug('✅ Logs-states configuration applied successfully.');
}

async function removeAllStatesTriggers(hasura: Hasura) {
  debug('🧹 Removing all existing hasyx states triggers...');
  
  // Get all schemas to check for triggers
  const schemas = await hasura.schemas();
  
  for (const schema of schemas) {
    if (schema === 'information_schema' || schema === 'pg_catalog') continue;
    
    try {
      const tables = await hasura.tables({ schema });
      
      for (const table of tables) {
        const triggerName = `hasyx_states_${schema}_${table}`;
        await hasura.sql(`DROP TRIGGER IF EXISTS ${triggerName} ON ${schema}.${table};`);
        debug(`Removed trigger ${triggerName} if existed`);
      }
    } catch (error) {
      debug(`Error checking schema ${schema}: ${error}`);
    }
  }
  
  // Drop the trigger functions
  await hasura.sql(`DROP FUNCTION IF EXISTS hasyx_record_state_insert_update();`);
  await hasura.sql(`DROP FUNCTION IF EXISTS hasyx_record_state_delete();`);
  
  debug('✅ All existing states triggers removed.');
}

async function createStatesTrigger(hasura: Hasura, config: StateConfig) {
  const schema = config.schema || 'public';
  const { table, columns } = config;
  
  debug(`Creating states trigger for ${schema}.${table} with columns: ${columns.join(', ')}`);
  
  // Create the trigger functions if they don't exist
  await hasura.sql(`
    CREATE OR REPLACE FUNCTION hasyx_record_state_insert_update()
    RETURNS TRIGGER AS $$
    DECLARE
      user_id_val UUID;
      record_id TEXT;
      state_data JSONB;
      col_name TEXT;
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
      
      -- Process each column specified in trigger arguments
      FOR i IN 0..TG_NARGS-1 LOOP
        col_name := TG_ARGV[i];
        state_data := jsonb_build_object(col_name, row_to_json(NEW)->>col_name);
        
        -- Record the state for each column
        INSERT INTO logs.states (_schema, _table, _column, _id, user_id, state)
        VALUES (
          TG_TABLE_SCHEMA,
          TG_TABLE_NAME,
          col_name,
          record_id,
          user_id_val,
          state_data
        );
      END LOOP;
      
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
  
  await hasura.sql(`
    CREATE OR REPLACE FUNCTION hasyx_record_state_delete()
    RETURNS TRIGGER AS $$
    DECLARE
      user_id_val UUID;
      record_id TEXT;
      col_name TEXT;
    BEGIN
      -- Get user_id from Hasura session variable
      user_id_val := NULLIF(current_setting('hasura.user.id', true), '')::UUID;
      
      -- Get record ID (try common ID column names)
      IF TG_TABLE_SCHEMA = 'public' AND TG_TABLE_NAME = 'users' THEN
        record_id := OLD.id::TEXT;
      ELSIF TG_TABLE_SCHEMA = 'logs' THEN
        record_id := OLD.id::TEXT;
      ELSE
        -- Fallback: try to find an id column
        BEGIN
          record_id := (row_to_json(OLD)->'id')::TEXT;
          IF record_id IS NULL THEN
            record_id := (row_to_json(OLD)->'uuid')::TEXT;
          END IF;
        EXCEPTION WHEN OTHERS THEN
          record_id := 'unknown';
        END;
      END IF;
      
      -- Process each column specified in trigger arguments
      FOR i IN 0..TG_NARGS-1 LOOP
        col_name := TG_ARGV[i];
        
        -- Record null state for delete
        INSERT INTO logs.states (_schema, _table, _column, _id, user_id, state)
        VALUES (
          TG_TABLE_SCHEMA,
          TG_TABLE_NAME,
          col_name,
          record_id,
          user_id_val,
          NULL
        );
      END LOOP;
      
      RETURN OLD;
    END;
    $$ LANGUAGE plpgsql;
  `);
  
  // Create triggers for insert/update and delete
  const columnsArg = columns.map(col => `'${col}'`).join(', ');
  
  const insertUpdateTriggerName = `hasyx_states_${schema}_${table}_iu`;
  await hasura.sql(`
    DROP TRIGGER IF EXISTS ${insertUpdateTriggerName} ON ${schema}.${table};
    CREATE TRIGGER ${insertUpdateTriggerName}
      AFTER INSERT OR UPDATE ON ${schema}.${table}
      FOR EACH ROW
      EXECUTE FUNCTION hasyx_record_state_insert_update(${columnsArg});
  `);
  
  const deleteTriggerName = `hasyx_states_${schema}_${table}_d`;
  await hasura.sql(`
    DROP TRIGGER IF EXISTS ${deleteTriggerName} ON ${schema}.${table};
    CREATE TRIGGER ${deleteTriggerName}
      AFTER DELETE ON ${schema}.${table}
      FOR EACH ROW
      EXECUTE FUNCTION hasyx_record_state_delete(${columnsArg});
  `);
  
  debug(`✅ Created states triggers: ${insertUpdateTriggerName}, ${deleteTriggerName}`);
}

export async function loadConfigFromFile(): Promise<LogsStatesConfig | null> {
  const configPath = path.join(process.cwd(), 'hasyx.config.json');
  
  if (!(await fs.pathExists(configPath))) {
    debug('No hasyx.config.json found');
    return null;
  }
  
  try {
    const config = await fs.readJson(configPath);
    return config['logs-states'] || null;
  } catch (error) {
    debug(`Error reading hasyx.config.json: ${error}`);
    return null;
  }
}

export async function processConfiguredStates(hasura?: Hasura) {
  debug('🔄 Processing configured states from hasyx.config.json...');
  
  const config = await loadConfigFromFile();
  if (!config) {
    console.log('⚠️ No logs-states configuration found in hasyx.config.json');
    return;
  }
  
  const hasu = hasura || new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!, 
    secret: process.env.HASURA_ADMIN_SECRET!,
  });
  
  await applyLogsStates(hasu, config);
  console.log('✅ Logs-states configuration applied successfully');
} 