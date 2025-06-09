import fs from 'fs-extra';
import path from 'path';
import DiffMatchPatch from 'diff-match-patch';
import { Hasura } from './hasura';
import Debug from './debug';
import type { HasuraEventPayload } from './events';

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
    const config = await fs.readJson(configPath);
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

/**
 * Handles Hasura event trigger payload to create diffs
 * This function processes the raw value stored in logs.diffs table and creates
 * diff patches using diff-match-patch library
 */
export async function handleLogsDiffsEventTrigger(payload: HasuraEventPayload) {
  debug('Processing logs-diffs event trigger payload');
  
  const { event, table } = payload;
  const { op, data } = event;
  
  // Only process INSERT operations on logs.diffs table
  if (op !== 'INSERT' || table.schema !== 'logs' || table.name !== 'diffs') {
    debug('Ignoring event - not an INSERT to logs.diffs table');
    return { success: false, message: 'Not a logs.diffs INSERT event' };
  }
  
  const diffRecord = data.new;
  if (!diffRecord || !diffRecord.id || !diffRecord._value) {
    debug('Skipping diff processing - no value to process');
    return { success: false, message: 'No value to process' };
  }
  
  const hasura = new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
    secret: process.env.HASURA_ADMIN_SECRET!,
  });
  
  try {
    // Get previous values for this record to create diff
    const previousDiffsResult = await hasura.sql(`
      SELECT _value FROM logs.diffs 
      WHERE _schema = '${diffRecord._schema}' 
      AND _table = '${diffRecord._table}' 
      AND _column = '${diffRecord._column}' 
      AND _id = '${diffRecord._id}'
      AND id != '${diffRecord.id}'
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    let previousValue = '';
    if (previousDiffsResult.result && previousDiffsResult.result.length > 1) {
      previousValue = previousDiffsResult.result[1][0] || '';
    }
    
    const currentValue = diffRecord._value || '';
    
    // Create diff using diff-match-patch
    const dmp = new DiffMatchPatch();
    const diffs = dmp.diff_main(previousValue, currentValue);
    dmp.diff_cleanupSemantic(diffs);
    
    // Convert diffs to patches for storage
    const patches = dmp.patch_make(previousValue, currentValue, diffs);
    const diffText = dmp.patch_toText(patches);
    
    debug('Created diff:', { 
      from: previousValue.substring(0, 50) + (previousValue.length > 50 ? '...' : ''),
      to: currentValue.substring(0, 50) + (currentValue.length > 50 ? '...' : ''),
      diffText: diffText.substring(0, 100) + (diffText.length > 100 ? '...' : '')
    });
    
    // Update the diff record to set diff and mark as processed
    // Use dollar-quoted strings to avoid escaping issues
    const updateQuery = `
      UPDATE logs.diffs 
      SET diff = $diff$${diffText}$diff$, processed = TRUE
      WHERE id = '${diffRecord.id}'
    `;
    
    debug('Executing UPDATE query:', updateQuery);
    
    const updateResult = await hasura.sql(updateQuery);
    debug('UPDATE result:', updateResult);
    
    debug('Successfully processed diff for record:', diffRecord.id);
    
    // Verify the update was successful
    const verifyResult = await hasura.sql(`
      SELECT _value, diff, processed FROM logs.diffs WHERE id = '${diffRecord.id}'
    `);
    debug('Verification after update:', {
      _value: verifyResult.result[1]?.[0],
      diff: verifyResult.result[1]?.[1]?.substring(0, 50) + '...',
      processed: verifyResult.result[1]?.[2]
    });
    
    return { 
      success: true, 
      diffId: diffRecord.id,
      diffText: diffText.substring(0, 200) + (diffText.length > 200 ? '...' : '')
    };
    
  } catch (error) {
    debug('Error processing diff:', error);
    return { success: false, error: String(error) };
  }
} 