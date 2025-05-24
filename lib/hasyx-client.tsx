"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import isEqual from 'react-fast-compare';
import {
  ApolloError,
  MutationHookOptions as ApolloMutationHookOptions,
  QueryHookOptions as ApolloQueryHookOptions,
  SubscriptionHookOptions as ApolloSubscriptionHookOptions,
  DocumentNode,
  MutationTuple,
  OperationVariables,
  QueryResult,
  SubscriptionResult,
  gql,
  useApolloClient,
  useMutation as useApolloMutation,
  useQuery as useApolloQuery, 
  useSubscription as useApolloSubscription
} from '@apollo/client';
import { HasyxApolloClient } from './apollo';
import Debug from './debug';
import { GenerateOptions, Generate } from "./generator";
import { Hasyx } from './hasyx';

const debug = Debug('client');

// Check if WebSockets are disabled via environment variable
const isWsDisabled = !+(process.env.NEXT_PUBLIC_WS || '1');

// Default polling interval for subscription polling fallback in milliseconds
const DEFAULT_POLLING_INTERVAL = 1000;

// Types
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
  const { role, pollingInterval, ...apolloOptions } = options || {};
  const context = role ? { role } : undefined;

  // Extract variables only if not a mutation (variables are passed to mutate fn)
  const variables = !isMutation && options && 'variables' in options ? options.variables as TVariables : undefined;

  debug('Preparing hook args', { role, context, variables: isMutation ? '(mutation - in mutate fn)' : variables, apolloOptions });
  return { context, variables, apolloOptions, pollingInterval };
}

// React hooks for client-side usage
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

  const query: DocumentNode = useMemo(() => gql`${queryString}`, [queryString]);
  const combinedVariables = { ...generatedVariables, ...hookOptions?.variables } as TVariables;
  const { context, apolloOptions } = prepareHookArgs(hookOptions, false);

  const result = useApolloQuery<any, TVariables>(query, {
    client,
    variables: combinedVariables,
    context,
    ...apolloOptions,
  });

  // Data extraction wrapper
  const wrappedResult = useMemo(() => {
    if (!result.data) {
      return result as QueryResult<TData, TVariables>;
    }

    const extractedResult = { ...result };
    
    if (generateOptions.aggregate) {
      extractedResult.data = result.data as TData;
    } else {
      const extractedData = result.data?.[queryName] ?? null;
      extractedResult.data = extractedData as TData;
    }

    return extractedResult as QueryResult<TData, TVariables>;
  }, [result, queryName, generateOptions.aggregate]);

  return wrappedResult;
}

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

  const { query: subscriptionString, variables: generatedVariables, queryName } = useMemo(() => client.hasyxGenerator({
    operation: 'subscription',
    ...generateOptions
  }), [client.hasyxGenerator, generateOptions]);

  const subscription: DocumentNode = useMemo(() => gql`${subscriptionString}`, [subscriptionString]);
  const combinedVariables = { ...generatedVariables, ...hookOptions?.variables } as TVariables;
  const { context, apolloOptions } = prepareHookArgs(hookOptions, false);

  const result = useApolloSubscription<any, TVariables>(subscription, {
    client,
    variables: combinedVariables,
    context,
    ...apolloOptions,
  } as any);

  // Data extraction wrapper
  const wrappedResult = useMemo(() => {
    if (!result.data) {
      return result as SubscriptionResult<TData, TVariables>;
    }

    const extractedResult = { ...result };
    
    if (generateOptions.aggregate) {
      extractedResult.data = result.data as TData;
    } else {
      let extractedData = result.data?.[queryName] ?? null;
      
      // Fallback to base table name if needed
      if (!extractedData && result.data?.[generateOptions.table]) {
        extractedData = result.data[generateOptions.table];
        
        if (queryName.endsWith('_by_pk') && Array.isArray(extractedData) && extractedData.length === 1) {
          extractedData = extractedData[0];
        } else if (queryName.endsWith('_by_pk') && Array.isArray(extractedData) && extractedData.length === 0) {
          extractedData = null as TData;
        }
      }
      
      extractedResult.data = extractedData as TData;
    }

    return extractedResult as SubscriptionResult<TData, TVariables>;
  }, [result, queryName, generateOptions.aggregate, generateOptions.table]);

  return wrappedResult;
}

function usePollingSubscription<TData = any, TVariables extends OperationVariables = OperationVariables>(
  generateOptions: ClientGeneratorOptions,
  hookOptions?: SubscriptionHookOptions<TData, TVariables> & { 
    variables?: TVariables;
    pollingInterval?: number;
  }
): SubscriptionResult<TData, TVariables> {
  const lastDataRef = useRef<TData | null>(null);
  const [, setForceUpdate] = useState<number>(0);
  const [initialFetchDone, setInitialFetchDone] = useState(false);

  const queryResult = useQuery<TData, TVariables>(
    generateOptions,
    {
      ...hookOptions,
      fetchPolicy: 'network-only',
      nextFetchPolicy: 'network-only',
      pollInterval: hookOptions?.pollingInterval || DEFAULT_POLLING_INTERVAL,
      notifyOnNetworkStatusChange: true,
    }
  );
  
  useEffect(() => {
    if (queryResult.data) {
      if (!initialFetchDone) {
        setInitialFetchDone(true);
      }
      
      if (!isEqual(queryResult.data, lastDataRef.current)) {
        lastDataRef.current = queryResult.data;
        setForceUpdate(prev => prev + 1);
      }
    }
  }, [queryResult.data, initialFetchDone]);
  
  return {
    ...queryResult,
    loading: !initialFetchDone && queryResult.loading,
    data: queryResult.data || null,
  } as SubscriptionResult<TData, TVariables>;
}

export const useSubscription = isWsDisabled ? usePollingSubscription : useWsSubscription;

export function useMutation<TData = any, TVariables extends OperationVariables = OperationVariables>(
  generateOptions: GenerateOptions,
  hookOptions?: MutationHookOptions<TData, TVariables>
): MutationTuple<TData, TVariables> {
  const apolloClient = useApolloClient();
  const client = (hookOptions?.client ?? apolloClient) as HasyxApolloClient;

  if (!['insert', 'update', 'delete'].includes(generateOptions.operation)) {
    throw new Error(`useMutation hook requires operation to be 'insert', 'update', or 'delete' in generateOptions.`);
  }
  
  if (!client?.hasyxGenerator) throw new Error(`❌ useMutation: No client?.hasyxGenerator found.`);

  const { query: mutationString, variables: baseVariables, queryName } = useMemo(() => 
    client.hasyxGenerator(generateOptions), [client.hasyxGenerator, generateOptions]);

  const mutation: DocumentNode = useMemo(() => gql`${mutationString}`, [mutationString]);
  const { context, apolloOptions } = prepareHookArgs(hookOptions, true);

  const [mutate, result] = useApolloMutation<TData, TVariables>(mutation, {
    client,
    context,
    ...apolloOptions,
  } as any);

  const wrappedMutate: MutationTuple<TData, TVariables>[0] = useCallback(async (mutateOptions) => {
    const finalVariables = { ...baseVariables, ...mutateOptions?.variables } as TVariables;
    const operationContext = mutateOptions?.context || context;

    debug(`Executing mutation ${queryName}`, {
      variables: finalVariables,
      context: operationContext,
    });
    
    const mutationResult = await mutate({ ...mutateOptions, variables: finalVariables });
    debug(`Mutation ${queryName} success`, { data: mutationResult.data });
    return mutationResult;
  }, [mutate, queryName, context, baseVariables]);

  return [wrappedMutate, result];
}

/**
 * Client-side Hasyx class that extends the base Hasyx class
 * and overrides useQuery and useSubscription methods to work properly with React hooks
 */
export class HasyxClient extends Hasyx {
  /**
   * Client-side useQuery method that works with React hooks
   * Uses the Apollo client from this instance instead of searching in React context
   */
  useQuery<TData = any, TVariables extends OperationVariables = OperationVariables>(
    generateOptions: ClientGeneratorOptions,
    hookOptions?: QueryHookOptions<TData, TVariables> & { variables?: TVariables }
  ): QueryResult<TData, TVariables> {
    return useQuery<TData, TVariables>(generateOptions, {
      ...hookOptions,
      client: this.apolloClient
    });
  }

  /**
   * Client-side useSubscription method that works with React hooks
   * Uses the Apollo client from this instance instead of searching in React context
   */
  useSubscription<TData = any, TVariables extends OperationVariables = OperationVariables>(
    generateOptions: ClientGeneratorOptions,
    hookOptions?: SubscriptionHookOptions<TData, TVariables> & { variables?: TVariables }
  ): SubscriptionResult<TData, TVariables> {
    return useSubscription<TData, TVariables>(generateOptions, {
      ...hookOptions,
      client: this.apolloClient
    });
  }
}

/**
 * Hook to get a HasyxClient instance (client-side version of Hasyx)
 * This version includes working useQuery and useSubscription methods
 */
export function useClient(providedClient?: HasyxApolloClient | null): HasyxClient {
  const apolloClient = useApolloClient();
  const client = (providedClient ?? apolloClient) as HasyxApolloClient;
  
  if (!client?.hasyxGenerator) {
    throw new Error('❌ useClient: No hasyxGenerator found on Apollo client. Ensure the client was created with createApolloClient.');
  }

  return useMemo(() => {
    return new HasyxClient(client, client.hasyxGenerator, client._options);
  }, [client, client.hasyxGenerator, client._options]);
}

// Convenience aliases
export const useSelect = useQuery;
export const useInsert = (genOpts: Omit<GenerateOptions, 'operation'>, hookOpts?: MutationHookOptions<any, any>) =>
    useMutation({ operation: 'insert', ...genOpts }, hookOpts);
export const useUpdate = (genOpts: Omit<GenerateOptions, 'operation'>, hookOpts?: MutationHookOptions<any, any>) =>
    useMutation({ operation: 'update', ...genOpts }, hookOpts);
export const useDelete = (genOpts: Omit<GenerateOptions, 'operation'>, hookOpts?: MutationHookOptions<any, any>) =>
    useMutation({ operation: 'delete', ...genOpts }, hookOpts);
export const useSubscribe = useSubscription; 