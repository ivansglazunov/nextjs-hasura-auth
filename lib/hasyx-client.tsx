"use client";

import { useEffect, useRef, useState, useMemo, useContext, useCallback } from "react";
import isEqual from 'react-fast-compare';
import {
  ApolloError,
  MutationHookOptions as ApolloMutationHookOptions,
  QueryHookOptions as ApolloQueryHookOptions,
  ApolloQueryResult,
  SubscriptionHookOptions as ApolloSubscriptionHookOptions,
  DocumentNode,
  FetchResult,
  MutationTuple,
  Observable,
  OperationVariables,
  QueryResult,
  SubscriptionResult,
  getApolloContext,
  gql,
  useApolloClient,
  useMutation as useApolloMutation,
  useQuery as useApolloQuery, 
  useSubscription as useApolloSubscription
} from '@apollo/client';
import { HasyxApolloClient } from './apollo';
import Debug from './debug';
import { GenerateOptions, GenerateResult } from "./generator";

const debug = Debug('client');

// Check if WebSockets are disabled via environment variable
const isWsDisabled = !+(process.env.NEXT_PUBLIC_WS || '1');

// Default polling interval for subscription polling fallback in milliseconds
const DEFAULT_POLLING_INTERVAL = 1000;

// Import required types from hasyx.tsx
// These type definitions should match the ones in hasyx.tsx
type ClientGeneratorOptions = Omit<GenerateOptions, 'operation'>;

type BaseHookOptions = {
  role?: string;
  pollingInterval?: number;
};

type QueryHookOptions<TData, TVariables extends OperationVariables> = BaseHookOptions & 
  Omit<ApolloQueryHookOptions<TData, TVariables>, 'query' | 'variables' | 'context'>;

type SubscriptionHookOptions<TData, TVariables extends OperationVariables> = BaseHookOptions & 
  Omit<ApolloSubscriptionHookOptions<TData, TVariables>, 'query' | 'variables' | 'context'>;

type MutationHookOptions<TData, TVariables extends OperationVariables> = BaseHookOptions & 
  Omit<ApolloMutationHookOptions<TData, TVariables>, 'mutation' | 'variables' | 'context'>;

// Helper to extract Apollo options and context for HOOKS
function prepareHookArgs<TData, TVariables extends OperationVariables>(
  options?: QueryHookOptions<TData, TVariables> | SubscriptionHookOptions<TData, TVariables> | MutationHookOptions<TData, TVariables>,
  isMutation: boolean = false
) {
  const { role, ...apolloOptions } = options || {};
  const context = role ? { role } : undefined;

  // Extract variables only if not a mutation (variables are passed to mutate fn)
  // And if options actually contain variables (e.g., for query/sub)
  const variables = !isMutation && options && 'variables' in options ? options.variables as TVariables : undefined;

  debug('Preparing hook args', { role, context, variables: isMutation ? '(mutation - in mutate fn)' : variables, apolloOptions });
  return { context, variables, apolloOptions };
}

/**
 * Hook to get the Apollo Client instance.
 * Prefers the explicitly provided client, falls back to context, throws if none found.
 * @param providedClient - An optional ApolloClient instance.
 * @returns The ApolloClient instance.
 * @throws Error if no client is found.
 */
export function useClient(providedClient?: HasyxApolloClient | null) {
  const ApolloContext = getApolloContext();
  const contextValue = useContext(ApolloContext);
  const contextClient = contextValue?.client;
  const client = (providedClient ?? contextClient) as HasyxApolloClient;
  if (!client?.hasyxGenerator) throw new Error(`❌ useClient: No client?.hasyxGenerator found.`);

  return useMemo(() => {
    if (!client) throw new Error(`❌ useClient: No client found.`);
    
    return {
      select: async function select<TData = any>(options: any): Promise<TData> {
        debug('useClient.select called with options:', options);
        const { role, ...genOptions } = options;
        const generated = client.hasyxGenerator({ ...genOptions, operation: 'query' });
        
        try {
          const result = await client.query({
            query: gql`${generated.query}`,
            variables: generated.variables,
            fetchPolicy: 'network-only',
            context: role ? { role } : undefined,
          });

          if (result.errors) {
            debug('GraphQL errors during select:', result.errors);
            throw new ApolloError({ graphQLErrors: result.errors });
          }
          
          // Extract data - for aggregate queries keep full structure, otherwise unwrap
          if (genOptions.aggregate) {
            return result.data as TData;
          }
          
          const extractedData = result.data?.[generated.queryName] ?? null;
          return extractedData as TData;
        } catch (error) {
          debug('Error during select:', error);
          throw error;
        }
      },
      
      insert: async function insert<TData = any>(options: any): Promise<TData> {
        debug('useClient.insert called with options:', options);
        const { role, ...genOptions } = options;
        const generated = client.hasyxGenerator({ ...genOptions, operation: 'insert' });
        
        try {
          const result = await client.mutate({
            mutation: gql`${generated.query}`,
            variables: generated.variables,
            context: role ? { role } : undefined,
          });

          if (result.errors) {
            debug('GraphQL errors during insert:', result.errors);
            throw new ApolloError({ graphQLErrors: result.errors });
          }
          
          const rawData = result.data ?? {};
          
          // For bulk inserts return full structure, for single inserts unwrap
          const isBulkInsert = !generated.queryName.endsWith('_one') && 
            ('affected_rows' in rawData || 'returning' in rawData);
            
          if (isBulkInsert) {
            return rawData as TData;
          } else {
            const extractedData = rawData?.[generated.queryName] ?? null;
            return extractedData as TData;
          }
        } catch (error) {
          debug('Error during insert:', error);
          throw error;
        }
      },
      
      update: async function update<TData = any>(options: any): Promise<TData> {
        debug('useClient.update called with options:', options);
        const { role, ...genOptions } = options;
        const generated = client.hasyxGenerator({ ...genOptions, operation: 'update' });
        
        try {
          const result = await client.mutate({
            mutation: gql`${generated.query}`,
            variables: generated.variables,
            context: role ? { role } : undefined,
          });

          if (result.errors) {
            debug('GraphQL errors during update:', result.errors);
            throw new ApolloError({ graphQLErrors: result.errors });
          }
          
          const rawData = result.data ?? {};
          
          // For bulk updates return full structure, for single updates unwrap
          const isBulkUpdate = !generated.queryName.endsWith('_by_pk') && 
            ('affected_rows' in rawData || 'returning' in rawData);
            
          if (isBulkUpdate) {
            return rawData as TData;
          } else {
            const extractedData = rawData?.[generated.queryName] ?? null;
            return extractedData as TData;
          }
        } catch (error) {
          debug('Error during update:', error);
          throw error;
        }
      },
      
      delete: async function del<TData = any>(options: any): Promise<TData> {
        debug('useClient.delete called with options:', options);
        const { role, ...genOptions } = options;
        const generated = client.hasyxGenerator({ ...genOptions, operation: 'delete' });
        
        try {
          const result = await client.mutate({
            mutation: gql`${generated.query}`,
            variables: generated.variables,
            context: role ? { role } : undefined,
          });

          if (result.errors) {
            debug('GraphQL errors during delete:', result.errors);
            throw new ApolloError({ graphQLErrors: result.errors });
          }
          
          const rawData = result.data ?? {};
          
          // For bulk deletes return full structure, for single deletes unwrap
          const isBulkDelete = !generated.queryName.endsWith('_by_pk') && 
            ('affected_rows' in rawData || 'returning' in rawData);
            
          if (isBulkDelete) {
            return rawData as TData;
          } else {
            const extractedData = rawData?.[generated.queryName] ?? null;
            return extractedData as TData;
          }
        } catch (error) {
          debug('Error during delete:', error);
          throw error;
        }
      },
      
      subscribe: function subscribe<TData = any>(options: any): Observable<TData> {
        debug('useClient.subscribe called with options:', options);
        const { role, pollingInterval, ...genOptions } = options;
        const interval = pollingInterval || DEFAULT_POLLING_INTERVAL;
        
        // If WebSockets are disabled, use polling
        if (isWsDisabled) {
          return new Observable<TData>(observer => {
            let lastData: TData | null = null;
            let isActive = true;
            let timeoutId: NodeJS.Timeout | null = null;
            
            const pollForChanges = async () => {
              if (!isActive) return;
              
              try {
                // Use the select method defined above
                const result = await this.select<TData>({ 
                  ...genOptions, 
                  role,
                  operation: 'query'
                });
                
                // Only emit if data has changed
                if (!isEqual(result, lastData)) {
                  debug('Polling subscription detected changes');
                  lastData = result as TData;
                  observer.next(result);
                }
                
                if (isActive) {
                  timeoutId = setTimeout(pollForChanges, interval);
                }
              } catch (error) {
                debug('Error during polling subscription:', error);
                if (isActive) {
                  observer.error(error);
                }
              }
            };
            
            // Start polling immediately
            pollForChanges();
            
            // Return unsubscribe function
            return () => {
              debug('Unsubscribing from polling subscription');
              isActive = false;
              if (timeoutId) {
                clearTimeout(timeoutId);
              }
            };
          });
        }
        
        // Otherwise use WebSocket subscription
        const generated = client.hasyxGenerator({ ...genOptions, operation: 'subscription' });
        
        return new Observable<TData>(observer => {
          const apolloSubscription = client.subscribe({
            query: gql`${generated.query}`,
            variables: generated.variables,
            context: role ? { role } : undefined,
          }).subscribe({
            next: (result: FetchResult<any>) => {
              if (result.errors) {
                debug('GraphQL errors during subscription:', result.errors);
                observer.error(new ApolloError({ graphQLErrors: result.errors }));
                return;
              }
              
              const rawData = result.data ?? null;
              
              // Extract data - for aggregate queries keep full structure, otherwise unwrap
              let extractedData: TData;
              if (genOptions.aggregate) {
                extractedData = rawData as TData;
              } else {
                extractedData = rawData?.[generated.queryName] ?? null;
                // Fallback to base table name if queryName extraction failed
                if (!extractedData && rawData?.[genOptions.table]) {
                  extractedData = rawData[genOptions.table];
                  // Handle special case for _by_pk
                  if (generated.queryName.endsWith('_by_pk') && 
                      Array.isArray(extractedData) && extractedData.length === 1) {
                    extractedData = extractedData[0];
                  } else if (generated.queryName.endsWith('_by_pk') && 
                      Array.isArray(extractedData) && extractedData.length === 0) {
                    extractedData = null as TData;
                  }
                }
              }
              
              observer.next(extractedData);
            },
            error: (error) => {
              debug('Error during subscription:', error);
              observer.error(error);
            },
            complete: () => {
              debug('Subscription completed');
              observer.complete();
            },
          });
          
          return () => {
            debug('Unsubscribing from Apollo subscription');
            apolloSubscription.unsubscribe();
          };
        });
      },
      
      useSubscription: function<TData = any, TVariables extends OperationVariables = OperationVariables>(
        generateOptions: ClientGeneratorOptions,
        hookOptions?: SubscriptionHookOptions<TData, TVariables> & { variables?: TVariables }
      ): SubscriptionResult<TData, TVariables> {
        return useSubscription(generateOptions, useMemo(() => ({ ...hookOptions, client }), [hookOptions]));
      },
      
      useQuery: function<TData = any, TVariables extends OperationVariables = OperationVariables>(
        generateOptions: ClientGeneratorOptions,
        hookOptions?: QueryHookOptions<TData, TVariables> & { variables?: TVariables }
      ): QueryResult<TData, TVariables> {
        return useQuery(generateOptions, useMemo(() => ({ ...hookOptions, client }), [hookOptions]));
      }
    };
  }, [client]);
}

// WebSocket-based implementation
function useWsSubscription<TData = any, TVariables extends OperationVariables = OperationVariables>(
  generateOptions: ClientGeneratorOptions,
  hookOptions?: SubscriptionHookOptions<TData, TVariables> & { 
    variables?: TVariables;
    pollingInterval?: number;
  }
): SubscriptionResult<TData, TVariables> {
  const apolloClient = useApolloClient();
  const client = (hookOptions?.client ?? apolloClient) as HasyxApolloClient;
  
  if (!client?.hasyxGenerator) throw new Error(`❌ useWsSubscription: No client?.hasyxGenerator found.`);

  // Generate subscription using the imported 'generate' function
  const { query: subscriptionString, variables: generatedVariables, queryName } = useMemo(() => client.hasyxGenerator({
    operation: 'subscription',
    ...generateOptions
  }), [client.hasyxGenerator, generateOptions]);

  // Ensure gql receives a string
  const subscription: DocumentNode = useMemo(() => gql`${subscriptionString}`, [subscriptionString]);

  // Combine variables from generator and hook options
  const combinedVariables = { ...generatedVariables, ...hookOptions?.variables } as TVariables;

  // Prepare arguments for the actual Apollo hook
  const { context, apolloOptions } = prepareHookArgs(hookOptions, false);

  const operationName = subscription.definitions[0]?.kind === 'OperationDefinition' 
    ? subscription.definitions[0].name?.value 
    : queryName || 'UnnamedSub';

  debug(`Executing WebSocket subscription ${operationName}`, { 
    query: subscriptionString, 
    variables: combinedVariables, 
    context, 
    options: apolloOptions 
  });

  // Cast apolloOptions to the correct type
  const typedApolloOptions = apolloOptions as Omit<ApolloSubscriptionHookOptions<TData, TVariables>, 'query' | 'variables' | 'context'>;

  const result = useApolloSubscription<any, TVariables>(subscription, {
    client,
    variables: combinedVariables,
    context,
    ...typedApolloOptions,
  });

  // Data extraction wrapper to match the behavior of class methods
  const wrappedResult = useMemo(() => {
    if (!result.data) {
      return result as SubscriptionResult<TData, TVariables>;
    }

    // Clone the result to avoid modifying the original Apollo result
    const extractedResult = { ...result };
    
    // --- Data Extraction Logic ---
    // For aggregate queries, keep the full structure
    if (generateOptions.aggregate) {
      debug(`Subscription ${operationName} keeping full structure for aggregate query`);
      extractedResult.data = result.data as TData;
    } else {
      // Extract data using queryName
      let extractedData = result.data?.[queryName] ?? null;
      
      // Fallback: If queryName extraction failed, try using the base table name
      if (!extractedData && result.data?.[generateOptions.table]) {
        debug(`Subscription ${operationName} extraction using queryName failed, falling back to base table name`);
        extractedData = result.data[generateOptions.table];
        
        // For _by_pk subscriptions returning an array with one item under the base table name
        if (queryName.endsWith('_by_pk') && Array.isArray(extractedData) && extractedData.length === 1) {
          debug(`Subscription ${operationName} fallback found array for _by_pk, extracting first element`);
          extractedData = extractedData[0];
        } else if (queryName.endsWith('_by_pk') && Array.isArray(extractedData) && extractedData.length === 0) {
          debug(`Subscription ${operationName} fallback found empty array for _by_pk, setting to null`);
          extractedData = null;
        }
      }
      
      debug(`Subscription ${operationName} extracted data:`, extractedData);
      extractedResult.data = extractedData as TData;
    }
    // --- End Data Extraction Logic ---

    return extractedResult as SubscriptionResult<TData, TVariables>;
  }, [result, queryName, operationName, generateOptions.aggregate, generateOptions.table]);

  debug(`WebSocket subscription ${operationName} result`, { 
    loading: wrappedResult.loading, 
    error: wrappedResult.error, 
    data: !!wrappedResult.data 
  });

  return wrappedResult;
}

// Polling-based subscription implementation
function usePollingSubscription<TData = any, TVariables extends OperationVariables = OperationVariables>(
  generateOptions: ClientGeneratorOptions,
  hookOptions?: SubscriptionHookOptions<TData, TVariables> & { 
    variables?: TVariables;
    pollingInterval?: number;
  }
): SubscriptionResult<TData, TVariables> {
  const apolloClient = useApolloClient() as HasyxApolloClient;
  const client = (hookOptions?.client ?? apolloClient) as HasyxApolloClient;
  
  if (!client?.hasyxGenerator) throw new Error(`❌ usePollingSubscription: No hasyxGenerator found.`);
  
  // Store the last polled data for comparison
  const lastDataRef = useRef<TData | null>(null);
  // For triggering re-renders when data changes
  const [, setForceUpdate] = useState<number>(0);
  
  // Get the queryName for data extraction
  const { queryName } = useMemo(() => client.hasyxGenerator({
    operation: 'query',
    ...generateOptions
  }), [client.hasyxGenerator, generateOptions]);

  // Use regular useQuery but with polling enabled
  const queryResult = useQuery<TData, TVariables>(
    generateOptions,
    {
      ...hookOptions,
      fetchPolicy: 'network-only', // Force fresh data
      nextFetchPolicy: 'network-only', // Keep fetching from network
      pollInterval: hookOptions?.pollingInterval || DEFAULT_POLLING_INTERVAL, // Use specified interval or default
      notifyOnNetworkStatusChange: true, // Important for detecting refetch status
    }
  );
  
  // Override the Apollo loading behavior for first fetch to match subscription behavior
  const [initialFetchDone, setInitialFetchDone] = useState(false);
  
  // Check for data changes and emulate subscription behavior
  useEffect(() => {
    if (queryResult.data) {
      if (!initialFetchDone) {
        setInitialFetchDone(true);
      }
      
      // Only trigger update if data has actually changed (deep equality check)
      if (!isEqual(queryResult.data, lastDataRef.current)) {
        lastDataRef.current = queryResult.data;
        // Force a re-render to notify listeners
        setForceUpdate(prev => prev + 1);
        
        debug('Polling subscription detected changes:', JSON.stringify(queryResult.data));
      }
    }
  }, [queryResult.data]);
  
  // Emulate subscription result structure
  return {
    ...queryResult,
    loading: !initialFetchDone && queryResult.loading, // Only show loading on initial fetch
    data: queryResult.data || null,
  } as SubscriptionResult<TData, TVariables>;
}

// Assign the appropriate implementation based on environment variable
export const useSubscription = isWsDisabled ? usePollingSubscription : useWsSubscription;

export function useQuery<TData = any, TVariables extends OperationVariables = OperationVariables>(
  generateOptions: ClientGeneratorOptions,
  hookOptions?: QueryHookOptions<TData, TVariables> & { variables?: TVariables }
): QueryResult<TData, TVariables> {
  const apolloClient = useApolloClient();
  const client = (hookOptions?.client ?? apolloClient) as HasyxApolloClient;
  
  if (!client?.hasyxGenerator) throw new Error(`❌ useQuery: No client?.hasyxGenerator found.`);
  
  // Generate query
  const { query: queryString, variables: generatedVariables, queryName } = useMemo(() => client.hasyxGenerator({
    operation: 'query',
    ...generateOptions
  }), [client.hasyxGenerator, generateOptions]);

  // Ensure gql receives a string
  const query: DocumentNode = useMemo(() => gql`${queryString}`, [queryString]);

  // Combine variables from generator and hook options
  const combinedVariables = { ...generatedVariables, ...hookOptions?.variables } as TVariables;

  // Prepare arguments for the actual Apollo hook
  const { context, apolloOptions } = prepareHookArgs(hookOptions, false);

  const operationName = query.definitions[0]?.kind === 'OperationDefinition' 
    ? query.definitions[0].name?.value 
    : queryName || 'UnnamedQuery';
    
  debug(`Executing query ${operationName}`, { 
    query: queryString, 
    variables: combinedVariables, 
    context, 
    options: apolloOptions 
  });

  const result = useApolloQuery<any, TVariables>(query, {
    client,
    variables: combinedVariables,
    context,
    ...apolloOptions,
  });

  // Data extraction wrapper to match the behavior of class methods
  const wrappedResult = useMemo(() => {
    if (!result.data) {
      return result as QueryResult<TData, TVariables>;
    }

    // Clone the result to avoid modifying the original Apollo result
    const extractedResult = { ...result };
    
    // --- Data Extraction Logic ---
    // For aggregate queries, keep the full structure
    if (generateOptions.aggregate) {
      debug(`Query ${operationName} keeping full structure for aggregate query`);
      extractedResult.data = result.data as TData;
    } else {
      // For regular queries, extract data using queryName
      const extractedData = result.data?.[queryName] ?? null;
      debug(`Query ${operationName} extracted data:`, extractedData);
      extractedResult.data = extractedData as TData;
    }
    // --- End Data Extraction Logic ---

    return extractedResult as QueryResult<TData, TVariables>;
  }, [result, queryName, operationName, generateOptions.aggregate]);

  debug(`Query ${operationName} result`, { 
    loading: wrappedResult.loading, 
    error: wrappedResult.error, 
    data: !!wrappedResult.data 
  });

  return wrappedResult;
}

export function useMutation<TData = any, TVariables extends OperationVariables = OperationVariables>(
  generateOptions: GenerateOptions,
  hookOptions?: MutationHookOptions<TData, TVariables>
): MutationTuple<TData, TVariables> {
  const apolloClient = useApolloClient();
  const client = (hookOptions?.client ?? apolloClient) as HasyxApolloClient;

  // Validate that operation is insert/update/delete
  if (!['insert', 'update', 'delete'].includes(generateOptions.operation)) {
    throw new Error(`useMutation hook requires operation to be 'insert', 'update', or 'delete' in generateOptions.`);
  }
  
  if (!client?.hasyxGenerator) throw new Error(`❌ useMutation: No client?.hasyxGenerator found.`);

  // Generate mutation
  const { query: mutationString, variables: baseVariables, queryName } = useMemo(() => 
    client.hasyxGenerator(generateOptions), [client.hasyxGenerator, generateOptions]);

  // Ensure gql receives a string
  const mutation: DocumentNode = useMemo(() => gql`${mutationString}`, [mutationString]);

  // Prepare arguments for the actual Apollo hook
  const { context, apolloOptions } = prepareHookArgs(hookOptions, true);

  const operationName = mutation.definitions[0]?.kind === 'OperationDefinition' 
    ? mutation.definitions[0].name?.value 
    : queryName || 'UnnamedMutation';
    
  debug(`Preparing mutation ${operationName}`, { 
    query: mutationString, 
    context, 
    options: apolloOptions, 
    baseVariables 
  });

  // Cast apolloOptions to the correct type
  const typedApolloOptions = apolloOptions as Omit<ApolloMutationHookOptions<TData, TVariables>, 'mutation' | 'variables' | 'context'>;

  // Variables are passed to the mutate function, not the hook itself
  const [mutate, result] = useApolloMutation<TData, TVariables>(mutation, {
    client,
    context,
    ...typedApolloOptions,
  });

  // Wrap the mutate function to add logging and base variables
  const wrappedMutate: MutationTuple<TData, TVariables>[0] = useCallback(async (mutateOptions) => {
    // Combine base variables with variables passed to this specific mutate call
    const finalVariables = { ...baseVariables, ...mutateOptions?.variables } as TVariables;
    const operationContext = mutateOptions?.context || context;

    debug(`Executing mutation ${operationName}`, {
      variables: finalVariables,
      context: operationContext,
      optimisticResponse: mutateOptions?.optimisticResponse,
      update: !!mutateOptions?.update,
    });
    
    try {
      // Pass final combined variables to the actual mutate function
      const mutationResult = await mutate({ ...mutateOptions, variables: finalVariables });
      debug(`Mutation ${operationName} success`, { data: mutationResult.data });
      return mutationResult;
    } catch(error) {
      debug(`Mutation ${operationName} error`, { error });
      throw error;
    }
  }, [mutate, operationName, context, baseVariables]);

  return [wrappedMutate, result];
}

// Aliases for convenience (Hooks)
export const useSelect = useQuery;
export const useInsert = (genOpts: Omit<GenerateOptions, 'operation'>, hookOpts?: MutationHookOptions<any, any>) =>
    useMutation({ operation: 'insert', ...genOpts }, hookOpts);
export const useUpdate = (genOpts: Omit<GenerateOptions, 'operation'>, hookOpts?: MutationHookOptions<any, any>) =>
    useMutation({ operation: 'update', ...genOpts }, hookOpts);
export const useDelete = (genOpts: Omit<GenerateOptions, 'operation'>, hookOpts?: MutationHookOptions<any, any>) =>
    useMutation({ operation: 'delete', ...genOpts }, hookOpts);
export const useSubscribe = useSubscription; 