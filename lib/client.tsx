import {
  gql,
  DocumentNode,
  QueryHookOptions as ApolloQueryHookOptions,
  SubscriptionHookOptions as ApolloSubscriptionHookOptions,
  MutationHookOptions as ApolloMutationHookOptions,
  MutationTuple,
  QueryResult,
  SubscriptionResult,
  OperationVariables,
  ApolloError,
  ApolloCache,
  DefaultContext,
  FetchPolicy,
  WatchQueryFetchPolicy,
  WatchQueryOptions,
  ApolloClient,
  NormalizedCacheObject,
  ApolloQueryResult,
  FetchResult,
  Observable,
  getApolloContext
} from '@apollo/client';
import { useMemo, useCallback, useContext } from 'react';
import { useApolloClient, useQuery as useApolloQuery, useSubscription as useApolloSubscription, useMutation as useApolloMutation } from '@apollo/client';
import Debug from './debug';
import generate, { GenerateOptions, GenerateResult } from './generator';
import { DeepPartial } from 'ts-essentials';

const debug = Debug('nha:client');

// --- Client Class ---

// Options for Client class methods, extending GenerateOptions and adding role
interface ClientMethodOptions extends Omit<GenerateOptions, 'operation'> {
  role?: string;
}

export class Client {
  private apolloClient: ApolloClient<NormalizedCacheObject>;
  private generate: typeof generate;

  constructor(apolloClient: ApolloClient<NormalizedCacheObject>) {
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
   * @returns Promise resolving with the query result data.
   * @throws ApolloError if the query fails or returns GraphQL errors.
   */
  async select<TData = any>(options: ClientMethodOptions): Promise<TData> {
    const { role, ...genOptions } = options; // Extract role
    debug('Executing select with options:', genOptions, 'Role:', role);
    const generated = this.generate({ ...genOptions, operation: 'query' });
    try {
      const result: ApolloQueryResult<TData> = await this.apolloClient.query({
        query: generated.query,
        variables: generated.variables,
        fetchPolicy: 'network-only', // Ensure fresh data for direct calls
        context: role ? { role } : undefined, // Pass role in context
      });

      if (result.errors) {
        debug('GraphQL errors during select:', result.errors);
        throw new ApolloError({ graphQLErrors: result.errors });
      }
      debug('Select successful, returning data.');
      return result.data;
    } catch (error) {
      debug('Error during select:', error);
      throw error; // Re-throw original error (could be ApolloError or network error)
    }
  }

  /**
   * Executes a GraphQL insert mutation.
   * @param options - Options for generating the mutation, including an optional `role`.
   * @returns Promise resolving with the mutation result data.
   * @throws ApolloError if the mutation fails or returns GraphQL errors.
   */
  async insert<TData = any>(options: ClientMethodOptions): Promise<TData> {
    const { role, ...genOptions } = options; // Extract role
    debug('Executing insert with options:', genOptions, 'Role:', role);
    const generated = this.generate({ ...genOptions, operation: 'insert' });
    try {
      const result: FetchResult<TData> = await this.apolloClient.mutate({
        mutation: generated.query,
        variables: generated.variables,
        context: role ? { role } : undefined, // Pass role in context
      });

      if (result.errors) {
        debug('GraphQL errors during insert:', result.errors);
        throw new ApolloError({ graphQLErrors: result.errors });
      }
      // Check if data exists, otherwise return an empty object or handle as needed
      const returnData = result.data ?? ({} as TData);
      debug('Insert successful, returning data.');
      return returnData;
    } catch (error) {
      debug('Error during insert:', error);
      throw error;
    }
  }

  /**
   * Executes a GraphQL update mutation.
   * @param options - Options for generating the mutation, including an optional `role`.
   * @returns Promise resolving with the mutation result data.
   * @throws ApolloError if the mutation fails or returns GraphQL errors.
   */
  async update<TData = any>(options: ClientMethodOptions): Promise<TData> {
    const { role, ...genOptions } = options; // Extract role
    debug('Executing update with options:', genOptions, 'Role:', role);
    const generated = this.generate({ ...genOptions, operation: 'update' });
    try {
      const result: FetchResult<TData> = await this.apolloClient.mutate({
        mutation: generated.query,
        variables: generated.variables,
        context: role ? { role } : undefined, // Pass role in context
      });

      if (result.errors) {
        debug('GraphQL errors during update:', result.errors);
        throw new ApolloError({ graphQLErrors: result.errors });
      }
      const returnData = result.data ?? ({} as TData);
      debug('Update successful, returning data.');
      return returnData;
    } catch (error) {
      debug('Error during update:', error);
      throw error;
    }
  }

  /**
   * Executes a GraphQL delete mutation.
   * @param options - Options for generating the mutation, including an optional `role`.
   * @returns Promise resolving with the mutation result data.
   * @throws ApolloError if the mutation fails or returns GraphQL errors.
   */
  async delete<TData = any>(options: ClientMethodOptions): Promise<TData> {
    const { role, ...genOptions } = options; // Extract role
    debug('Executing delete with options:', genOptions, 'Role:', role);
    const generated = this.generate({ ...genOptions, operation: 'delete' });
    try {
      const result: FetchResult<TData> = await this.apolloClient.mutate({
        mutation: generated.query,
        variables: generated.variables,
        context: role ? { role } : undefined, // Pass role in context
      });

      if (result.errors) {
        debug('GraphQL errors during delete:', result.errors);
        throw new ApolloError({ graphQLErrors: result.errors });
      }
      const returnData = result.data ?? ({} as TData);
      debug('Delete successful, returning data.');
      return returnData;
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
   * @returns An Observable for the subscription results.
   */
  subscribe<TData = any, TVariables extends OperationVariables = OperationVariables>(
    options: ClientMethodOptions
  ): Observable<FetchResult<TData>> {
    const { role, ...genOptions } = options; // Extract role
    debug('Initiating subscribe with options:', genOptions, 'Role:', role);
    const generated = this.generate({ ...genOptions, operation: 'subscription' });
    return this.apolloClient.subscribe<TData, TVariables>({
      query: generated.query,
      variables: generated.variables as TVariables,
      context: role ? { role } : undefined, // Pass role, effectiveness depends on link chain
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

/**
 * Hook to get the Apollo Client instance.
 * Prefers the explicitly provided client, falls back to context, throws if none found.
 * @param providedClient - An optional ApolloClient instance.
 * @returns The ApolloClient instance.
 * @throws Error if no client is found.
 */
export function useClient(providedClient?: ApolloClient<any> | null): Client {
  const ApolloContext = getApolloContext();
  const contextValue = useContext(ApolloContext);
  const contextClient = contextValue?.client;
  const client = providedClient ?? contextClient;

  if (!client) {
    throw new Error(
      '❌ useClient: No ApolloClient instance found. Provide one directly or ensure the component is wrapped in an ApolloProvider.'
    );
  }

  return useMemo(() => new Client(client), [client]);
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
// Omitting 'operation' as it's implied by the hook used
type ClientGeneratorOptions = Omit<GenerateOptions, 'operation'>;

// Standalone Hooks
export function useQuery<TData = any, TVariables extends OperationVariables = OperationVariables>(
  // First arg: Generator options (table, returning, where, etc.)
  generateOptions: ClientGeneratorOptions,
  // Second arg: Hook options (Apollo options + role)
  hookOptions?: QueryHookOptions<TData, TVariables> & { variables?: TVariables } // Allow variables here for query
): QueryResult<TData, TVariables> {
  const client = useApolloClient(); // Use client from context

  // Generate query using the imported 'generate' function
  const { query: queryString, variables: generatedVariables, varCounter } = useMemo(() => generate({
    operation: 'query', // Specify operation type
    ...generateOptions
  }), [generateOptions]);

  // Ensure gql receives a string
  const query: DocumentNode = useMemo(() => gql`${queryString}`, [queryString]);

  // Combine variables from generator and hook options (hook options override)
  // Cast the combined object to TVariables
  const combinedVariables = { ...generatedVariables, ...hookOptions?.variables } as TVariables;

  // Prepare arguments for the actual Apollo hook
  const { context, apolloOptions } = prepareHookArgs(hookOptions, false);

  const operationName = query.definitions[0]?.kind === 'OperationDefinition' ? query.definitions[0].name?.value || 'UnnamedQuery' : 'UnnamedQuery';
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
  generateOptions: ClientGeneratorOptions,
  // Second arg: Hook options (Apollo options + role)
  hookOptions?: SubscriptionHookOptions<TData, TVariables> & { variables?: TVariables } // Allow variables here for subscription
): SubscriptionResult<TData, TVariables> {
  const apolloClient = useApolloClient(); // Use client from context
  const client = hookOptions?.client ?? apolloClient;

  // Generate subscription using the imported 'generate' function
  const { query: subscriptionString, variables: generatedVariables, varCounter } = useMemo(() => generate({
    operation: 'subscription', // Specify operation type
    ...generateOptions
  }), [generateOptions]);

  // Ensure gql receives a string
  const subscription: DocumentNode = useMemo(() => gql`${subscriptionString}`, [subscriptionString]);

  // Combine variables from generator and hook options (hook options override)
  // Cast the combined object to TVariables
  const combinedVariables = { ...generatedVariables, ...hookOptions?.variables } as TVariables;

  // Prepare arguments for the actual Apollo hook
  const { context, apolloOptions } = prepareHookArgs(hookOptions, false);

  const operationName = subscription.definitions[0]?.kind === 'OperationDefinition' ? subscription.definitions[0].name?.value || 'UnnamedSub' : 'UnnamedSub';

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
  const client = hookOptions?.client ?? apolloClient;

  // Validate that operation is insert/update/delete
  if (!['insert', 'update', 'delete'].includes(generateOptions.operation)) {
      throw new Error(`useMutation hook requires operation to be 'insert', 'update', or 'delete' in generateOptions.`);
  }

  // Generate mutation using the imported 'generate' function
  // Variables from generateOptions are the *base* for the mutation
  const { query: mutationString, variables: baseVariables, varCounter } = useMemo(() => generate(generateOptions), [generateOptions]);

  // Ensure gql receives a string
  const mutation: DocumentNode = useMemo(() => gql`${mutationString}`, [mutationString]);

  // Prepare arguments for the actual Apollo hook (context, apolloOptions)
  // Variables are NOT prepared here, they are passed to the mutate function
  const { context, apolloOptions } = prepareHookArgs(hookOptions, true); // Pass true for isMutation

  const operationName = mutation.definitions[0]?.kind === 'OperationDefinition' ? mutation.definitions[0].name?.value || 'UnnamedMutation' : 'UnnamedMutation';
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

    debug(`Executing mutation ${operationName}`, {
        variables: finalVariables,
        context: mutateOptions?.context || context, // Use context from mutate call or default
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
        // Let the error propagate to be handled by Apollo Client / component
        throw error;
    }
  }, [mutate, operationName, context, baseVariables]); // Include baseVariables in dependency array


  debug(`Mutation ${operationName} hook state`, { loading: result.loading, error: result.error, data: result.data });

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
