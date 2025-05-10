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
      // Ensure that if Hasura returns a 2xx status but with an error in the body (e.g. for bulk operations with allow_inconsistent_metadata)
      // we still check for it. However, typically Hasura non-2xx status means an error.
      // For now, we assume non-2xx is caught by catch block, and 2xx with error payload is handled by callers if necessary.
      // For now, we assume non-2xx is caught by catch block, and 2xx with error payload is handled by callers if necessary.
      debug(`✅ /v1/metadata request successful for type: ${request.type}`);
      return response.data;
    } catch (error: any) {
       const responseData = error.response?.data;
       const requestType = request.type;

       // Extract error message and code carefully
       let mainErrorMessage = 'Unknown Hasura API error';
       let mainErrorCode = 'unknown';

       if (responseData) {
         // Handle cases where responseData is an array (e.g., some bulk responses)
         if (Array.isArray(responseData) && responseData.length > 0) {
           const firstError = responseData.find(item => item.error || item.message || item.code);
           if (firstError) {
             mainErrorMessage = firstError.message || firstError.error || 'Error in bulk operation array';
             mainErrorCode = firstError.code || 'unknown';
           } else {
             mainErrorMessage = 'Error in bulk response array structure';
           }
         } else if (typeof responseData === 'object') {
           mainErrorMessage = responseData.message || responseData.error || (responseData.errors && responseData.errors[0]?.message) || error.message || mainErrorMessage;
           mainErrorCode = responseData.code || (responseData.internal && responseData.internal[0]?.code) || (responseData.error?.code) || (responseData.errors && responseData.errors[0]?.extensions?.code) || mainErrorCode;
           // Specific for error "view/table already untracked: "payments" (Code: already-untracked)" where type is bulk
           if (requestType === 'bulk' && typeof mainErrorMessage === 'string' && !mainErrorCode && mainErrorMessage.includes('(Code: ')) {
             const codeMatch = mainErrorMessage.match(/\(Code: ([\w-]+)\)/);
             if (codeMatch && codeMatch[1]) {
               mainErrorCode = codeMatch[1];
             }
           }
         } else {
           mainErrorMessage = error.message || mainErrorMessage;
         }
       } else {
         mainErrorMessage = error.message || mainErrorMessage;
       }
       
       // Standardized ignorable error codes from Hasura
       const ignorableErrorCodes = [
           'already-exists',
           'already-tracked',
           'already-untracked',
           'not-found', // Can be ignorable for drop/delete operations
           'already-defined',
           'not-exists', // Added for cases like trying to drop something that isn't there
           // 'permission-denied', // Handle this more specifically below
       ];

       let isIgnorable = ignorableErrorCodes.includes(mainErrorCode);

       // Specifically ignore 'permission-denied' or 'not-found' for drop/untrack/delete operations
       if (!isIgnorable && (mainErrorCode === 'permission-denied' || mainErrorCode === 'not-found')) {
           if (requestType.startsWith('pg_drop_') || requestType.startsWith('pg_untrack_') || requestType.startsWith('delete_') || requestType.endsWith('_delete_permission')) {
               debug(`📝 Note: Ignoring '${mainErrorCode}' for ${requestType}, likely means target object was not found or permission did not exist.`);
               isIgnorable = true;
           }
       }
       
       // If type is bulk and we got a generic bulk error code, inspect internal errors if any
       if (requestType === 'bulk' && (mainErrorCode === 'bulk-error' || mainErrorCode === 'pg-error') && responseData?.internal) {
           const internalErrors = Array.isArray(responseData.internal) ? responseData.internal : [responseData.internal];
           let allInternalIgnorable = internalErrors.length > 0;
           for (const internalItem of internalErrors) {
               const internalCode = internalItem.code || (internalItem.error?.code);
               let currentInternalIgnorable = ignorableErrorCodes.includes(internalCode);
               if (!currentInternalIgnorable && (internalCode === 'permission-denied' || internalCode === 'not-found')) {
                   // Assuming items in bulk args have a 'type' field to check if it's a drop op. This is a simplification.
                   // For simplicity, we'll be more lenient with permission-denied/not-found inside bulk for now.
                   currentInternalIgnorable = true; 
               }
               if (!currentInternalIgnorable) {
                   allInternalIgnorable = false;
                   // Update main error message to be more specific if a non-ignorable internal error is found
                   mainErrorMessage = internalItem.message || internalItem.error || mainErrorMessage;
                   mainErrorCode = internalCode || mainErrorCode;
                   break;
               }
           }
           if (allInternalIgnorable) isIgnorable = true;
       }


       if (isIgnorable) {
           const logMessage = `📝 Note: Non-critical Hasura issue for type '${requestType}' - ${mainErrorMessage} (Code: ${mainErrorCode}). Proceeding.`;
           console.warn(logMessage); // Make it more visible
           debug(logMessage, `Raw response data: ${JSON.stringify(responseData, null, 2)}`);
           // Return the original response data as if it were a success, or a generic success object.
           // This makes the calling function not misinterpret it as an error structure.
           // If the original success returns response.data, we should mimic that.
           // error.response.data might be the actual data Hasura sent with the "ignorable error".
           return responseData || { success: true, info: mainErrorMessage, code: mainErrorCode };
       } else {
           const errorMessageToThrow = `❌ Error in /v1/metadata for type ${requestType}: ${mainErrorMessage} (Code: ${mainErrorCode})`;
           debug(errorMessageToThrow, `Raw response data: ${JSON.stringify(responseData, null, 2)}`, error);
           throw new Error(errorMessageToThrow); // Re-throw critical errors
       }
    }
  }
}
