// @ts-ignore
import schema from '../public/hasura-schema.json'; // Assuming public/hasura-schema.json is in the same directory
import Debug from './debug';

// @ts-ignore // Assuming debug.js is moved to lib/debug.ts or similar and returns a function
const debug = Debug('apollo:generator');

import { gql, DocumentNode } from '@apollo/client/core'; // Use core for gql

// Types for options and return value
export type GenerateOperation = 'query' | 'subscription' | 'insert' | 'update' | 'delete';

export interface GenerateOptions {
  operation: GenerateOperation;
  table: string;
  where?: Record<string, any>;
  // Allow array, object (for appending), or string (legacy split)
  returning?: (string | Record<string, any>)[] | Record<string, any> | string; 
  aggregate?: Record<string, any>;
  object?: Record<string, any>;
  objects?: Record<string, any>[];
  pk_columns?: Record<string, any>;
  _set?: Record<string, any>;
  limit?: number;
  offset?: number;
  order_by?: Record<string, any>[] | Record<string, any>;
  fragments?: string[];
  variables?: Record<string, any>; // Keep flexible for now
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
 * @param schema - The GraphQL schema in public/hasura-schema.json format.
 * @returns A function to generate queries.
 */
export function Generator(schema: any) { // TODO: Define a more specific type for the schema
  // Check schema structure
  if (!schema || !schema.first_level_queries) {
    throw new Error('❌ Invalid schema format. Schema must contain first_level_queries field');
  }

  /**
   * Generates a GraphQL query based on the provided options.
   *
   * @param opts - Options object for query generation.
   * @returns The GraphQL query, variables, and current variable counter.
   */
  return function generate(opts: GenerateOptions): GenerateResult {
    let varCounter = opts.varCounter || 1;

    if (!opts || !opts.operation || !opts.table) {
      throw new Error('❌ operation and table must be specified in options');
    }

    const { operation, table } = opts;
    const where = opts.where || null;
    const returning = opts.returning || null;
    const aggregate = opts.aggregate || null;
    const fragments = opts.fragments || [];

    const validOperations: GenerateOperation[] = ['query', 'subscription', 'insert', 'update', 'delete'];
    if (!validOperations.includes(operation)) {
      throw new Error(`❌ Invalid operation type: ${operation}. Allowed types: ${validOperations.join(', ')}`);
    }

    let tableName = table;
    let schemaSection = 'first_level_queries';

    if (aggregate && operation === 'query') {
      tableName = `${table}_aggregate`;
    }

    if (operation === 'query') {
      schemaSection = 'first_level_queries';
    } else if (operation === 'subscription') {
      schemaSection = 'subscriptions';
    } else if (['insert', 'update', 'delete'].includes(operation)) {
      schemaSection = 'mutations';
      if (operation === 'insert') {
        tableName = `insert_${table}`;
      } else if (operation === 'update') {
        // Handle _by_pk update separately later
        // tableName = `update_${table}`; // Keep original table for now
      } else if (operation === 'delete') {
         // Handle _by_pk delete separately later
        // tableName = `delete_${table}`; // Keep original table for now
      }
    }

     if (!schema[schemaSection]) {
      throw new Error(`❌ Schema section ${schemaSection} not found. Schema might be outdated or incorrect.`);
    }

    // Special handling for update/delete by pk
    let isByPkOperation = false;
    if (['update', 'delete'].includes(operation) && opts.pk_columns) {
        isByPkOperation = true;
        tableName = `${operation}_${table}_by_pk`; // e.g., update_users_by_pk
    } else if (operation === 'query' && opts.pk_columns) {
        isByPkOperation = true;
        tableName = `${table}_by_pk`; // e.g., users_by_pk
    } else if (operation === 'insert' && opts.object && !opts.objects) {
        // Try to find insert_table_one mutation
        const oneMutationName = `insert_${table}_one`;
        if (schema.mutations && schema.mutations[oneMutationName]) {
            tableName = oneMutationName;
            isByPkOperation = true; // Treat insert_one like a by_pk operation for simplicity
        } else {
            tableName = `insert_${table}`; // Fallback to regular insert
        }
    } else if (operation === 'insert') {
         tableName = `insert_${table}`;
    } else if (operation === 'update') {
         tableName = `update_${table}`;
    } else if (operation === 'delete') {
         tableName = `delete_${table}`;
    }
    // If not by_pk, and it's a query/sub, keep the original table name for non-aggregate
    else if (['query', 'subscription'].includes(operation) && !aggregate) {
        tableName = table;
    }
    // If it's an aggregate query
    else if (operation === 'query' && aggregate) {
        tableName = `${table}_aggregate`;
    }


    const possibleQueries = Object.keys(schema[schemaSection]);
    let queryName = possibleQueries.find(q => q === tableName);


    // Fallback logic if specific query (like insert_table_one) wasn't found directly
    if (!queryName) {
        // General fallback: find first matching query
        queryName = possibleQueries.find(q => q.includes(table)) || possibleQueries[0];
        if (!queryName) {
             throw new Error(`❌ Query/Mutation/Subscription for table "${table}" not found in schema section "${schemaSection}"`);
        }
         console.log(`[generator] ⚠️ Could not find exact query name "${tableName}", using fallback "${queryName}"`);
    }


    const queryInfo = schema[schemaSection][queryName];
    if (!queryInfo) {
      throw new Error(`❌ Query info for "${queryName}" not found in schema section "${schemaSection}"`);
    }


    const queryArgs: string[] = [];
    const variables: Record<string, any> = {};
    const varParts: string[] = [];

    // Helper function with improved required logic
    const getGqlType = (argName: string, argSchema: any, value: any, defaultType: string = 'String', forceRequired: boolean = false): string => {
        let typeName = argSchema?.type || defaultType;
        let isList = argSchema?.isList || false; // Rely more on schema or explicit checks
        let isRequired = forceRequired || argSchema?.isRequired || false;

        // Check type name conventions first (e.g., from introspection)
        if (typeof typeName === 'string') {
            let baseTypeName = typeName;
            if (baseTypeName.endsWith('!')) {
                 isRequired = true;
                 baseTypeName = baseTypeName.slice(0, -1);
             }
             if (baseTypeName.startsWith('[') && baseTypeName.endsWith(']')) {
                 isList = true;
                 baseTypeName = baseTypeName.slice(1, -1);
                 // Check for inner required type e.g., [String!]
                 if (baseTypeName.endsWith('!')) {
                     // Mark inner as required if needed? (Handled later for known types)
                     baseTypeName = baseTypeName.slice(0, -1);
                 }
             }
             typeName = baseTypeName;
        }

        // Determine list/required based on arg name conventions
        const baseTable = table; // Use original table name for type conventions
        let finalType = typeName;
        let finalIsRequired = isRequired;
        let finalIsList = isList;
        let innerRequired = false;

        // Apply conventions/overrides
        if (argName === 'objects') { finalType = `${baseTable}_insert_input`; finalIsList = true; finalIsRequired = true; innerRequired = true; }
        if (argName === 'object') { finalType = `${baseTable}_insert_input`; finalIsList = false; finalIsRequired = true; }
        if (argName === 'order_by') { finalType = `${baseTable}_order_by`; finalIsList = true; finalIsRequired = false; innerRequired = true; } // List itself not required, but inner usually is
        if (argName === 'pk_columns') { finalType = `${baseTable}_pk_columns_input`; finalIsList = false; finalIsRequired = true; }
        if (argName === '_set') { finalType = `${baseTable}_set_input`; finalIsList = false; finalIsRequired = true; }
        if (argName === 'where') { finalType = `${baseTable}_bool_exp`; finalIsList = false; finalIsRequired = false; }
        
        // If it's a direct PK arg (like `id` in `users_by_pk(id: uuid!)`)
        if (forceRequired) { 
            finalIsRequired = true; 
            finalIsList = false; // Direct PK args are typically not lists
        }

        // Construct the final type string
        let typeString = finalType;
        if (finalIsList) {
            typeString = `[${finalType}${innerRequired ? '!' : ''}]`;
        }
        if (finalIsRequired) {
            typeString += '!';
        }

        return typeString;
    };

    // Argument processing function (now relies on getGqlType for correctness)
    const processArg = (argName: string, value: any, argSchema: any, isDirectPk: boolean = false) => {
        if (value === undefined || value === null) return;
        const varName = `v${varCounter++}`;
        queryArgs.push(`${argName}: $${varName}`);
        variables[varName] = value;
        const gqlType = getGqlType(argName, argSchema, value, 'String', isDirectPk);
        varParts.push(`$${varName}: ${gqlType}`);
    };

    // --- Argument Processing with deterministic order --- 
    const argProcessingOrder = [
        // Common args first
        'where',
        // PK args (direct or pk_columns object)
        ...(isByPkOperation && opts.pk_columns ? Object.keys(opts.pk_columns) : []), // Direct PK args like 'id'
        'pk_columns', // The pk_columns input object itself
        // Mutation specific
        '_set', 
        'objects', 
        'object', 
        // Pagination/Sorting
        'limit', 
        'offset',
        'order_by'
    ];

    const processedArgs = new Set<string>();

    // Process args in defined order
    for (const argName of argProcessingOrder) {
        if (!queryInfo.args || !queryInfo.args[argName]) continue; // Skip if arg not in schema
        if (processedArgs.has(argName)) continue; 

        const argSchema = queryInfo.args[argName];
        let value: any = undefined;
        let isDirectPk = false;

        // Map opts to schema args
        if (argName === 'pk_columns' && opts.pk_columns) {
             // Process this ONLY if the operation expects pk_columns (update_by_pk)
             if (operation === 'update') { 
                 value = opts.pk_columns;
             } else {
                 // For query_by_pk and delete_by_pk, pk_columns is used to find direct args
                 continue; // Skip processing pk_columns itself here
             }
        } else if (argName === '_set' && opts._set) {
            value = opts._set;
        } else if (argName === 'objects' && (opts.objects || opts.object)) {
            value = opts.objects || [opts.object];
        } else if (argName === 'object' && opts.object && !opts.objects) {
            value = opts.object;
        } else if (isByPkOperation && opts.pk_columns && opts.pk_columns[argName] !== undefined) {
             // Handle direct PK arg like `id` for `_by_pk` operations 
             // Check if the schema actually expects this direct arg
             if (queryInfo.args[argName]) {
                 value = opts.pk_columns[argName];
                 isDirectPk = true;
             } else {
                  // This direct PK arg is not in schema, maybe it expects pk_columns object?
                  // Let's skip processing it directly if pk_columns object is also in the processing order
                  if (argProcessingOrder.includes('pk_columns')) continue; 
                  else value = opts.pk_columns[argName]; // Process if pk_columns object isn't expected
             }
        } else if (opts[argName as keyof GenerateOptions] !== undefined) {
             value = opts[argName as keyof GenerateOptions];
        }

        if (value !== undefined) {
            processArg(argName, value, argSchema, isDirectPk); 
            processedArgs.add(argName);
        }
    }

    // Process any remaining args not in the defined order (should be rare)
     if (queryInfo.args) {
         for (const argName in queryInfo.args) {
             if (!processedArgs.has(argName)) {
                 const value = opts[argName as keyof GenerateOptions];
                 if (value !== undefined) {
                     processArg(argName, value, queryInfo.args[argName], false); 
                     processedArgs.add(argName);
                 }
             }
         }
     }
    // --- End Argument Processing ---

    const returningFields: string[] = [];

    function processReturningField(field: string | Record<string, any>, currentVarCounterRef: { count: number }): string {
      if (typeof field === 'string') {
        return field.trim();
      }

      if (typeof field === 'object' && field !== null) {
        const fieldName = Object.keys(field)[0];
        const subFieldsOrParams = field[fieldName];

        if (typeof subFieldsOrParams === 'boolean' && subFieldsOrParams) {
          return fieldName;
        }
        if (typeof subFieldsOrParams === 'boolean' && !subFieldsOrParams) {
           return ''; // Explicitly skip false fields
        }

        if (Array.isArray(subFieldsOrParams)) {
          const subFieldsStr = subFieldsOrParams
             .map(sf => processReturningField(sf, currentVarCounterRef))
             .filter(Boolean) // Remove empty strings from skipped fields
             .join('\n        ');
          return subFieldsStr ? `${fieldName} {\n        ${subFieldsStr}\n      }` : '';
        }

        if (typeof subFieldsOrParams === 'string') {
           return `${fieldName} {\n        ${subFieldsOrParams}\n      }`;
        }

        // Handling nested query object with potential parameters
        if (typeof subFieldsOrParams === 'object' && subFieldsOrParams !== null) {
          const { where: nestedWhere, limit: nestedLimit, offset: nestedOffset, order_by: nestedOrderBy, alias, returning: nestedReturningDef, ...otherParams } = subFieldsOrParams;
          const relationName = fieldName;
          const fieldAliasOrName = alias || relationName;
          const relationArgTypeNameBase = alias ? alias : relationName;
          const nestedArgs: string[] = [];

           // Nested argument processing
          const processNestedArg = (argName: string, value: any, typeSuffix: string, defaultType: string = 'String', forceList: boolean = false) => {
                if (value === undefined || value === null) return;
                const varName = `v${currentVarCounterRef.count++}`;
                nestedArgs.push(`${argName}: $${varName}`);
                variables[varName] = value;
                // Construct type, e.g., users_bool_exp, posts_order_by
                let gqlType = typeSuffix ? `${relationArgTypeNameBase}${typeSuffix}` : defaultType;
                let isRequired = false; // Assume nested args aren't required unless schema says so
                let isList = forceList || (argName === 'order_by'); // Force list for order_by

                // Basic check if type name implies list/required (might need schema lookup)
                if (gqlType.startsWith('[')) isList = true;
                if (gqlType.endsWith('!')) {
                     isRequired = true;
                     gqlType = gqlType.slice(0, -1);
                 }
                 // Strip list markers if present, handle wrapping below
                if (gqlType.startsWith('[') && gqlType.endsWith(']')) {
                     gqlType = gqlType.slice(1, -1);
                 }

                let finalType = gqlType;
                if (isList) {
                     // Assume inner type is required for order_by list
                     const innerRequired = argName === 'order_by' ? '!' : ''; 
                     finalType = `[${gqlType}${innerRequired}]`;
                      // Is the list itself required? (Usually not for nested args)
                     isRequired = false;
                 }

                varParts.push(`$${varName}: ${finalType}${isRequired ? '!' : ''}`);
          };

           processNestedArg('where', nestedWhere, '_bool_exp');
           processNestedArg('limit', nestedLimit, '', 'Int');
           processNestedArg('offset', nestedOffset, '', 'Int');
           // Pass forceList=true for order_by
           processNestedArg('order_by', nestedOrderBy, '_order_by', 'String', true);

           // Process other arbitrary parameters
          for (const paramName in otherParams) {
              processNestedArg(paramName, otherParams[paramName], ''); // Assume String default
          }


          const nestedArgsStr = nestedArgs.length > 0 ? `(${nestedArgs.join(', ')})` : '';

          let finalNestedReturning: (string | Record<string, any>)[] = ['id']; // Default returning 'id'
          if (nestedReturningDef) {
             if (Array.isArray(nestedReturningDef)) {
                finalNestedReturning = nestedReturningDef;
             } else if (typeof nestedReturningDef === 'string') {
                 finalNestedReturning = nestedReturningDef.split(/\s+/).filter(Boolean);
             } else if (typeof nestedReturningDef === 'object') {
                // Convert object { field: true, another: {...} } to array ['field', { another: {...} }]
                finalNestedReturning = Object.entries(nestedReturningDef)
                  .filter(([_, value]) => value) // Filter out false values
                  .map(([key, value]) => (typeof value === 'boolean' ? key : { [key]: value }));
             }
          }


          const nestedFieldsStr = finalNestedReturning
             .map(f => processReturningField(f, currentVarCounterRef))
              .filter(Boolean) // Remove empty strings from skipped fields
             .join('\n        ');

           // Use alias in the field definition if present
          const fieldDefinition = alias ? `${relationName}: ${fieldAliasOrName}` : fieldAliasOrName;

          return nestedFieldsStr ? `${fieldDefinition}${nestedArgsStr} {\n        ${nestedFieldsStr}\n      }` : '';
        }

         return ''; // Skip invalid field types
      }

      return ''; // Skip invalid field types
    }


    const varCounterRef = { count: varCounter }; // Use ref for mutable counter in recursion

    // ---- START MODIFICATION ----
    let defaultFieldsGenerated = false;

    // Function to generate default fields based on operation type and schema
    const generateDefaultFields = () => {
        if (defaultFieldsGenerated) return; // Generate only once

        if (aggregate) {
            // Aggregate logic already adds `aggregate { ... }` and potentially `nodes { ... }`
            // No separate default fields needed here unless `returning` for nodes is omitted
            // The existing aggregate logic handles the structure.
        } else if (queryInfo.returning_fields && !isByPkOperation && operation !== 'delete') {
             // Default fields for query, subscription, insert (non-PK)
             returningFields.push('id');
             ['name', 'email', 'created_at', 'updated_at'].forEach(f => {
                 if (queryInfo.returning_fields[f]) returningFields.push(f);
             });
        } else if (isByPkOperation && operation === 'delete') {
            // Default for delete_by_pk: Try to return PK fields, fallback to id
            if (opts.pk_columns && queryInfo.returning_fields) {
                Object.keys(opts.pk_columns).forEach(pkField => {
                    if (queryInfo.returning_fields[pkField]) {
                        returningFields.push(pkField);
                    }
                });
            }
            // If no PK fields were added, push id as fallback
            if (returningFields.length === 0 && queryInfo.returning_fields?.id) {
                returningFields.push('id');
            }
        } else { // Default for other mutations _by_pk (update) and query_by_pk
            if (queryInfo.returning_fields) {
                 returningFields.push('id'); // Default fallback
            }
        }
        defaultFieldsGenerated = true;
    };

    // Process returning option
    if (returning) {
        if (Array.isArray(returning)) { // Explicit array provided - overrides defaults
            returning
                .map(field => processReturningField(field, varCounterRef))
                .filter(Boolean)
                .forEach(processedField => returningFields.push(processedField));
             defaultFieldsGenerated = true; // Mark defaults as handled/overridden
        } else if (typeof returning === 'string') { // Explicit string provided - overrides defaults
            returning.split(/\s+/).filter(Boolean)
                 .map(field => processReturningField(field, varCounterRef)) // Process simple strings
                 .filter(Boolean)
                 .forEach(processedField => returningFields.push(processedField));
             defaultFieldsGenerated = true; // Mark defaults as handled/overridden
        } else if (typeof returning === 'object' && returning !== null) { // NEW: Object provided - ADD to defaults
             // 1. Generate default fields first
             generateDefaultFields();
             // 2. Process the object as additional relations/fields
             Object.entries(returning).forEach(([key, value]) => {
                 // Construct the object format processReturningField expects: { relationName: subOptions }
                 const fieldObject = { [key]: value };
                 const processedField = processReturningField(fieldObject, varCounterRef);
                 if (processedField) {
                     // Avoid adding duplicates if default already added it (less likely for relations)
                     if (!returningFields.includes(processedField)) {
                        returningFields.push(processedField);
                     }
                 }
             });
        } else {
             // Invalid returning type? Fallback to defaults.
             generateDefaultFields();
        }
    } else { // returning is null or undefined - Use defaults
        generateDefaultFields();
    }
    // ---- END MODIFICATION ----

     varCounter = varCounterRef.count; // Update main counter

    // Adjust structure for bulk mutations (insert, update, delete) vs single (_one, _by_pk)
    let finalReturningFields = [...returningFields];
    if (['insert', 'update', 'delete'].includes(operation) && !isByPkOperation) {
        // Bulk operations usually return affected_rows and a nested 'returning' array
        const fieldsForReturning = finalReturningFields.filter(f => !f.startsWith('affected_rows')); // Keep existing fields
        finalReturningFields = ['affected_rows']; // Start with affected_rows
        if (fieldsForReturning.length > 0) {
            const returningFieldsStr = fieldsForReturning.join('\n        ');
            finalReturningFields.push(`returning {\n        ${returningFieldsStr}\n      }`);
        }
    }
    // Ensure single operations (_one, _by_pk) don't have affected_rows unless explicitly asked?
    // The current logic seems to handle this by default returning fields based on queryInfo


    // Determine the GraphQL operation type based on the input operation
    let gqlOperationType: 'query' | 'mutation' | 'subscription';
    if (operation === 'query') {
      gqlOperationType = 'query';
    } else if (operation === 'subscription') {
      gqlOperationType = 'subscription';
    } else { // insert, update, delete
      gqlOperationType = 'mutation';
    }

    // Construct operation name (e.g., QueryUsers, MutationInsertUsersOne)
    const opNamePrefix = gqlOperationType.charAt(0).toUpperCase() + gqlOperationType.slice(1);
    // Ensure tablePascal handles potential empty parts from split
    const tablePascal = queryName.split('_').map(part => part ? part.charAt(0).toUpperCase() + part.slice(1) : '').join('');
    const operationName = `${opNamePrefix}${tablePascal}`;


    const argsStr = queryArgs.length > 0 ? `(${queryArgs.join(', ')})` : '';
    const returningStr = finalReturningFields.length > 0 ? finalReturningFields.join('\n      ') : (queryInfo.returning_fields ? 'id' : ''); // Fallback to id if possible

    const fragmentsStr = fragments.length > 0 ? `\n${fragments.join('\n')}` : '';

    const queryStr = `
      ${gqlOperationType} ${operationName}${varParts.length > 0 ? `(${varParts.join(', ')})` : ''} {
        ${queryName}${argsStr}${returningStr ? ` {
          ${returningStr}
        }` : ''}
      }${fragmentsStr}
    `;

    try {
        const gqlQuery = gql(queryStr);
        return {
          queryString: queryStr,
          query: gqlQuery,
          variables,
          varCounter
        };
    } catch (error: any) {
         console.error("❌ Error parsing GraphQL query:", error.message);
         console.error("Generated Query String:", queryStr);
         console.error("Variables:", JSON.stringify(variables, null, 2));
         throw new Error(`Failed to parse generated GraphQL query: ${error.message}`);
    }
  };
}

// Export the factory function
export default Generator; 