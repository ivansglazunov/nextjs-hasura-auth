import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import Debug from './debug'; // Assuming debug is in lib and alias @ points to root/src

const debug = Debug('hasura');

interface HasuraOptions {
  url: string;
  secret: string;
}

export class Hasura {
  private readonly clientInstance: AxiosInstance;

  constructor(options: HasuraOptions) {
    const { url, secret } = options;

    if (!url || !secret) {
      const errorMessage = '❌ Hasura URL or Admin Secret is missing. Check NEXT_PUBLIC_HASURA_GRAPHQL_ENDPOINT and HASURA_ADMIN_SECRET environment variables.';
      debug(errorMessage);
      throw new Error(errorMessage);
    }

    this.clientInstance = axios.create({
      baseURL: url.replace('/v1/graphql', ''), // Ensure base URL is correct
      headers: {
        'Content-Type': 'application/json',
        'X-Hasura-Admin-Secret': secret,
      },
    });
    debug('✅ Hasura client initialized successfully.');
  }

  get client(): AxiosInstance {
    return this.clientInstance;
  }

  async sql(sql: string, source: string = 'default', cascade: boolean = false): Promise<any> {
    debug('🔧 Executing SQL via /v2/query...');
    try {
      const response = await this.clientInstance.post('/v2/query', {
        type: 'run_sql',
        args: {
          source,
          sql,
          cascade,
        },
      });
      debug('✅ SQL executed successfully.');
      return response.data;
    } catch (error: any) {
      const errorMessage = `❌ Error executing SQL: ${error.response?.data?.error || error.message}`;
      debug(errorMessage, error.response?.data || error);
      throw new Error(errorMessage); // Re-throw after logging
    }
  }

  async v1(request: { type: string; args: object }): Promise<any> {
    debug(`🚀 Sending request to /v1/metadata: ${request.type}`);
    try {
      const response = await this.clientInstance.post('/v1/metadata', request);
      debug(`✅ /v1/metadata request successful for type: ${request.type}`);
      return response.data;
    } catch (error: any) {
       // Log specific Hasura errors if available, otherwise log the general error
       const hasuraError = error.response?.data?.error || error.response?.data?.message || error.message;
       const errorCode = error.response?.data?.code;
       const requestType = request.type; // Get the type of the request

       // Don't throw an error for common "already exists/tracked/not found/defined" issues
       const ignorableErrors = [
           'already exists',
           'already tracked',
           'not found',
           'already defined', // for permissions creation
       ];

       let isIgnorable = typeof hasuraError === 'string' && ignorableErrors.some(phrase => hasuraError.includes(phrase));

       // Specifically ignore 'permission-denied' ONLY for drop/untrack operations, as it likely means "not found" in this context
       if (!isIgnorable && errorCode === 'permission-denied' && (requestType.startsWith('pg_drop_') || requestType.startsWith('pg_untrack_'))) {
           debug(`📝 Note: Ignoring 'permission-denied' for ${requestType}, likely means target object was not found.`);
           isIgnorable = true;
       }

       if (isIgnorable) {
           debug(`📝 Note: Non-critical issue for ${requestType} - ${hasuraError} ${errorCode ? `(Code: ${errorCode})` : ''}`);
           return error.response?.data || { info: hasuraError }; // Return info instead of throwing
       } else {
           const errorMessage = `❌ Error in /v1/metadata for type ${requestType}: ${hasuraError} ${errorCode ? `(Code: ${errorCode})` : ''}`;
           debug(errorMessage, error.response?.data || error);
           throw new Error(errorMessage); // Re-throw critical errors
       }
    }
  }
}
