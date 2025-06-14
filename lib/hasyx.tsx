import { useCreateApolloClient } from './apollo';

import { ThemeProvider } from "hasyx/components/theme-provider";
import { url, API_URL } from 'hasyx/lib/url';
import { SessionProvider } from "next-auth/react";
import { useMemo } from "react";
import isEqual from 'react-fast-compare';
import { Generate, GenerateOptions, GenerateResult } from "./generator";
import { Hasura } from './hasura';

import { ApolloError, FetchResult, Observable, OperationVariables, ApolloQueryResult } from '@apollo/client/core';
import type { MutationHookOptions as ApolloMutationHookOptions, QueryHookOptions as ApolloQueryHookOptions, SubscriptionHookOptions as ApolloSubscriptionHookOptions, QueryResult, SubscriptionResult } from '@apollo/client/react';
import { HasyxApolloClient } from './apollo';
import Debug from './debug';

const debug = Debug('hasyx:client'); const DEFAULT_POLLING_INTERVAL = 1000;

export interface HasyxOptions extends Omit<GenerateOptions, 'operation'> {
  role?: string;
  pollingInterval?: number;
  ws?: boolean;
}

export class Hasyx {
  public apolloClient: HasyxApolloClient;
  public generate: Generate;
  public hasura?: Hasura;
  private _options?: { secret?: string };
  private _user: any = null;

  constructor(apolloClient: HasyxApolloClient, generate: Generate, options?: { secret?: string }) {
    if (!apolloClient) {
      throw new Error('❌ ApolloClient instance must be provided to the Client constructor.');
    }
    this.apolloClient = apolloClient;
    this.generate = generate;
    this._options = options;

    // Create Hasura instance if URL and secret are available in Apollo client options
    const apolloOptions = apolloClient._options;
    if (apolloOptions?.url && apolloOptions?.secret) {
      this.hasura = new Hasura({
        url: apolloOptions.url,
        secret: apolloOptions.secret
      });
      debug('✅ Hasura instance created for SQL operations.');
    } else {
      debug('⚠️ Hasura instance not created: missing url or secret in Apollo client options.');
    }

    debug('Client class initialized with ApolloClient instance.');
  }

  /**
   * Sets the current user object
   * @param user - User object from session
   */
  set user(user: any) {
    this._user = user;
    debug('User set:', user);
  }

  /**
   * Gets the current user object
   * @returns Current user object or null
   */
  get user(): any {
    return this._user;
  }

  /**
   * Gets the current user ID
   * @returns User ID string or null
   */
  get userId(): string | null {
    return this._user?.id || null;
  }

  /**
   * Executes a GraphQL query (select operation).
   * @param options - Options for generating the query, including an optional `role`.
   * @returns Promise resolving with the query result data (unwrapped from the top-level key, e.g., the array or single object), except for aggregate queries which return the full `{ aggregate, nodes }` structure.
   * @throws ApolloError if the query fails or returns GraphQL errors.
   */
  async select<TData = any>(options: HasyxOptions): Promise<TData> {
    const { role, ...genOptions } = options;
    debug('Executing select with options:', genOptions, 'Role:', role);
    const generated: GenerateResult = this.generate({ ...genOptions, operation: 'query' });
    try {
      const result: ApolloQueryResult<any> = await this.apolloClient.query({
        query: generated.query,
        variables: generated.variables,
        fetchPolicy: 'network-only',
        context: role ? { role } : undefined,
      });

      if (result.errors) {
        debug('GraphQL errors during select:', result.errors);
        throw new ApolloError({ graphQLErrors: result.errors });
      }
      debug('Select successful, raw data:', result.data);

      if (genOptions.aggregate) {
        return result.data as TData;
      }

      const extractedData = result.data?.[generated.queryName] ?? null;
      debug('Select extracted data:', extractedData);
      return extractedData as TData;
    } catch (error) {
      debug('Error during select:', error);
      throw error;
    }
  }

  /**
   * Executes a GraphQL insert mutation.
   * @param options - Options for generating the mutation, including an optional `role`.
   * @returns Promise resolving with the mutation result data. For single inserts (`insert_table_one`), returns the inserted object. For bulk inserts, returns the full `{ affected_rows, returning }` object.
   * @throws ApolloError if the mutation fails or returns GraphQL errors.
   */
  async insert<TData = any>(options: HasyxOptions): Promise<TData> {
    const { role, ...genOptions } = options;
    debug('Executing insert with options:', genOptions, 'Role:', role);
    const generated: GenerateResult = this.generate({ ...genOptions, operation: 'insert' });
    try {
      const result: FetchResult<any> = await this.apolloClient.mutate({
        mutation: generated.query,
        variables: generated.variables,
        context: role ? { role } : undefined,
        fetchPolicy: 'no-cache',
      });

      if (result.errors) {
        debug('GraphQL errors during insert:', result.errors);
        throw new ApolloError({ graphQLErrors: result.errors });
      }
      const rawData = result.data ?? {};
      debug('Insert successful, raw data:', rawData);


      const isBulkInsert = !generated.queryName.endsWith('_one') && ('affected_rows' in rawData || 'returning' in rawData);
      if (isBulkInsert) {
        debug('Insert identified as bulk, returning full data object.');
        return rawData as TData;
      } else {

        const extractedData = rawData?.[generated.queryName] ?? null;
        debug('Insert identified as single, returning extracted data:', extractedData);
        return extractedData as TData;
      }
    } catch (error) {
      debug('Error during insert:', error);
      throw error;
    }
  }

  /**
   * Executes a GraphQL update mutation.
   * @param options - Options for generating the mutation, including an optional `role`.
   * @returns Promise resolving with the mutation result data. For `_by_pk` updates, returns the updated object. For bulk updates (using `where`), returns the full `{ affected_rows, returning }` object.
   * @throws ApolloError if the mutation fails or returns GraphQL errors.
   */
  async update<TData = any>(options: HasyxOptions): Promise<TData> {
    const { role, ...genOptions } = options;
    debug('Executing update with options:', genOptions, 'Role:', role);
    const generated: GenerateResult = this.generate({ ...genOptions, operation: 'update' });
    try {
      const result: FetchResult<any> = await this.apolloClient.mutate({
        mutation: generated.query,
        variables: generated.variables,
        context: role ? { role } : undefined,
        fetchPolicy: 'no-cache',
      });

      if (result.errors) {
        debug('GraphQL errors during update:', result.errors);
        throw new ApolloError({ graphQLErrors: result.errors });
      }
      const rawData = result.data ?? {};
      debug('Update successful, raw data:', rawData);

      const isBulkUpdate = !generated.queryName.endsWith('_by_pk') && ('affected_rows' in rawData || 'returning' in rawData);
      if (isBulkUpdate) {
        debug('Update identified as bulk, returning full data object.');
        return rawData as TData;
      } else {

        const extractedData = rawData?.[generated.queryName] ?? null;
        debug('Update identified as single (_by_pk), returning extracted data:', extractedData);
        return extractedData as TData;
      }
    } catch (error) {
      debug('Error during update:', error);
      throw error;
    }
  }

  /**
   * Executes a GraphQL delete mutation.
   * @param options - Options for generating the mutation, including an optional `role`.
   * @returns Promise resolving with the mutation result data. For `_by_pk` deletes, returns the deleted object. For bulk deletes (using `where`), returns the full `{ affected_rows, returning }` object.
   * @throws ApolloError if the mutation fails or returns GraphQL errors.
   */
  async delete<TData = any>(options: HasyxOptions): Promise<TData> {
    const { role, ...genOptions } = options;
    debug('Executing delete with options:', genOptions, 'Role:', role);
    const generated: GenerateResult = this.generate({ ...genOptions, operation: 'delete' });
    try {
      const result: FetchResult<any> = await this.apolloClient.mutate({
        mutation: generated.query,
        variables: generated.variables,
        context: role ? { role } : undefined,
        fetchPolicy: 'no-cache',
      });

      if (result.errors) {
        debug('GraphQL errors during delete:', result.errors);
        throw new ApolloError({ graphQLErrors: result.errors });
      }
      const rawData = result.data ?? {};
      debug('Delete successful, raw data:', rawData);

      const isBulkDelete = !generated.queryName.endsWith('_by_pk') && ('affected_rows' in rawData || 'returning' in rawData);
      if (isBulkDelete) {
        debug('Delete identified as bulk, returning full data object.');
        return rawData as TData;
      } else {

        const extractedData = rawData?.[generated.queryName] ?? null;
        debug('Delete identified as single (_by_pk), returning extracted data:', extractedData);
        return extractedData as TData;
      }
    } catch (error) {
      debug('Error during delete:', error);
      throw error;
    }
  }

  /**
   * Executes an upsert operation (INSERT with ON CONFLICT DO UPDATE or fallback to INSERT then UPDATE).
   * @param options - Options for generating the upsert, including `on_conflict` and optional `role`.
   * @returns Promise resolving with the upserted record data.
   * @throws ApolloError if the operation fails.
   */
  async upsert<TData = any>(options: HasyxOptions): Promise<TData> {
    const { role, on_conflict, ...genOptions } = options;
    debug('Executing upsert with options:', genOptions, 'on_conflict:', on_conflict, 'Role:', role);

    // First, try native upsert with ON CONFLICT
    try {
      const generated: GenerateResult = this.generate({ ...genOptions, on_conflict, operation: 'insert' });
      const result: FetchResult<any> = await this.apolloClient.mutate({
        mutation: generated.query,
        variables: generated.variables,
        context: role ? { role } : undefined,
        fetchPolicy: 'no-cache',
      });

      if (result.errors) {
        debug('GraphQL errors during native upsert:', result.errors);
        throw new ApolloError({ graphQLErrors: result.errors });
      }

      const rawData = result.data ?? {};
      debug('Native upsert successful, raw data:', rawData);

      const isBulkInsert = !generated.queryName.endsWith('_one') && ('affected_rows' in rawData || 'returning' in rawData);
      if (isBulkInsert) {
        debug('Upsert identified as bulk, returning full data object.');
        return rawData as TData;
      } else {
        const extractedData = rawData?.[generated.queryName] ?? null;
        debug('Upsert identified as single, returning extracted data:', extractedData);
        return extractedData as TData;
      }
    } catch (error: any) {
      // Check if this is a uniqueness violation that suggests we need fallback approach
      const isUniqueViolation = error?.message?.includes('Uniqueness violation') ||
                               error?.message?.includes('duplicate key value') ||
                               error?.graphQLErrors?.some((e: any) => 
                                 e?.message?.includes('Uniqueness violation') ||
                                 e?.message?.includes('duplicate key value') ||
                                 e?.extensions?.code === 'constraint-violation'
                               );

      if (isUniqueViolation) {
        debug('Native upsert failed with uniqueness violation, attempting fallback upsert approach');
        
        // Fallback: Try UPDATE first, then INSERT if not found
        try {
          // Ensure we have object data to work with
          if (!genOptions.object) {
            throw new Error('Cannot perform upsert without object data');
          }

          // Prepare update data
          const updateData: any = { ...genOptions.object };
          delete updateData.id; // Remove ID from update data

          // Try UPDATE first
          let updateOptions: any;
          if (genOptions.object.id) {
            // Use by_pk update if we have an ID
            updateOptions = {
              ...genOptions,
              pk_columns: { id: genOptions.object.id },
              _set: updateData,
              object: undefined // Remove object for update operation
            };
          } else {
            // Use where-based update
            const whereClause: any = {};
            if (on_conflict?.constraint === '_links_pkey' && genOptions.object.id) {
              whereClause.id = { _eq: genOptions.object.id };
            } else {
              // Build where clause from object fields for the constraint
              Object.keys(genOptions.object).forEach(key => {
                if (genOptions.object![key] !== undefined) {
                  whereClause[key] = { _eq: genOptions.object![key] };
                }
              });
            }
            
            updateOptions = {
              ...genOptions,
              where: whereClause,
              _set: updateData,
              object: undefined // Remove object for update operation
            };
          }

          const updateResult = await this.update<TData>(updateOptions);
          
          // Check if update actually affected any rows
          if (updateResult) {
            debug('Fallback upsert: UPDATE successful');
            return updateResult;
          } else {
            debug('Fallback upsert: UPDATE affected 0 rows, trying INSERT');
            // If no rows were updated, try INSERT
            return await this.insert<TData>(genOptions);
          }
        } catch (updateError: any) {
          debug('Fallback upsert: UPDATE failed, trying INSERT:', updateError?.message);
          // If UPDATE fails, try INSERT
          try {
            return await this.insert<TData>(genOptions);
          } catch (insertError: any) {
            debug('Fallback upsert: Both UPDATE and INSERT failed');
            // If both fail, throw the original upsert error
            throw error;
          }
        }
      } else {
        // Re-throw non-uniqueness errors
        debug('Error during upsert (not uniqueness violation):', error);
        throw error;
      }
    }
  }

  /**
   * Initiates a GraphQL subscription or sets up polling as a fallback when WebSockets are disabled.
   * @param options - Options for generating the subscription, including an optional `role` and `pollingInterval`.
   * @returns An Observable for the subscription results, emitting the unwrapped data directly.
   */
  subscribe<TData = any, TVariables extends OperationVariables = OperationVariables>(
    options: HasyxOptions
  ): Observable<TData> {
    const { role, pollingInterval, ws, ...genOptions } = options;
    const interval = pollingInterval || DEFAULT_POLLING_INTERVAL;
    const useWebSockets = ws !== undefined ? ws : !+(process.env.NEXT_PUBLIC_WS || '1') === false;

    debug(`Initiating ${useWebSockets ? 'WebSocket' : 'polling-based'} subscription with options:`,
      genOptions, 'Role:', role, `Explicit WS: ${ws}`, `Effective WS: ${useWebSockets}`,
      !useWebSockets ? `Polling interval: ${interval}ms` : '');

    debug(`Hasyx.subscribe: useWebSockets = ${useWebSockets}, explicit ws = ${ws}, NEXT_PUBLIC_WS = ${process.env.NEXT_PUBLIC_WS}`);
    if (process.env.NODE_ENV === 'test' && ws === true) {
      debug("Hasyx.subscribe: FORCING WebSocket mode for tests");
    }
    if (useWebSockets && !this.apolloClient._options.ws) {
      debug("WebSocket is requested, but the Apollo client was not created with ws: true. Falling back to polling mode.");

      return this._subscribeWithPolling<TData>({ role, ...genOptions }, interval);
    }
    if (!useWebSockets) {
      debug('Creating polling-based subscription Observable');
      debug("Hasyx.subscribe: Using polling-based subscription (HTTP mode)");

      return this._subscribeWithPolling<TData>({ role, ...genOptions }, interval);
    }
    return this._subscribeWithWebSocket<TData, TVariables>({ role, ...genOptions });
  }
  private _subscribeWithPolling<TData>(options: HasyxOptions & { role?: string }, interval: number): Observable<TData> {
    const { role, ...genOptions } = options;
    debug('Creating polling-based subscription Observable');
    debug("Hasyx._subscribeWithPolling: Using HTTP polling for subscription");
    return new Observable<TData>(observer => {
      let lastData: TData | null = null;
      let isActive = true;
      let timeoutId: NodeJS.Timeout | null = null;
      
      const pollForChanges = async () => {
        if (!isActive) {
          return;
        }

        try {

          const result = await this.select<TData>({
            ...genOptions,
            role
          });
          if (!isEqual(result, lastData)) {
            debug('Polling subscription detected changes:', JSON.stringify(result));
            lastData = result as TData;
            observer.next(result);
          }
          if (isActive) {
            timeoutId = setTimeout(pollForChanges, interval);
            // Allow process to exit even if this timeout is pending
            timeoutId.unref?.();
          }
        } catch (error) {
          debug('Error during polling subscription:', error);

          if (isActive) {
            observer.error(error);
          }
        }
      };
      pollForChanges();
      return () => {
        debug('Unsubscribing from polling subscription.');
        isActive = false;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      };
    });
  }
  private _subscribeWithWebSocket<TData, TVariables extends OperationVariables>(
    options: HasyxOptions & { role?: string }
  ): Observable<TData> {
    const { role, ...genOptions } = options;
    const generated: GenerateResult = this.generate({ ...genOptions, operation: 'subscription' });
    debug(`Hasyx._subscribeWithWebSocket: Using WebSocket-based subscription. Query name: ${generated.queryName}`);
    debug('Creating WebSocket-based subscription Observable');
    
    return new Observable<TData>(observer => {
      let lastEmitTime = 0;
      let pendingData: TData | null = null;
      let emitTimeoutId: NodeJS.Timeout | null = null;
      const resolvedInterval = typeof options.pollingInterval === 'number' ?
        options.pollingInterval : DEFAULT_POLLING_INTERVAL;
      const minEmitInterval = resolvedInterval;

      debug(`[Hasyx.subscribe/WS] Effective minEmitInterval: ${minEmitInterval}ms (options.pollingInterval: ${options.pollingInterval}, DEFAULT_POLLING_INTERVAL: ${DEFAULT_POLLING_INTERVAL})`);
      const throttledEmit = (data: TData) => {
        const now = Date.now();
        const timeSinceLastEmit = now - lastEmitTime;
        debug(`[throttledEmit] Called. Now: ${now}, LastEmit: ${lastEmitTime}, SinceLast: ${timeSinceLastEmit}, MinInterval: ${minEmitInterval}, PendingData: ${JSON.stringify(pendingData)}, EmitTimeoutId: ${emitTimeoutId}`);

        pendingData = data;
        debug(`[throttledEmit] Set pendingData to: ${JSON.stringify(pendingData)}`);

        if (timeSinceLastEmit >= minEmitInterval) {
          debug(`[throttledEmit] Condition 1 MET (timeSinceLastEmit >= minEmitInterval). Emitting immediately.`);
          lastEmitTime = now;
          observer.next(pendingData);
          debug(`[throttledEmit] Emitted. New LastEmit: ${lastEmitTime}. Data: ${JSON.stringify(pendingData)}`);
          pendingData = null;

          if (emitTimeoutId) {
            debug(`[throttledEmit] Clearing existing timeout ID: ${emitTimeoutId}`);
            clearTimeout(emitTimeoutId);
            emitTimeoutId = null;
          }
        }
        else if (!emitTimeoutId) {
          debug(`[throttledEmit] Condition 2 MET (!emitTimeoutId). Scheduling delayed emit.`);
          const delay = minEmitInterval - timeSinceLastEmit;
          debug(`[throttledEmit] Delay calculated: ${delay}ms. Current pending data: ${JSON.stringify(pendingData)}`);

          emitTimeoutId = setTimeout(() => {
            debug(`[throttledEmit] setTimeout EXECUTING. Current pendingData: ${JSON.stringify(pendingData)}. Old TimeoutId: ${emitTimeoutId}`);
            if (pendingData !== null) {
              debug(`[throttledEmit] setTimeout: pendingData is NOT null. Emitting.`);
              lastEmitTime = Date.now();
              observer.next(pendingData);
              debug(`[throttledEmit] setTimeout: Emitted. New LastEmit: ${lastEmitTime}. Data: ${JSON.stringify(pendingData)}`);
              pendingData = null;
            } else {
              debug(`[throttledEmit] setTimeout: pendingData IS NULL. Not emitting.`);
            }
            emitTimeoutId = null;
            debug(`[throttledEmit] setTimeout: Cleared emitTimeoutId.`);
          }, delay);
          // Allow process to exit even if this timeout is pending
          emitTimeoutId.unref?.();
          debug(`[throttledEmit] Scheduled timeout ID: ${emitTimeoutId}`);
        } else {
          debug(`[throttledEmit] Condition 3: ELSE (timeSinceLastEmit < minEmitInterval AND emitTimeoutId is SET). Doing nothing but pendingData updated.`);
        }
      };
      debug(`Hasyx.subscribe: Calling apolloClient.subscribe with WebSocket mode, url: ${this.apolloClient._options?.url}, ws: ${this.apolloClient._options?.ws}`);
      if (process.env.NODE_ENV === 'test') {
        debug('======= TEST ENVIRONMENT DETECTED =======');
        debug(`+ Apollo Client URL: ${this.apolloClient._options?.url}`);
        debug(`+ WebSocket enabled: ${this.apolloClient._options?.ws}`);
        debug(`+ Admin Secret available: ${!!this.apolloClient._options?.secret}`);
        debug(`+ Query name: ${generated.queryName}`);
        debug(`+ Query: ${generated.query}`);
        debug('=======================================');
      }

      const apolloSubscription = this.apolloClient.subscribe<any, TVariables>({
        query: generated.query,
        variables: generated.variables as TVariables,
        context: role ? { role } : undefined,
        fetchPolicy: 'no-cache',
      }).subscribe({
        next: (result: FetchResult<any>) => {
          debug(`Hasyx.subscribe: WS subscription next callback received data`);
          if (result.errors) {
            debug('GraphQL errors during subscription:', result.errors);

            observer.error(new ApolloError({ graphQLErrors: result.errors }));
            return;
          }
          const rawData = result.data ?? null;
          debug('Subscription received raw data:', JSON.stringify(rawData));
          debug('Subscription expected queryName:', generated.queryName);
          debug(`Hasyx.subscribe: Subscription received data for: ${generated.queryName}`);
          let extractedData: TData;

          if (genOptions.aggregate) {
            debug('Subscription is aggregate, returning raw data.');
            extractedData = rawData as TData;
          } else {

            extractedData = rawData?.[generated.queryName] ?? null;

            if (!extractedData && rawData?.[genOptions.table]) {
              debug(`Subscription extracted data using queryName ('${generated.queryName}') failed, falling back to base table name ('${genOptions.table}').`);
              extractedData = rawData[genOptions.table];

              if (generated.queryName.endsWith('_by_pk') && Array.isArray(extractedData) && extractedData.length === 1) {
                debug(`Subscription fallback found array for _by_pk, extracting first element.`);
                extractedData = extractedData[0];
              } else if (generated.queryName.endsWith('_by_pk') && Array.isArray(extractedData) && extractedData.length === 0) {
                debug(`Subscription fallback found empty array for _by_pk, setting to null.`);
                extractedData = null as TData;
              } else {
                debug('Subscription extracted data using queryName:', JSON.stringify(extractedData));
              }
            } else {
              debug('Subscription extracted data using queryName:', JSON.stringify(extractedData));
            }
          }
          debug('Subscription processing extracted data:', JSON.stringify(extractedData));
          throttledEmit(extractedData);
        },
        error: (error: any) => {
          debug('Subscription error:', error);
          if (error.message) debug('Error message:', error.message);
          if (error.graphQLErrors) debug('GraphQL Errors:', JSON.stringify(error.graphQLErrors));
          if (error.networkError) debug('Network Error:', error.networkError);
          observer.error(error);
        },
        complete: () => {
          debug('Subscription completed.');
          observer.complete();
        },
      });
      return () => {
        debug('Unsubscribing from Apollo subscription.');

        if (emitTimeoutId) {
          clearTimeout(emitTimeoutId);
          emitTimeoutId = null;
        }
        apolloSubscription.unsubscribe();
      };
    });
  }

  useSubscription<TData = any, TVariables extends OperationVariables = OperationVariables>(
    generateOptions: ClientGeneratorOptions,
    hookOptions?: SubscriptionHookOptions<TData, TVariables> & { variables?: TVariables }
  ): SubscriptionResult<TData, TVariables> {

    throw new Error("This method should not be called directly from the server component.");
  }

  useQuery<TData = any, TVariables extends OperationVariables = OperationVariables>(
    generateOptions: ClientGeneratorOptions,
    hookOptions?: QueryHookOptions<TData, TVariables> & { variables?: TVariables }
  ): QueryResult<TData, TVariables> {

    throw new Error("This method should not be called directly from the server component.");
  }

  /**
   * Executes raw SQL against the Hasura database.
   * Requires admin-level access with URL and admin secret.
   * @param sql - The SQL query to execute
   * @param source - Database source name (defaults to 'default')
   * @param cascade - Whether to enable cascade operations
   * @returns Promise resolving with the SQL execution result
   * @throws Error if Hasura instance is not available (missing URL or secret)
   */
  async sql(sql: string, source: string = 'default', cascade: boolean = false): Promise<any> {
    if (!this.hasura) {
      const errorMessage = '❌ SQL execution not available: Hasura instance not initialized. Ensure Apollo client was created with both URL and admin secret.';
      debug(errorMessage);
      throw new Error(errorMessage);
    }
    
    debug('Executing SQL via Hasura instance:', sql);
    return await this.hasura.sql(sql, source, cascade);
  }

  /**
   * Inserts a debug log entry if HASYX_DEBUG is enabled and admin secret is present.
   * This method is intended for server-side admin use only.
   * @param value - The JSONB value to log.
   * @returns The result of the insert operation promise, or undefined if not executed.
   */
  debug(value: any): Promise<any> | undefined {

    const hasyxDebugEnabled = typeof process !== 'undefined' && typeof process.env !== 'undefined' && !!+(process.env.HASYX_DEBUG || '0');
    const isAdminContext = !!this?.apolloClient?._options?.secret;

    if (hasyxDebugEnabled && isAdminContext) {
      debug('Executing debug log insert with value:', value);
      try {

        return this.insert<any>({
          table: 'debug',
          object: { value: value }
        });
      } catch (error: any) {
        debug('Error during debug insert (fire-and-forget):', error);
        return undefined;
      }
    } else {
      if (!hasyxDebugEnabled) {
        debug('Debug insert skipped: HASYX_DEBUG is not enabled.');
      }
      if (!isAdminContext) {
        debug('Debug insert skipped: Not in admin context (no admin secret found in Hasyx options).');
      }
      return undefined;
    }
  }
} type ClientGeneratorOptions = Omit<GenerateOptions, 'operation'>;

type BaseHookOptions = {
  role?: string;
  pollingInterval?: number;
};

type QueryHookOptions<TData, TVariables extends OperationVariables> = BaseHookOptions & Omit<ApolloQueryHookOptions<TData, TVariables>, 'query' | 'variables' | 'context'>;
type SubscriptionHookOptions<TData, TVariables extends OperationVariables> = BaseHookOptions & Omit<ApolloSubscriptionHookOptions<TData, TVariables>, 'query' | 'variables' | 'context'>;
type MutationHookOptions<TData, TVariables extends OperationVariables> = BaseHookOptions & Omit<ApolloMutationHookOptions<TData, TVariables>, 'mutation' | 'variables' | 'context'>;
