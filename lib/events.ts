import { Hasura } from './hasura';
import Debug from './debug';
import fs from 'fs-extra';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

const debug = Debug('events');

/**
 * Structure of a Hasura Event Trigger definition file
 */
export interface EventTriggerDefinition {
  name: string;
  table: {
    schema: string;
    name: string;
  };
  source?: string; // Defaults to 'default' if not specified
  webhook?: string; // Full URL for webhook
  webhook_path?: string; // Path only, to be combined with NEXT_PUBLIC_MAIN_URL
  insert?: {
    columns: string | string[];
  };
  update?: {
    columns: string | string[];
  };
  delete?: {
    columns: string | string[];
  };
  enable_manual?: boolean;
  retry_conf?: {
    num_retries?: number;
    interval_sec?: number;
    timeout_sec?: number;
  };
  headers?: {
    name: string;
    value?: string;
    value_from_env?: string;
  }[];
}

/**
 * Validate that an event trigger definition has all required fields
 */
export function validateEventTriggerDefinition(def: EventTriggerDefinition): string[] {
  const errors: string[] = [];

  if (!def.name) {
    errors.push('Event trigger must have a name');
  }

  if (!def.table) {
    errors.push('Event trigger must specify a table');
  } else {
    if (!def.table.schema) {
      errors.push('Event trigger table must specify a schema');
    }
    if (!def.table.name) {
      errors.push('Event trigger table must specify a name');
    }
  }

  // Either webhook or webhook_path must be specified
  if (!def.webhook && !def.webhook_path) {
    errors.push('Event trigger must specify either webhook or webhook_path');
  }

  // At least one operation must be defined
  if (!def.insert && !def.update && !def.delete && !def.enable_manual) {
    errors.push('Event trigger must specify at least one operation (insert, update, delete) or enable_manual');
  }

  return errors;
}

/**
 * Load all event trigger definitions from a directory
 */
export async function loadEventTriggerDefinitions(eventsDir: string): Promise<EventTriggerDefinition[]> {
  debug(`Loading event trigger definitions from ${eventsDir}`);
  const triggers: EventTriggerDefinition[] = [];

  try {
    // Ensure the directory exists
    if (!await fs.pathExists(eventsDir)) {
      debug(`Events directory ${eventsDir} does not exist`);
      return [];
    }

    // Read all files in the directory
    const files = await fs.readdir(eventsDir);
    debug(`Found ${files.length} files in events directory`);

    for (const file of files) {
      // Only process .json files
      if (!file.endsWith('.json')) {
        debug(`Skipping non-JSON file: ${file}`);
        continue;
      }

      try {
        const filePath = path.join(eventsDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const triggerDef: EventTriggerDefinition = JSON.parse(content);
        
        // Use filename (without extension) as trigger name if not specified
        if (!triggerDef.name) {
          triggerDef.name = path.basename(file, '.json');
          debug(`Using filename as trigger name: ${triggerDef.name}`);
        }

        // Validate the trigger definition
        const errors = validateEventTriggerDefinition(triggerDef);
        if (errors.length > 0) {
          debug(`Invalid event trigger definition in ${file}: ${errors.join(', ')}`);
        } else {
          triggers.push(triggerDef);
          debug(`Loaded event trigger definition: ${triggerDef.name}`);
        }
      } catch (error) {
        debug(`Error processing file ${file}: ${error}`);
      }
    }
  } catch (error) {
    debug(`Error loading event trigger definitions: ${error}`);
  }

  return triggers;
}

/**
 * Creates or updates an event trigger in Hasura
 */
export async function createOrUpdateEventTrigger(
  hasura: Hasura, 
  trigger: EventTriggerDefinition,
  baseUrl?: string
): Promise<boolean> {
  try {
    debug(`Creating/updating event trigger: ${trigger.name}`);

    // Prepare the URL - use webhook if provided, otherwise combine baseUrl with webhook_path
    let webhookUrl = trigger.webhook;
    if (!webhookUrl && trigger.webhook_path) {
      if (!baseUrl) {
        baseUrl = process.env.NEXT_PUBLIC_MAIN_URL || '';
        if (!baseUrl) {
          debug('No base URL specified and NEXT_PUBLIC_MAIN_URL is not set');
          return false;
        }
      }
      
      // Normalize base URL to not end with slash
      baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      
      // Normalize webhook_path to start with slash
      const webhookPath = trigger.webhook_path.startsWith('/') 
        ? trigger.webhook_path 
        : `/${trigger.webhook_path}`;
      
      webhookUrl = `${baseUrl}${webhookPath}`;
      debug(`Constructed webhook URL: ${webhookUrl}`);
    }

    // Set default source if not specified
    const source = trigger.source || 'default';

    // Check if trigger already exists using pg_get_event_triggers metadata API
    const existingTriggersResponse = await hasura.v1({
      type: 'export_metadata',
      args: {}
    });

    // Parse the metadata to check if the trigger exists
    let triggerExists = false;
    if (existingTriggersResponse?.metadata?.sources) {
      for (const sourceObj of existingTriggersResponse.metadata.sources) {
        if (sourceObj.name !== source) continue;
        
        if (sourceObj.tables) {
          for (const table of sourceObj.tables) {
            if (table.table.schema === trigger.table.schema && 
                table.table.name === trigger.table.name &&
                table.event_triggers) {
              triggerExists = table.event_triggers.some((et: { name: string }) => et.name === trigger.name);
              if (triggerExists) {
                debug(`Event trigger ${trigger.name} already exists, updating...`);
                break;
              }
            }
          }
        }
        
        if (triggerExists) break;
      }
    }

    // Prepare the arguments for the API call
    const args: any = {
      name: trigger.name,
      source,
      table: trigger.table,
      webhook: webhookUrl
    };

    // Add operation configurations
    if (trigger.insert) args.insert = trigger.insert;
    if (trigger.update) args.update = trigger.update;
    if (trigger.delete) args.delete = trigger.delete;
    if (trigger.enable_manual !== undefined) args.enable_manual = trigger.enable_manual;
    
    // Add retry configuration if specified
    if (trigger.retry_conf) args.retry_conf = trigger.retry_conf;
    
    // Get the HASURA_EVENT_SECRET from environment
    const eventSecret = process.env.HASURA_EVENT_SECRET;
    
    // Clone the headers array from the trigger definition or create a new one
    const headers = trigger.headers ? [...trigger.headers] : [];
    
    // Check if the event secret header already exists in the array
    const hasEventSecretHeader = headers.some(h => 
      h.name.toLowerCase() === 'x-hasura-event-secret' && 
      (h.value_from_env === 'HASURA_EVENT_SECRET' || h.value === eventSecret)
    );
    
    // Add the event secret header if it doesn't exist and the secret is set
    if (!hasEventSecretHeader && eventSecret) {
      headers.push({
        name: 'X-Hasura-Event-Secret',
        value_from_env: 'HASURA_EVENT_SECRET'
      });
      debug('Added X-Hasura-Event-Secret header to event trigger');
    } else if (!hasEventSecretHeader) {
      debug('WARNING: HASURA_EVENT_SECRET not set in environment, skipping secret header');
    }
    
    // Add headers to args if any exist
    if (headers.length > 0) args.headers = headers;
    
    // Set replace to true if the trigger already exists
    args.replace = triggerExists;

    // Create or update the event trigger
    const type = 'pg_create_event_trigger'; // Currently only supporting Postgres
    const result = await hasura.v1({
      type,
      args
    });

    debug(`Event trigger ${trigger.name} ${triggerExists ? 'updated' : 'created'} successfully`);
    return true;
  } catch (error) {
    debug(`Error creating/updating event trigger ${trigger.name}: ${error}`);
    return false;
  }
}

/**
 * Deletes an event trigger in Hasura
 */
export async function deleteEventTrigger(hasura: Hasura, name: string, source: string = 'default'): Promise<boolean> {
  try {
    debug(`Deleting event trigger: ${name}`);
    
    const result = await hasura.v1({
      type: 'pg_delete_event_trigger',
      args: {
        name,
        source
      }
    });
    
    debug(`Event trigger ${name} deleted successfully`);
    return true;
  } catch (error) {
    debug(`Error deleting event trigger ${name}: ${error}`);
    return false;
  }
}

/**
 * Gets all event triggers configured in Hasura
 */
export async function getExistingEventTriggers(hasura: Hasura): Promise<Record<string, EventTriggerDefinition>> {
  try {
    debug('Getting existing event triggers');
    
    const response = await hasura.v1({
      type: 'export_metadata',
      args: {}
    });
    
    const existingTriggers: Record<string, EventTriggerDefinition> = {};
    
    if (response?.metadata?.sources) {
      for (const source of response.metadata.sources) {
        if (source.tables) {
          for (const table of source.tables) {
            if (table.event_triggers) {
              for (const trigger of table.event_triggers) {
                existingTriggers[trigger.name] = {
                  name: trigger.name,
                  table: {
                    schema: table.table.schema,
                    name: table.table.name
                  },
                  source: source.name,
                  webhook: trigger.webhook,
                  ...trigger.definition
                };
                debug(`Found existing trigger: ${trigger.name}`);
              }
            }
          }
        }
      }
    }
    
    return existingTriggers;
  } catch (error) {
    debug(`Error getting existing event triggers: ${error}`);
    return {};
  }
}

/**
 * Synchronizes event triggers between local definitions and Hasura
 * - Creates triggers that exist locally but not in Hasura
 * - Updates triggers that exist both locally and in Hasura
 * - Deletes triggers that exist in Hasura but not locally
 */
export async function syncEventTriggers(hasura: Hasura, localTriggers: EventTriggerDefinition[], baseUrl?: string): Promise<void> {
  try {
    debug('Starting event trigger synchronization');
    
    // Get existing triggers from Hasura
    const existingTriggers = await getExistingEventTriggers(hasura);
    
    // Create a map of local triggers by name for easy lookup
    const localTriggerMap: Record<string, EventTriggerDefinition> = {};
    for (const trigger of localTriggers) {
      localTriggerMap[trigger.name] = trigger;
    }
    
    // Create or update local triggers
    debug(`Processing ${localTriggers.length} local triggers`);
    for (const trigger of localTriggers) {
      await createOrUpdateEventTrigger(hasura, trigger, baseUrl);
    }
    
    // Delete triggers that exist in Hasura but not locally
    for (const [name, trigger] of Object.entries(existingTriggers)) {
      if (!localTriggerMap[name]) {
        debug(`Deleting trigger ${name} as it no longer exists locally`);
        await deleteEventTrigger(hasura, name, trigger.source);
      }
    }
    
    debug('Event trigger synchronization completed');
  } catch (error) {
    debug(`Error synchronizing event triggers: ${error}`);
  }
}

/**
 * Main function to synchronize all event triggers from a directory
 */
export async function syncEventTriggersFromDirectory(eventsDir: string, hasuraUrl?: string, hasuraSecret?: string, baseUrl?: string): Promise<void> {
  debug('Synchronizing event triggers from directory');
  
  // Check if HASURA_EVENT_SECRET is set
  const eventSecret = process.env.HASURA_EVENT_SECRET;
  if (!eventSecret) {
    debug('HASURA_EVENT_SECRET not set in environment');
    console.warn('⚠️ WARNING: HASURA_EVENT_SECRET is not set. This is required for secure event trigger handling.');
    console.warn('   Please set HASURA_EVENT_SECRET in your environment variables.');
    
    // In production, we should fail if the secret is not set
    if (process.env.NODE_ENV === 'production') {
      throw new Error('HASURA_EVENT_SECRET is required for event trigger synchronization in production');
    }
  }
  
  // Create a Hasura client
  const url = hasuraUrl || process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL;
  const secret = hasuraSecret || process.env.HASURA_ADMIN_SECRET;
  
  if (!url || !secret) {
    debug('Missing Hasura URL or admin secret');
    throw new Error('NEXT_PUBLIC_HASURA_GRAPHQL_URL and HASURA_ADMIN_SECRET are required for event trigger synchronization');
  }
  
  const hasura = new Hasura({ url, secret });
  
  // Load trigger definitions from the directory
  const triggers = await loadEventTriggerDefinitions(eventsDir);
  debug(`Loaded ${triggers.length} event trigger definitions`);
  
  // Synchronize the triggers with Hasura
  await syncEventTriggers(hasura, triggers, baseUrl);
}

/**
 * Verify that a request came from Hasura
 * This should be used in the event handler API route
 */
export function verifyHasuraRequest(headers: Record<string, string | string[] | undefined>, secret?: string): boolean {
  // If no secret is provided, use the HASURA_EVENT_SECRET environment variable
  const secretKey = secret || process.env.HASURA_EVENT_SECRET;
  
  // If no secret is configured, we should log a warning
  if (!secretKey) {
    // In production, this is a security risk, so we should fail the verification
    if (process.env.NODE_ENV === 'production') {
      debug('SECURITY WARNING: No HASURA_EVENT_SECRET configured in production environment! Request denied.');
      return false;
    }
    
    // In development, allow requests but log a warning
    debug('SECURITY WARNING: No HASURA_EVENT_SECRET configured! ANYONE can trigger your event handlers.');
    debug('Set HASURA_EVENT_SECRET in your .env file for secure event trigger handling.');
    return true;
  }
  
  // Get the secret from the request header
  const requestSecret = headers['x-hasura-event-secret'];
  const secretValue = Array.isArray(requestSecret) ? requestSecret[0] : requestSecret;
  
  // Compare the secrets
  const isValid = secretValue === secretKey;
  
  if (!isValid) {
    debug('Invalid event secret provided in request');
  }
  
  return isValid;
}

/**
 * Create default event trigger definitions for users and accounts tables
 */
export async function createDefaultEventTriggers(eventsDir: string): Promise<void> {
  debug(`Creating default event trigger definitions in ${eventsDir}`);
  
  // Ensure the events directory exists
  await fs.ensureDir(eventsDir);
  
  // Default users event trigger
  const usersEventTrigger: EventTriggerDefinition = {
    name: 'users',
    table: {
      schema: 'public',
      name: 'users'
    },
    webhook_path: '/api/events/users',
    insert: {
      columns: '*'
    },
    update: {
      columns: '*'
    },
    delete: {
      columns: '*'
    },
    retry_conf: {
      num_retries: 3,
      interval_sec: 15,
      timeout_sec: 60
    }
  };
  
  // Default accounts event trigger
  const accountsEventTrigger: EventTriggerDefinition = {
    name: 'accounts',
    table: {
      schema: 'public',
      name: 'accounts'
    },
    webhook_path: '/api/events/accounts',
    insert: {
      columns: '*'
    },
    update: {
      columns: '*'
    },
    delete: {
      columns: '*'
    },
    retry_conf: {
      num_retries: 3,
      interval_sec: 15,
      timeout_sec: 60
    }
  };
  
  // Write the trigger definitions to files
  await fs.writeFile(
    path.join(eventsDir, 'users.json'),
    JSON.stringify(usersEventTrigger, null, 2)
  );
  
  await fs.writeFile(
    path.join(eventsDir, 'accounts.json'),
    JSON.stringify(accountsEventTrigger, null, 2)
  );
  
  debug('Default event trigger definitions created');
}

// Event payload structure
export interface HasuraEventPayload {
  event: {
    session_variables?: Record<string, string>;
    op: 'INSERT' | 'UPDATE' | 'DELETE' | 'MANUAL';
    data: {
      old: any | null;
      new: any | null;
    };
    trace_context?: {
      trace_id: string;
      span_id: string;
    };
  };
  created_at: string;
  id: string;
  delivery_info: {
    max_retries: number;
    current_retry: number;
  };
  trigger: {
    name: string;
  };
  table: {
    schema: string;
    name: string;
  };
}

/**
 * Helper wrapper for Hasura event trigger handlers
 * This function handles verification, logging, and error handling for Hasura event triggers
 * 
 * @param handler Function to handle the validated event
 * @returns Next.js route handler
 */
export function hasyxEvent(
  handler: (payload: HasuraEventPayload) => Promise<Response | NextResponse | any>
) {
  return async (request: NextRequest, context?: any) => {
    const triggerName = context?.params?.name || 'unknown';
    debug(`Received event trigger for ${triggerName}`);
    
    // Verify that the request is from Hasura
    if (!verifyHasuraRequest(Object.fromEntries(request.headers))) {
      debug(`Unauthorized request for event trigger ${triggerName}`);
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    try {
      // Parse the request body
      const body = await request.json();
      debug(`Raw request body for ${triggerName}:`, body);
      
      // <<< УЛУЧШЕННАЯ ПРОВЕРКА И ДИАГНОСТИКА >>>
      if (!body || typeof body !== 'object' || !('payload' in body)) {
        const receivedBodyType = typeof body;
        const receivedBodyKeys = (body && typeof body === 'object') ? Object.keys(body) : null;
        const contentType = request.headers.get('content-type');
        
        const errorDetails = {
          message: 'Invalid payload structure: Missing top-level \'payload\' key.',
          receivedBodyType: receivedBodyType,
          receivedBodyKeys: receivedBodyKeys,
          contentTypeHeader: contentType
        };
        
        debug('Invalid event payload details:', errorDetails);
        return NextResponse.json(
          errorDetails,
          { status: 400 }
        );
      }
      // <<< КОНЕЦ УЛУЧШЕННОЙ ПРОВЕРКИ >>>

      const actualPayload = body.payload as HasuraEventPayload;

      // Add basic validation for the actual payload structure
      if (!actualPayload || !actualPayload.event || !actualPayload.table || !actualPayload.trigger) {
         debug('Invalid event payload content:', actualPayload);
         return NextResponse.json(
           { message: 'Invalid payload content' },
           { status: 400 }
         );
       }

      debug(`Extracted event payload for ${triggerName}:`, actualPayload); 
      
      // Log details about the operation
      const { op, data } = actualPayload.event;
      const tableInfo = `${actualPayload.table.schema}.${actualPayload.table.name}`;
      
      // Extract the ID or primary key information for logging
      let recordInfo = '';
      if (op === 'INSERT' && data.new) {
        recordInfo = data.new.id ? `id:${data.new.id}` : JSON.stringify(data.new);
      } else if (op === 'UPDATE') {
        recordInfo = data.new?.id ? `id:${data.new.id}` : JSON.stringify(data.new);
      } else if (op === 'DELETE' && data.old) {
        recordInfo = data.old.id ? `id:${data.old.id}` : JSON.stringify(data.old);
      }
      
      debug(`Processing ${op} on ${tableInfo} ${recordInfo}`);
      
      // Call the handler with the *extracted* payload
      const result = await handler(actualPayload);
      
      // Convert the result to a NextResponse if it's not already
      if (!(result instanceof Response) && !(result instanceof NextResponse)) {
        return NextResponse.json(result || { success: true });
      }
      
      return result;
    } catch (error) {
      debug(`Error processing ${triggerName} event:`, error);
      return NextResponse.json(
        { message: 'Internal server error', error: String(error) },
        { status: 500 }
      );
    }
  };
} 