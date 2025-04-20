import {
  ApolloClient,
  ApolloError,
  ApolloQueryResult,
  FetchResult,
  gql,
  Observable,
  OperationVariables,
  getApolloContext,
  useQuery as useApolloQuery,
  useSubscription as useApolloSubscription,
} from '@apollo/client';
import React, { useContext, useMemo } from 'react';
import generate, { GenerateOptions, GenerateResult } from './generator'; // Assuming generator exports the function directly
import Debug from './debug';

const debug = Debug('nha:client');

/**
 * Represents the result structure from Apollo hooks, including potential errors.
 */
export interface HookResult<TData = any> {
  loading: boolean;
  data?: TData;
  error?: ApolloError;
  [key: string]: any; // Include other properties returned by Apollo hooks
  // Additionally expose generated query/variables for debugging or advanced use
  generatedQuery?: GenerateResult['query'];
  generatedVariables?: GenerateResult['variables'];
}

export class Client {
  private apolloClient: ApolloClient<any>;
  private generate: typeof generate;

  constructor(apolloClient: ApolloClient<any>) {
    if (!apolloClient) {
      throw new Error('❌ ApolloClient instance must be provided to the Client constructor.');
    }
    this.apolloClient = apolloClient;
    this.generate = generate; // Use the imported generator function
    debug('Client class initialized with ApolloClient instance.');
  }

  /**
   * Executes a GraphQL query (select operation).
   * @param options - Options for generating the query.
   * @returns Promise resolving with the query result data.
   * @throws ApolloError if the query fails or returns GraphQL errors.
   */
  async select<TData = any>(options: Omit<GenerateOptions, 'operation'>): Promise<TData> {
    debug('Executing select with options:', options);
    const generated = this.generate({ ...options, operation: 'query' });
    try {
      const result: ApolloQueryResult<TData> = await this.apolloClient.query({
        query: generated.query,
        variables: generated.variables,
        fetchPolicy: 'network-only', // Ensure fresh data for direct calls
      });

      if (result.errors) {
        debug('GraphQL errors during select:', result.errors);
        throw new ApolloError({ graphQLErrors: result.errors });
      }
      debug('Select successful, returning data:', result.data);
      return result.data;
    } catch (error) {
      debug('Error during select:', error);
      throw error; // Re-throw original error (could be ApolloError or network error)
    }
  }

  /**
   * Executes a GraphQL insert mutation.
   * @param options - Options for generating the mutation.
   * @returns Promise resolving with the mutation result data.
   * @throws ApolloError if the mutation fails or returns GraphQL errors.
   */
  async insert<TData = any>(options: Omit<GenerateOptions, 'operation'>): Promise<TData> {
    debug('Executing insert with options:', options);
    const generated = this.generate({ ...options, operation: 'insert' });
    try {
      const result: FetchResult<TData> = await this.apolloClient.mutate({
        mutation: generated.query,
        variables: generated.variables,
      });

      if (result.errors) {
        debug('GraphQL errors during insert:', result.errors);
        throw new ApolloError({ graphQLErrors: result.errors });
      }
      // Check if data exists, otherwise return an empty object or handle as needed
      const returnData = result.data ?? ({} as TData);
      debug('Insert successful, returning data:', returnData);
      return returnData;
    } catch (error) {
      debug('Error during insert:', error);
      throw error;
    }
  }

  /**
   * Executes a GraphQL update mutation.
   * @param options - Options for generating the mutation.
   * @returns Promise resolving with the mutation result data.
   * @throws ApolloError if the mutation fails or returns GraphQL errors.
   */
  async update<TData = any>(options: Omit<GenerateOptions, 'operation'>): Promise<TData> {
    debug('Executing update with options:', options);
    const generated = this.generate({ ...options, operation: 'update' });
    try {
      const result: FetchResult<TData> = await this.apolloClient.mutate({
        mutation: generated.query,
        variables: generated.variables,
      });

      if (result.errors) {
        debug('GraphQL errors during update:', result.errors);
        throw new ApolloError({ graphQLErrors: result.errors });
      }
      const returnData = result.data ?? ({} as TData);
      debug('Update successful, returning data:', returnData);
      return returnData;
    } catch (error) {
      debug('Error during update:', error);
      throw error;
    }
  }

  /**
   * Executes a GraphQL delete mutation.
   * @param options - Options for generating the mutation.
   * @returns Promise resolving with the mutation result data.
   * @throws ApolloError if the mutation fails or returns GraphQL errors.
   */
  async delete<TData = any>(options: Omit<GenerateOptions, 'operation'>): Promise<TData> {
    debug('Executing delete with options:', options);
    const generated = this.generate({ ...options, operation: 'delete' });
    try {
      const result: FetchResult<TData> = await this.apolloClient.mutate({
        mutation: generated.query,
        variables: generated.variables,
      });

      if (result.errors) {
        debug('GraphQL errors during delete:', result.errors);
        throw new ApolloError({ graphQLErrors: result.errors });
      }
      const returnData = result.data ?? ({} as TData);
      debug('Delete successful, returning data:', returnData);
      return returnData;
    } catch (error) {
      debug('Error during delete:', error);
      throw error;
    }
  }

  /**
   * Initiates a GraphQL subscription.
   * @param options - Options for generating the subscription.
   * @returns An Observable for the subscription results.
   */
  subscribe<TData = any, TVariables extends OperationVariables = OperationVariables>(
    options: Omit<GenerateOptions, 'operation'>
  ): Observable<FetchResult<TData>> {
    debug('Initiating subscribe with options:', options);
    const generated = this.generate({ ...options, operation: 'subscription' });
    return this.apolloClient.subscribe<TData, TVariables>({
      query: generated.query,
      variables: generated.variables as TVariables,
    });
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
export function useClient(providedClient?: ApolloClient<any> | null): ApolloClient<any> {
  const ApolloContext = getApolloContext();
  const contextValue = useContext(ApolloContext);
  const contextClient = contextValue?.client;
  const client = providedClient ?? contextClient;

  if (!client) {
    throw new Error(
      '❌ useClient: No ApolloClient instance found. Provide one directly or ensure the component is wrapped in an ApolloProvider.'
    );
  }
  return client;
}

/**
 * Hook to perform a GraphQL query using the generator.
 * @template TData - The expected data type.
 * @param options - Options for the generator (operation is automatically set to 'query').
 * @param providedClient - Optional ApolloClient instance to use instead of context.
 * @param hookOptions - Optional additional options passed directly to Apollo's useQuery hook.
 * @returns An object containing loading state, data, error, and the generated query/variables.
 */
export function useQuery<TData = any>(
  options: Omit<GenerateOptions, 'operation'>,
  providedClient?: ApolloClient<any> | null,
  hookOptions?: Omit<Parameters<typeof useApolloQuery>[1], 'variables' | 'client' | 'query'>
): HookResult<TData> {
  // Memoize generator options based on a stable string representation
  // Important: Ensure options object structure is consistent or use a deep-stable stringify
  const optionsString = useMemo(() => JSON.stringify(options), [options]);
  const memoizedOptions = useMemo(() => JSON.parse(optionsString), [optionsString]);

  const client = useClient(providedClient);
  const generated = useMemo(
    () => generate({ ...memoizedOptions, operation: 'query' }),
    [memoizedOptions] // Depend on the memoized options object
  );

  const { loading, error, data, ...rest } = useApolloQuery<TData>(generated.query, {
    client: client,
    variables: generated.variables,
    ...hookOptions, // Pass any extra hook options
  });

  // Combine Apollo results with generator info
  return { loading, error, data, ...rest, generatedQuery: generated.query, generatedVariables: generated.variables };
}

/** Alias for useQuery */
export const useSelect = useQuery;

/**
 * Hook to perform a GraphQL subscription using the generator.
 * @template TData - The expected data type.
 * @param options - Options for the generator (operation is automatically set to 'subscription').
 * @param providedClient - Optional ApolloClient instance to use instead of context.
 * @param hookOptions - Optional additional options passed directly to Apollo's useSubscription hook.
 * @returns An object containing loading state, data, error, and the generated query/variables.
 */
export function useSubscription<TData = any>(
  options: Omit<GenerateOptions, 'operation'>,
  providedClient?: ApolloClient<any> | null,
  hookOptions?: Omit<Parameters<typeof useApolloSubscription>[1], 'variables' | 'client' | 'query'>
): HookResult<TData> {
  // Memoize generator options
  const optionsString = useMemo(() => JSON.stringify(options), [options]);
  const memoizedOptions = useMemo(() => JSON.parse(optionsString), [optionsString]);

  const client = useClient(providedClient);
  const generated = useMemo(
    () => generate({ ...memoizedOptions, operation: 'subscription' }),
    [memoizedOptions]
  );

  const { loading, error, data, ...rest } = useApolloSubscription<TData>(generated.query, {
    client: client,
    variables: generated.variables,
    ...hookOptions, // Pass any extra hook options
  });

  return { loading, error, data, ...rest, generatedQuery: generated.query, generatedVariables: generated.variables };
}

/** Alias for useSubscription */
export const useSubscribe = useSubscription; 