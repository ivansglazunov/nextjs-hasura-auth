import { DocumentNode } from '@apollo/client/core';
export type GenerateOperation = 'query' | 'subscription' | 'insert' | 'update' | 'delete';
export interface GenerateOptions {
    operation: GenerateOperation;
    table: string;
    where?: Record<string, any>;
    returning?: (string | Record<string, any>)[];
    aggregate?: Record<string, any>;
    object?: Record<string, any>;
    objects?: Record<string, any>[];
    pk_columns?: Record<string, any>;
    _set?: Record<string, any>;
    limit?: number;
    offset?: number;
    order_by?: Record<string, any>[] | Record<string, any>;
    fragments?: string[];
    variables?: Record<string, any>;
    varCounter?: number;
}
export interface GenerateResult {
    queryString: string;
    query: DocumentNode;
    variables: Record<string, any>;
    varCounter: number;
}
/**
 * Creates a GraphQL query generator based on the provided schema.
 *
 * @param schema - The GraphQL schema in schema.json format.
 * @returns A function to generate queries.
 */
export declare function Generator(schema: any): (opts: GenerateOptions) => GenerateResult;
export default Generator;
