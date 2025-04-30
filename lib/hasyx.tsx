import { useCreateApolloClient } from './apollo'; // Our client creation function
import { useSession } from './auth'; // Our client creation function
import { ThemeProvider } from "hasyx/components/theme-provider";
import { SessionProvider } from "next-auth/react"; // Import SessionProvider and useSession
import { useMemo } from "react";
import { Generate, GenerateOptions, GenerateResult } from "./generator";

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
  useQuery as useApolloQuery, useSubscription as useApolloSubscription
} from '@apollo/client';
import { useCallback, useContext } from 'react';
import { HasyxApolloClient } from './apollo';
import Debug from './debug';

const debug = Debug('client');

interface ClientMethodOptions extends Omit<GenerateOptions, 'operation'> {
  role?: string;
}

export class Hasyx {
  private apolloClient: HasyxApolloClient;
  private generate: Generate;

  constructor(apolloClient: HasyxApolloClient, generate: Generate) {
    if (!apolloClient) {
      throw new Error('❌ ApolloClient instance must be provided to the Client constructor.');
    }
    this.apolloClient = apolloClient;
    this.generate = generate; // Use the imported generator function
    debug('Client class initialized with ApolloClient instance.');
  }

  /**
   * Executes a GraphQL query (select operation).
   * @param options - Options for generating the query, including an optional `role`.
   * @returns Promise resolving with the query result data (unwrapped from the top-level key, e.g., the array or single object), except for aggregate queries which return the full `{ aggregate, nodes }` structure.
   * @throws ApolloError if the query fails or returns GraphQL errors.
   */
  async select<TData = any>(options: ClientMethodOptions): Promise<TData> {
    const { role, ...genOptions } = options; // Extract role
    debug('Executing select with options:', genOptions, 'Role:', role);
    const generated: GenerateResult = this.generate({ ...genOptions, operation: 'query' });
    try {
      const result: ApolloQueryResult<any> = await this.apolloClient.query({ // Use any for intermediate result
        query: generated.query,
        variables: generated.variables,
        fetchPolicy: 'network-only', // Ensure fresh data for direct calls
        context: role ? { role } : undefined, // Pass role in context
      });

      if (result.errors) {
        debug('GraphQL errors during select:', result.errors);
        throw new ApolloError({ graphQLErrors: result.errors });
      }
      debug('Select successful, raw data:', result.data);

      // --- Data Extraction Logic ---
      // Keep full structure for aggregate queries
      if (genOptions.aggregate) {
          return result.data as TData;
      }
      // Extract data using the queryName from generator
      const extractedData = result.data?.[generated.queryName] ?? null;
      debug('Select extracted data:', extractedData);
      return extractedData as TData;
      // --- End Extraction Logic ---

    } catch (error) {
      debug('Error during select:', error);
      throw error; // Re-throw original error (could be ApolloError or network error)
    }
  }

  /**
   * Executes a GraphQL insert mutation.
   * @param options - Options for generating the mutation, including an optional `role`.
   * @returns Promise resolving with the mutation result data. For single inserts (`insert_table_one`), returns the inserted object. For bulk inserts, returns the full `{ affected_rows, returning }` object.
   * @throws ApolloError if the mutation fails or returns GraphQL errors.
   */
  async insert<TData = any>(options: ClientMethodOptions): Promise<TData> {
    const { role, ...genOptions } = options; // Extract role
    debug('Executing insert with options:', genOptions, 'Role:', role);
    const generated: GenerateResult = this.generate({ ...genOptions, operation: 'insert' });
    try {
      const result: FetchResult<any> = await this.apolloClient.mutate({ // Use any for intermediate result
        mutation: generated.query,
        variables: generated.variables,
        context: role ? { role } : undefined, // Pass role in context
      });

      if (result.errors) {
        debug('GraphQL errors during insert:', result.errors);
        throw new ApolloError({ graphQLErrors: result.errors });
      }
      const rawData = result.data ?? {};
      debug('Insert successful, raw data:', rawData);

      // --- Data Extraction Logic ---
      // Keep full structure for bulk inserts (returning { affected_rows, returning }) 
      // Check if it looks like a bulk response based on queryName AND presence of affected_rows/returning
      const isBulkInsert = !generated.queryName.endsWith('_one') && ('affected_rows' in rawData || 'returning' in rawData);
      if (isBulkInsert) {
          debug('Insert identified as bulk, returning full data object.');
          return rawData as TData;
      } else {
          // Extract data for single inserts (insert_table_one returns the object directly)
          const extractedData = rawData?.[generated.queryName] ?? null;
          debug('Insert identified as single, returning extracted data:', extractedData);
          return extractedData as TData;
      }
      // --- End Extraction Logic ---

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
  async update<TData = any>(options: ClientMethodOptions): Promise<TData> {
    const { role, ...genOptions } = options; // Extract role
    debug('Executing update with options:', genOptions, 'Role:', role);
    const generated: GenerateResult = this.generate({ ...genOptions, operation: 'update' });
    try {
      const result: FetchResult<any> = await this.apolloClient.mutate({ // Use any for intermediate result
        mutation: generated.query,
        variables: generated.variables,
        context: role ? { role } : undefined, // Pass role in context
      });

      if (result.errors) {
        debug('GraphQL errors during update:', result.errors);
        throw new ApolloError({ graphQLErrors: result.errors });
      }
      const rawData = result.data ?? {};
      debug('Update successful, raw data:', rawData);

      // --- Data Extraction Logic ---
      // Keep full structure for bulk updates (returning { affected_rows, returning })
      const isBulkUpdate = !generated.queryName.endsWith('_by_pk') && ('affected_rows' in rawData || 'returning' in rawData);
      if (isBulkUpdate) {
          debug('Update identified as bulk, returning full data object.');
          return rawData as TData;
      } else {
          // Extract data for single updates (update_table_by_pk returns the object directly)
          const extractedData = rawData?.[generated.queryName] ?? null;
          debug('Update identified as single (_by_pk), returning extracted data:', extractedData);
          return extractedData as TData;
      }
      // --- End Extraction Logic ---

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
  async delete<TData = any>(options: ClientMethodOptions): Promise<TData> {
    const { role, ...genOptions } = options; // Extract role
    debug('Executing delete with options:', genOptions, 'Role:', role);
    const generated: GenerateResult = this.generate({ ...genOptions, operation: 'delete' });
    try {
      const result: FetchResult<any> = await this.apolloClient.mutate({ // Use any for intermediate result
        mutation: generated.query,
        variables: generated.variables,
        context: role ? { role } : undefined, // Pass role in context
      });

      if (result.errors) {
        debug('GraphQL errors during delete:', result.errors);
        throw new ApolloError({ graphQLErrors: result.errors });
      }
      const rawData = result.data ?? {};
      debug('Delete successful, raw data:', rawData);

      // --- Data Extraction Logic ---
      // Keep full structure for bulk deletes (returning { affected_rows, returning })
      const isBulkDelete = !generated.queryName.endsWith('_by_pk') && ('affected_rows' in rawData || 'returning' in rawData);
      if (isBulkDelete) {
          debug('Delete identified as bulk, returning full data object.');
          return rawData as TData;
      } else {
          // Extract data for single deletes (delete_table_by_pk returns the object directly)
          const extractedData = rawData?.[generated.queryName] ?? null;
          debug('Delete identified as single (_by_pk), returning extracted data:', extractedData);
          return extractedData as TData;
      }
      // --- End Extraction Logic ---

    } catch (error) {
      debug('Error during delete:', error);
      throw error;
    }
  }

  /**
   * Initiates a GraphQL subscription.
   * Note: Role support via context might not work for WebSockets depending on Apollo Link setup.
   * Role is typically set during WebSocket connection establishment.
   * @param options - Options for generating the subscription, including an optional `role`.
   * @returns An Observable for the subscription results, emitting the unwrapped data directly (e.g., the array or single object), except for aggregate subscriptions which emit the full `{ aggregate, nodes }` structure.
   */
  subscribe<TData = any, TVariables extends OperationVariables = OperationVariables>(
    options: ClientMethodOptions
  ): Observable<TData> {
    const { role, ...genOptions } = options; // Extract role
    debug('Initiating subscribe with options:', genOptions, 'Role:', role);
    const generated: GenerateResult = this.generate({ ...genOptions, operation: 'subscription' });

    // Create a new Observable to wrap the Apollo subscription
    return new Observable<TData>(observer => {
      // Subscribe to the actual Apollo client subscription
      const apolloSubscription = this.apolloClient.subscribe<any, TVariables>({ // Use <any> for raw FetchResult
        query: generated.query,
        variables: generated.variables as TVariables,
        context: role ? { role } : undefined,
      }).subscribe({
        next: (result: FetchResult<any>) => {
          if (result.errors) {
            debug('GraphQL errors during subscription:', result.errors);
            // Forward ApolloError to the observer
            observer.error(new ApolloError({ graphQLErrors: result.errors }));
            return;
          }
          const rawData = result.data ?? null; // Use null if no data
          debug('Subscription received raw data:', JSON.stringify(rawData));
          debug('Subscription expected queryName:', generated.queryName);

          // --- Data Extraction Logic ---
          let extractedData: TData;
          // Keep full structure for aggregate queries
          if (genOptions.aggregate) {
            debug('Subscription is aggregate, returning raw data.');
            extractedData = rawData as TData;
          } else {
            // Extract data using the queryName from generator
            extractedData = rawData?.[generated.queryName] ?? null;
            // Fallback: If queryName extraction failed, try using the base table name
            if (!extractedData && rawData?.[genOptions.table]) {
                debug(`Subscription extracted data using queryName ('${generated.queryName}') failed, falling back to base table name ('${genOptions.table}').`);
                extractedData = rawData[genOptions.table];
                 // For _by_pk subscriptions returning an array with one item under the base table name
                 if (generated.queryName.endsWith('_by_pk') && Array.isArray(extractedData) && extractedData.length === 1) {
                     debug(`Subscription fallback found array for _by_pk, extracting first element.`);
                     extractedData = extractedData[0];
                 } else if (generated.queryName.endsWith('_by_pk') && Array.isArray(extractedData) && extractedData.length === 0) {
                     debug(`Subscription fallback found empty array for _by_pk, setting to null.`);
                     extractedData = null as TData; // Cast null to TData
                 } else {
                  debug('Subscription extracted data using queryName:', JSON.stringify(extractedData));
                 }
            } else {
              debug('Subscription extracted data using queryName:', JSON.stringify(extractedData));
            }
          }
          debug('Subscription emitting final extracted data:', JSON.stringify(extractedData));
          observer.next(extractedData); // Emit the extracted data
          // --- End Extraction Logic ---
        },
        error: (error) => {
          debug('Error during subscription:', error);
          observer.error(error); // Forward the error
        },
        complete: () => {
          debug('Subscription completed.');
          observer.complete(); // Forward the completion
        },
      });

      // Return the unsubscribe function
      return () => {
        debug('Unsubscribing from Apollo subscription.');
        apolloSubscription.unsubscribe();
      };
    });
  }

  useSubscription<TData = any, TVariables extends OperationVariables = OperationVariables>(
    // First arg: Generator options (table, returning, where, etc.)
    generateOptions: ClientGeneratorOptions,
    // Second arg: Hook options (Apollo options + role)
    hookOptions?: SubscriptionHookOptions<TData, TVariables> & { variables?: TVariables } // Allow variables here for subscription
  ): SubscriptionResult<TData, TVariables> {
    return useSubscription(generateOptions, useMemo(() => ({ ...hookOptions, client: this.apolloClient }), [hookOptions]));
  };

  useQuery<TData = any, TVariables extends OperationVariables = OperationVariables>(
    // First arg: Generator options (table, returning, where, etc.)
    generateOptions: ClientGeneratorOptions,
    // Second arg: Hook options (Apollo options + role)
    hookOptions?: QueryHookOptions<TData, TVariables> & { variables?: TVariables } // Allow variables here for query
  ): QueryResult<TData, TVariables> {
    return useQuery(generateOptions, useMemo(() => ({ ...hookOptions, client: this.apolloClient }), [hookOptions]));
  }
}

// --- React Hooks ---

interface GenerateContextInterface { schema: any, generate: Generate };

/**
 * Hook to get the Apollo Client instance.
 * Prefers the explicitly provided client, falls back to context, throws if none found.
 * @param providedClient - An optional ApolloClient instance.
 * @returns The ApolloClient instance.
 * @throws Error if no client is found.
 */
export function useClient(providedClient?: HasyxApolloClient | null): Hasyx {
  const ApolloContext = getApolloContext();
  const contextValue = useContext(ApolloContext);
  const contextClient = contextValue?.client;
  const client = (providedClient ?? contextClient) as HasyxApolloClient;
  if (!client?.hasyxGenerator) throw new Error(`❌ useClient: No client?.hasyxGenerator found.`);

  return useMemo(() => new Hasyx(client as HasyxApolloClient, client?.hasyxGenerator), [client, client?.hasyxGenerator]);
}

// Custom Hook Options extending Apollo's, adding our 'role' context
type BaseHookOptions = {
  role?: string;
};

// Add 'extends OperationVariables' constraint
type QueryHookOptions<TData, TVariables extends OperationVariables> = BaseHookOptions & Omit<ApolloQueryHookOptions<TData, TVariables>, 'query' | 'variables' | 'context'>;
// Add 'extends OperationVariables' constraint
type SubscriptionHookOptions<TData, TVariables extends OperationVariables> = BaseHookOptions & Omit<ApolloSubscriptionHookOptions<TData, TVariables>, 'query' | 'variables' | 'context'>;
// Add 'extends OperationVariables' constraint
type MutationHookOptions<TData, TVariables extends OperationVariables> = BaseHookOptions & Omit<ApolloMutationHookOptions<TData, TVariables>, 'mutation' | 'variables' | 'context'>;

// Helper to extract Apollo options and context for HOOKS
// Adjusted to not expect variables in mutation options directly
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

// Type for the first argument of the hooks (Generator options)
// This now correctly inherits from GenerateOptions (including distinct_on)
// Omitting 'operation' as it's implied by the hook used or passed explicitly to useMutation
type ClientGeneratorOptions = Omit<GenerateOptions, 'operation'>;

// Standalone Hooks using the context client
export function useQuery<TData = any, TVariables extends OperationVariables = OperationVariables>(
  // First arg: Generator options (table, returning, where, etc.)
  generateOptions: ClientGeneratorOptions, // Uses the updated type
  // Second arg: Hook options (Apollo options + role)
  hookOptions?: QueryHookOptions<TData, TVariables> & { variables?: TVariables } // Allow variables here for query
): QueryResult<TData, TVariables> {
  const apolloClient = useApolloClient(); // Use client from context
  const client = (hookOptions?.client ?? apolloClient) as HasyxApolloClient;
  if (!client?.hasyxGenerator) throw new Error(`❌ useQuery: No client?.hasyxGenerator found.`);
  // Generate query using the imported 'generate' function
  const { query: queryString, variables: generatedVariables, queryName } = useMemo(() => client.hasyxGenerator({
    operation: 'query', // Specify operation type
    ...generateOptions
  }), [client.hasyxGenerator, generateOptions]); // Add client.hasyxGenerator to dependencies

  // Ensure gql receives a string
  const query: DocumentNode = useMemo(() => gql`${queryString}`, [queryString]);

  // Combine variables from generator and hook options (hook options override)
  // Cast the combined object to TVariables
  const combinedVariables = { ...generatedVariables, ...hookOptions?.variables } as TVariables;

  // Prepare arguments for the actual Apollo hook
  const { context, apolloOptions } = prepareHookArgs(hookOptions, false);

  const operationName = query.definitions[0]?.kind === 'OperationDefinition' ? query.definitions[0].name?.value : queryName || 'UnnamedQuery'; // Use queryName as fallback
  debug(`Executing query ${operationName}`, { query: queryString, variables: combinedVariables, context, options: apolloOptions });

  const result = useApolloQuery<TData, TVariables>(query, {
    client, // Pass the client explicitly if needed by useApolloQuery, though usually context is enough
    variables: combinedVariables,
    context, // Pass role via context
    ...apolloOptions,
  });

  debug(`Query ${operationName} result`, { loading: result.loading, error: result.error, data: !!result.data });

  return result;
}

export function useSubscription<TData = any, TVariables extends OperationVariables = OperationVariables>(
  // First arg: Generator options (table, returning, where, etc.)
  generateOptions: ClientGeneratorOptions, // Uses the updated type
  // Second arg: Hook options (Apollo options + role)
  hookOptions?: SubscriptionHookOptions<TData, TVariables> & { variables?: TVariables } // Allow variables here for subscription
): SubscriptionResult<TData, TVariables> {
  const apolloClient = useApolloClient(); // Use client from context
  const client = (hookOptions?.client ?? apolloClient) as HasyxApolloClient;
  if (!client?.hasyxGenerator) throw new Error(`❌ useSubscription: No client?.hasyxGenerator found.`);

  // Generate subscription using the imported 'generate' function
  const { query: subscriptionString, variables: generatedVariables, queryName } = useMemo(() => client.hasyxGenerator({
    operation: 'subscription', // Specify operation type
    ...generateOptions
  }), [client.hasyxGenerator, generateOptions]); // Add client.hasyxGenerator to dependencies

  // Ensure gql receives a string
  const subscription: DocumentNode = useMemo(() => gql`${subscriptionString}`, [subscriptionString]);

  // Combine variables from generator and hook options (hook options override)
  // Cast the combined object to TVariables
  const combinedVariables = { ...generatedVariables, ...hookOptions?.variables } as TVariables;

  // Prepare arguments for the actual Apollo hook
  const { context, apolloOptions } = prepareHookArgs(hookOptions, false);

  const operationName = subscription.definitions[0]?.kind === 'OperationDefinition' ? subscription.definitions[0].name?.value : queryName || 'UnnamedSub'; // Use queryName as fallback

  // Note: WebSocketLink in apollo.tsx might not support dynamic context/role per subscription easily.
  // The role set via context here primarily affects the initial HTTP request if applicable,
  // or needs custom WebSocket handling if role must change mid-subscription.
  debug(`Executing subscription ${operationName}`, { query: subscriptionString, variables: combinedVariables, context, options: apolloOptions });

  // Explicitly cast apolloOptions to the correct type expected by useApolloSubscription
  const typedApolloOptions = apolloOptions as Omit<ApolloSubscriptionHookOptions<TData, TVariables>, 'query' | 'variables' | 'context'>;


  const result = useApolloSubscription<TData, TVariables>(subscription, {
    client, // Pass the client explicitly if needed
    variables: combinedVariables,
    context, // Pass context for potential role setting (might depend on WSLink implementation)
    ...(typedApolloOptions), // Spread the typed options
  });

  debug(`Subscription ${operationName} result`, { loading: result.loading, error: result.error, data: !!result.data });

  return result;
}

export function useMutation<TData = any, TVariables extends OperationVariables = OperationVariables>(
  // First arg: Generator options (MUST include operation: 'insert' | 'update' | 'delete')
  generateOptions: GenerateOptions, // Use full GenerateOptions for mutations
  // Second arg: Hook options (Apollo options + role)
  hookOptions?: MutationHookOptions<TData, TVariables>
): MutationTuple<TData, TVariables> {
  const apolloClient = useApolloClient(); // Use client from context
  const client = (hookOptions?.client ?? apolloClient) as HasyxApolloClient;

  // Validate that operation is insert/update/delete
  if (!['insert', 'update', 'delete'].includes(generateOptions.operation)) {
      throw new Error(`useMutation hook requires operation to be 'insert', 'update', or 'delete' in generateOptions.`);
  }
  if (!client?.hasyxGenerator) throw new Error(`❌ useMutation: No client?.hasyxGenerator found.`);

  // Generate mutation using the imported 'generate' function
  // Variables from generateOptions are the *base* for the mutation
  const { query: mutationString, variables: baseVariables, queryName } = useMemo(() => client.hasyxGenerator(generateOptions), [client.hasyxGenerator, generateOptions]); // Add client.hasyxGenerator to dependencies

  // Ensure gql receives a string
  const mutation: DocumentNode = useMemo(() => gql`${mutationString}`, [mutationString]);

  // Prepare arguments for the actual Apollo hook (context, apolloOptions)
  // Variables are NOT prepared here, they are passed to the mutate function
  const { context, apolloOptions } = prepareHookArgs(hookOptions, true); // Pass true for isMutation

  const operationName = mutation.definitions[0]?.kind === 'OperationDefinition' ? mutation.definitions[0].name?.value : queryName || 'UnnamedMutation'; // Use queryName as fallback
  debug(`Preparing mutation ${operationName}`, { query: mutationString, context, options: apolloOptions, baseVariables });

  // Explicitly cast apolloOptions to the correct type expected by useApolloMutation
  const typedApolloOptions = apolloOptions as Omit<ApolloMutationHookOptions<TData, TVariables>, 'mutation' | 'variables' | 'context'>;


  // Variables are passed to the mutate function, not the hook itself usually
  const [mutate, result] = useApolloMutation<TData, TVariables>(mutation, {
    client, // Pass the client explicitly if needed
    context, // Pass context for role setting
    ...(typedApolloOptions), // Spread the typed options
    // variables: baseVariables // DO NOT set base variables here by default
  });

  // Wrap the mutate function to potentially add logging or other logic
  const wrappedMutate: MutationTuple<TData, TVariables>[0] = useCallback(async (mutateOptions) => {
    // Combine base variables from generator with variables passed to this specific mutate call
    // Cast the combined object to TVariables
    const finalVariables = { ...baseVariables, ...mutateOptions?.variables } as TVariables;
    const operationContext = mutateOptions?.context || context; // Use context from mutate call or default

    debug(`Executing mutation ${operationName}`, {
        variables: finalVariables,
        context: operationContext, // Use combined context
        optimisticResponse: mutateOptions?.optimisticResponse,
        update: !!mutateOptions?.update,
      });
    try {
        // Pass final combined variables to the actual mutate function
        const mutationResult = await mutate({ ...mutateOptions, variables: finalVariables });
        debug(`Mutation ${operationName} success`, { data: mutationResult.data }); // Log returned data
        // We don't modify the returned result here for hooks
        return mutationResult;
    } catch(error) {
        debug(`Mutation ${operationName} error`, { error });
        // Let the error propagate to be handled by Apollo Client / component
        throw error;
    }
  }, [mutate, operationName, context, baseVariables]); // Include baseVariables in dependency array


  // debug(`Mutation ${operationName} hook state`, { loading: result.loading, error: result.error, data: result.data }); // Keep this commented or remove, potentially noisy

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

function HasyxProviderCore({ url, children, generate }: { url?: string, children: React.ReactNode, generate: Generate }) {
  const { data: session } = useSession(); // Get session
  
  const client = useCreateApolloClient(useMemo(() => {
    let apiUrl = '/api/graphql'; // Default relative path
    if (url) {
      apiUrl = url;
    } else if (process.env.NEXT_PUBLIC_BUILD_TARGET === 'client') {
      const mainUrl = process.env.NEXT_PUBLIC_MAIN_URL || 'http://localhost:3000';
      // Use URL constructor for robust path joining
      try {
        const base = new URL(mainUrl);
        const combinedUrl = new URL('/api/graphql', base); // Relative path resolved against base
        apiUrl = combinedUrl.toString();
        debug(`Constructed absolute apiUrl for client build: ${apiUrl}`);
      } catch (e) {
         console.error(`❌ Invalid URL provided for NEXT_PUBLIC_MAIN_URL: ${mainUrl}`, e);
         debug(`Invalid URL provided for NEXT_PUBLIC_MAIN_URL: ${mainUrl}`, e);
         // Fallback to relative path or handle error appropriately
         apiUrl = '/api/graphql'; 
      }
    }
    
    return {
      url: apiUrl,
      token: session?.accessToken, // Pass Hasura token from session
      ws: true // Enable WebSocket support
    };
  }, [session, url])); // Include url in dependencies
  
  client.hasyxGenerator = generate;

  return <client.Provider>
    {children}
  </client.Provider>;
}

export function HasyxProvider({ children, generate }: { children: React.ReactNode, generate: Generate }) {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <HasyxProviderCore generate={generate}>
          {children}
        </HasyxProviderCore>  
      </ThemeProvider>
    </SessionProvider>
  );
}
