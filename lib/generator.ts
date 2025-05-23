import { DocumentNode, gql } from '@apollo/client/core';
import Debug from './debug';

const debug = Debug('apollo:generator');

// Types for options and return value
export type GenerateOperation = 'query' | 'subscription' | 'insert' | 'update' | 'delete';

export type Generate = (opts: GenerateOptions) => GenerateResult;

export interface GenerateOptions {
  operation: GenerateOperation;
  table: string; // For now we'll keep it as string, we'll type it in the next step
  where?: Record<string, any>;
  // Allow array, object (for appending), or string (legacy split)
  returning?: (string | Record<string, any>)[] | Record<string, any> | string; 
  aggregate?: Record<string, any>;
  distinct_on?: string[] | ReadonlyArray<string>; // Added distinct_on (use string[] for now)
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
  queryName: string; // Added queryName
}

// --- Helper function for parsing GraphQL type ---
// Recursively parses the type (handling NON_NULL and LIST) and returns the base name and flags
function getTypeInfo(type: any): { name: string | null; kind: string; isList: boolean; isNonNull: boolean; isNonNullItem: boolean } {
    let isList = false;
    let isNonNull = false;
    let isNonNullItem = false; // For checking [Type!]
    let currentType = type;

    if (currentType.kind === 'NON_NULL') {
        isNonNull = true;
        currentType = currentType.ofType;
    }
    if (currentType.kind === 'LIST') {
        isList = true;
        currentType = currentType.ofType;
        if (currentType.kind === 'NON_NULL') {
            isNonNullItem = true;
            currentType = currentType.ofType;
        }
    }
     // Second NON_NULL is possible for [Type!]!
     if (currentType.kind === 'NON_NULL') {
         isNonNullItem = true; // If outer LIST was NON_NULL, then inner is also
         currentType = currentType.ofType;
     }

    return {
        name: currentType.name || null, // Return null if name is missing
        kind: currentType.kind,
        isList,
        isNonNull,
        isNonNullItem,
    };
}
// --- ---

export function Generator(schema: any): Generate { // We take the __schema object
  const _schema = schema?.data?.__schema || schema?.__schema || schema;

  // --- Validation moved here ---
  if (!_schema || !_schema.queryType || !_schema.types) {
    // Throw a more specific error if dynamic loading failed earlier
    if (_schema === null) {
        throw new Error('❌ CRITICAL: Schema could not be loaded dynamically. See previous error.');
    }
    debug('schema', _schema);
    throw new Error('❌ Invalid schema format passed to Generator. Expected standard introspection __schema object.');
  }
  // --- End validation ---

  const queryRootName = _schema.queryType.name;
  const mutationRootName = _schema.mutationType?.name; // May be missing
  const subscriptionRootName = _schema.subscriptionType?.name; // May be missing

  // Find detailed descriptions of root types
  const queryRoot = _schema.types.find((t: any) => t.kind === 'OBJECT' && t.name === queryRootName);
  const mutationRoot = mutationRootName ? _schema.types.find((t: any) => t.kind === 'OBJECT' && t.name === mutationRootName) : null;
  const subscriptionRoot = subscriptionRootName ? _schema.types.find((t: any) => t.kind === 'OBJECT' && t.name === subscriptionRootName) : null;

  if (!queryRoot) {
      throw new Error('❌ Query root type description not found in schema types.');
  }


  return function generate(opts: GenerateOptions): GenerateResult {
    let varCounter = opts.varCounter || 1;

    if (!opts || !opts.operation || !opts.table) {
      throw new Error('❌ operation and table must be specified in options');
    }

    const { operation, table } = opts;
    const where = opts.where || undefined;
    const returning = opts.returning || undefined;
    const aggregate = opts.aggregate || undefined;
    const fragments = opts.fragments || [];
    const distinctOn = opts.distinct_on || undefined; // Get distinct_on
    
    // --- IMPROVED: Smart query name resolution ---
    let queryName: string = table;
    let queryInfo: any = null;
    
    // Determine the correct root type based on operation
    let targetRoot: any = queryRoot;
    if (operation === 'insert' || operation === 'update' || operation === 'delete') {
        targetRoot = mutationRoot || queryRoot;
    } else if (operation === 'subscription') {
        targetRoot = subscriptionRoot || queryRoot;
    }
    
    // Try different naming patterns based on operation and options
    const namesToTry: string[] = [];
    
    if (aggregate) {
        namesToTry.push(`${table}_aggregate`);
    } else if (opts.pk_columns) {
        if (operation === 'query' || operation === 'subscription') {
            namesToTry.push(`${table}_by_pk`);
        } else if (operation === 'update') {
            namesToTry.push(`update_${table}_by_pk`);
        } else if (operation === 'delete') {
            namesToTry.push(`delete_${table}_by_pk`);
        }
    } else if (operation === 'insert') {
        if (opts.object && !opts.objects) {
            namesToTry.push(`insert_${table}_one`);
        }
        namesToTry.push(`insert_${table}`);
    } else if (operation === 'update') {
        namesToTry.push(`update_${table}`);
    } else if (operation === 'delete') {
        namesToTry.push(`delete_${table}`);
    }
    
    // Always try the base table name as fallback
    namesToTry.push(table);
    
    // Find the first matching field
    for (const name of namesToTry) {
        const found = targetRoot.fields.find((f: any) => f.name === name);
        if (found) {
            queryName = name;
            queryInfo = found;
            debug(`[generator] Using query name: ${queryName}`);
            break;
        }
    }

    if (!queryInfo) {
        throw new Error(`❌ No suitable field found for table "${table}" with operation "${operation}" in ${targetRoot.name}. Tried: ${namesToTry.join(', ')}`);
    }
    // --- End Smart Query Name Resolution ---

    const queryArgs: string[] = [];
    const variables: Record<string, any> = {};
    const varParts: string[] = [];

    // --- REFACTORING getGqlType ---
    const getGqlTypeFromSchema = (argType: any): string => {
        const info = getTypeInfo(argType);
        if (!info.name) {
             throw new Error(`Cannot determine base type name for argType: ${JSON.stringify(argType)}`);
        }
        let typeStr: string = info.name; // Now we know info.name is a string
        if (info.isList) {
            typeStr = `[${info.name}${info.isNonNullItem ? '!' : ''}]`;
        }
        if (info.isNonNull) {
            typeStr += '!';
        }
        return typeStr;
    };
    // --- ---

    // --- REFACTORING of the argument processing cycle (Top Level) ---
    const processedArgs = new Set<string>();
    const addArgument = (argName: string, value: any, argDefinition: any) => {
         if (processedArgs.has(argName)) return;
        const varName = `v${varCounter++}`;
        queryArgs.push(`${argName}: $${varName}`);
        variables[varName] = value;
         const gqlType = getGqlTypeFromSchema(argDefinition.type);
          // Check if var already exists before pushing
          if (!varParts.some(p => p.startsWith(`$${varName}:`))) {
        varParts.push(`$${varName}: ${gqlType}`);
          }
         processedArgs.add(argName);
    };

    // 1. Processing direct arguments of the field (from queryInfo.args)
    
    // Special handling for _by_pk operations - add pk_columns keys as separate arguments
    if (opts.pk_columns && (queryName.endsWith('_by_pk') || queryName.includes('_by_pk'))) {
        Object.entries(opts.pk_columns).forEach(([pkKey, pkValue]) => {
            const argDef = queryInfo.args?.find((a: any) => a.name === pkKey);
            if (argDef) {
                addArgument(pkKey, pkValue, argDef);
            }
        });
    }
    
    queryInfo.args?.forEach((argDef: any) => {
        const argName = argDef.name;
        let value: any = undefined;
        
        // Skip pk arguments if they were already processed above
        if (opts.pk_columns && Object.hasOwnProperty.call(opts.pk_columns, argName) && (queryName.endsWith('_by_pk') || queryName.includes('_by_pk'))) {
            return;
        }
        
        if (argName === 'pk_columns' && opts.pk_columns) {
                 value = opts.pk_columns;
        } else if (argName === '_set' && opts._set) {
            value = opts._set;
        } else if (argName === 'objects' && (opts.objects || opts.object)) {
            value = opts.objects || [opts.object];
        } else if (argName === 'object' && opts.object && !opts.objects) {
             if (queryName.endsWith('_one')) {
            value = opts.object;
             } else {
                 // Logic for the case when object is passed but objects or object is expected
                 value = [opts.object]; // Default to making it an array
                 const expectsObjects = queryInfo.args.find((a: any) => a.name === 'objects');
                 const expectsObject = queryInfo.args.find((a: any) => a.name === 'object');
                 
                 if (expectsObjects && !expectsObject) {
                    // Explicitly expects objects, pass an array
                    addArgument('objects', value, expectsObjects);
                    return; // Argument added, exit
                 } else if (!expectsObjects && expectsObject) {
                     // Explicitly expects object (not _one suffix, strange but possible)
                     // In this case addArgument below will handle 'object'
                     value = opts.object; // Return to original
                 } else if (expectsObjects && expectsObject) {
                    // Has both, but insert_one wasn't found. Probably a schema error or non-standard mutation.
                    // Warn and try to guess objects
                    debug(`[generator] Ambiguous arguments for "${queryName}": both 'object' and 'objects' found. Defaulting to 'objects' with single item array.`);
                    addArgument('objects', value, expectsObjects);
                    return; // Argument added, exit
                 } else {
                    // Expects neither object nor objects. Very strange. Warn.
                    debug(`[generator] Neither 'object' nor 'objects' argument found for "${queryName}" but object/objects provided in options.`);
                    // Don't add argument
                    return;
                 }
             }
        } else if (where && where[argName] !== undefined) {
             value = where[argName];
        } else if (argName === 'distinct_on' && distinctOn && ['query', 'subscription'].includes(operation)) {
            // --- Handle distinct_on ---
            value = distinctOn;
             // We need the argument definition for distinct_on to get its type
             const distinctOnArgDef = queryInfo.args.find((a: any) => a.name === 'distinct_on');
             if (distinctOnArgDef) {
                addArgument(argName, value, distinctOnArgDef);
             } else {
                 debug(`[generator] 'distinct_on' provided in options, but field "${queryName}" does not accept it according to the schema.`);
             }
             // --- End handle distinct_on ---
        } else if (opts[argName as keyof GenerateOptions] !== undefined) {
             // Handle general arguments like limit, offset, where, order_by
             value = opts[argName as keyof GenerateOptions];
        }

        // Add argument if value is defined and it wasn't handled specifically above (like distinct_on)
        if (value !== undefined && !processedArgs.has(argName)) {
            addArgument(argName, value, argDef);
        }
    });
    // --- End Top Level Argument Processing ---


    // --- Returning Field Processing (REWORKED) ---
    const returningFields: string[] = [];
    const varCounterRef = { count: varCounter }; // Use ref for nested calls

    // Helper to find type details from schema by name
    const findTypeDetails = (typeName: string | null) => {
        if (!typeName) return null;
        return _schema.types.find((t: any) => t.name === typeName && (t.kind === 'OBJECT' || t.kind === 'INTERFACE'));
    };

    // Recursive function to process fields
    function processReturningField(
        field: string | Record<string, any>,
        parentTypeName: string | null,
        currentVarCounterRef: { count: number }
    ): string {
        if (typeof field === 'string') {
            return field.trim();
        }

      if (typeof field === 'object' && field !== null) {
        const fieldName = Object.keys(field)[0];
        const subFieldsOrParams = field[fieldName];

        if (typeof subFieldsOrParams === 'object' && subFieldsOrParams !== null && (subFieldsOrParams as any)._isColumnsFunctionCall) {
            const fieldInfo = findTypeDetails(parentTypeName)?.fields?.find((f: any) => f.name === fieldName);
            
            if (fieldInfo?.args) {
                const columnsArg = fieldInfo.args.find((a: any) => a.name === 'columns');
                if (columnsArg) {
                    const varName = `v${currentVarCounterRef.count++}`;
                    const argValue = (subFieldsOrParams as any).columns;
                    variables[varName] = argValue;
                    
                    const gqlType = getGqlTypeFromSchema(columnsArg.type);
                    if (!varParts.some(p => p.startsWith(`$${varName}:`))) {
                        varParts.push(`$${varName}: ${gqlType}`);
                    }
                    
                    return `${fieldName}(columns: $${varName})`;
                }
            }
            
            return fieldName;
        }

            const fieldInfo = findTypeDetails(parentTypeName)?.fields?.find((f: any) => f.name === fieldName);
            if (!fieldInfo) {
                 debug(`Field "%s" not found in type "%s". Skipping.`, fieldName, parentTypeName);
                 return '';
            }

            let fieldReturnTypeName: string | null = null;
            let currentFieldType = fieldInfo.type;
            while (currentFieldType.ofType) currentFieldType = currentFieldType.ofType;
            fieldReturnTypeName = currentFieldType.name;
            
            if (typeof subFieldsOrParams === 'boolean' && subFieldsOrParams) {
                return fieldName;
            }
            if (typeof subFieldsOrParams === 'boolean' && !subFieldsOrParams) {
                return '';
            }

            if (Array.isArray(subFieldsOrParams) || typeof subFieldsOrParams === 'string') {
                const nestedFields = Array.isArray(subFieldsOrParams) ? subFieldsOrParams : subFieldsOrParams.split(/\s+/).filter(Boolean);
                const nestedProcessed = nestedFields
                    .map(sf => processReturningField(sf, fieldReturnTypeName, currentVarCounterRef))
                    .filter(Boolean)
             .join('\n        ');
                return nestedProcessed ? `${fieldName} {\n        ${nestedProcessed}\n      }` : fieldName;
            }

            if (typeof subFieldsOrParams === 'object') {
                const isAggregateField = fieldName.endsWith('_aggregate');
                
                let nestedReturning: any = null;
                let alias: string | undefined = undefined;
                let nestedArgsInput: Record<string, any> = {};
                
                let isAggregateFunction = fieldReturnTypeName?.endsWith('_aggregate_fields') || false;
                let fieldInfoInParent: any = null;
                
                if (isAggregateField) {
                    const knownAggregateArgs = new Set(['where', 'limit', 'offset', 'order_by', 'distinct_on', 'alias', 'returning']);
                    
                    Object.entries(subFieldsOrParams).forEach(([key, value]) => {
                        if (key === 'returning') {
                            nestedReturning = value;
                        } else if (key === 'alias') {
                            alias = value as string;
                        } else if (knownAggregateArgs.has(key)) {
                            nestedArgsInput[key] = value;
                        } else {
                            debug(`[processReturningField] Treating as return field: ${key}`);
                            if (!nestedReturning) {
                                nestedReturning = {};
                            }
                            if (typeof nestedReturning === 'object' && !Array.isArray(nestedReturning)) {
                                nestedReturning[key] = value;
                            } else {
                                const existingReturning = nestedReturning;
                                nestedReturning = { [key]: value };
                                if (Array.isArray(existingReturning)) {
                                    existingReturning.forEach((field: string) => {
                                        if (typeof field === 'string') {
                                            nestedReturning[field] = true;
                                        }
                                    });
                                }
                            }
                        }
                    });
                    
                } else {
                    const fieldTypeDetails = findTypeDetails(fieldReturnTypeName);
                    isAggregateFunction = fieldReturnTypeName?.endsWith('_aggregate_fields') || false;
                    
                    const parentTypeDetails = findTypeDetails(parentTypeName);
                    fieldInfoInParent = parentTypeDetails?.fields?.find((f: any) => f.name === fieldName);
                    
                    
                    if (isAggregateFunction) {
                        
                        
                        if (typeof subFieldsOrParams === 'object' && !Array.isArray(subFieldsOrParams)) {
                            
                            const processedReturning: Record<string, any> = {};
                            Object.entries(subFieldsOrParams).forEach(([subFieldName, subFieldValue]) => {
                                
                                const subFieldInfo = fieldInfoInParent?.type?.ofType ? 
                                    findTypeDetails(fieldInfoInParent.type.ofType.name)?.fields?.find((f: any) => f.name === subFieldName) :
                                    findTypeDetails(fieldReturnTypeName)?.fields?.find((f: any) => f.name === subFieldName);
                                
                                if (subFieldInfo && Array.isArray(subFieldValue)) {
                                    const columnsArg = subFieldInfo.args?.find((a: any) => a.name === 'columns');
                                    if (columnsArg) {
                                        
                                        if (subFieldValue.length === 1 && subFieldValue[0] === '*') {
                                            processedReturning[subFieldName] = true;
                                        } else {
                                            processedReturning[subFieldName] = { _isColumnsFunctionCall: true, columns: subFieldValue };
                                        }
                                    } else {
                                        processedReturning[subFieldName] = subFieldValue;
                                    }
                                } else {
                                    processedReturning[subFieldName] = subFieldValue;
                                }
                            });
                            
                            nestedReturning = processedReturning;
                            nestedArgsInput = {};
                        } else {
                            if (Array.isArray(subFieldsOrParams) && fieldInfoInParent?.args && fieldInfoInParent.args.length > 0) {
                                const columnsArg = fieldInfoInParent.args.find((a: any) => a.name === 'columns');
                                if (columnsArg) {
                                    nestedArgsInput = { columns: subFieldsOrParams };
                                    nestedReturning = null;
                                } else {
                                    nestedReturning = subFieldsOrParams;
                                }
                            } else {
                                ({ returning: nestedReturning, alias, ...nestedArgsInput } = subFieldsOrParams);
                            }
                        }
                    } else {
                        ({ returning: nestedReturning, alias, ...nestedArgsInput } = subFieldsOrParams);
                        
                        if (!nestedReturning && typeof subFieldsOrParams === 'object' && !Array.isArray(subFieldsOrParams)) {
                            const { alias: extractedAlias, ...potentialReturningFields } = subFieldsOrParams;
                            
                            const knownArgKeys = new Set(['where', 'limit', 'offset', 'order_by', 'distinct_on', 'alias', 'returning']);
                            const fieldKeys = Object.keys(potentialReturningFields).filter(key => !knownArgKeys.has(key));
                            
                            if (fieldKeys.length > 0) {
                                nestedReturning = potentialReturningFields;
                                nestedArgsInput = {};
                                if (extractedAlias) alias = extractedAlias;
                            }
                        }
                    }
                }
                
                const fieldAliasOrName = alias || fieldName;
                const fieldDefinition = alias ? `${alias}: ${fieldName}` : fieldName;

                const nestedArgs: string[] = [];
                if (fieldInfo.args && Object.keys(nestedArgsInput).length > 0) {
                     const argsSource = isAggregateFunction ? fieldInfoInParent : fieldInfo;
                     
                     Object.entries(nestedArgsInput).forEach(([argName, argValue]) => {
                         const argDef = argsSource?.args?.find((a: any) => a.name === argName);
                         if (argDef && argValue !== undefined) {
                const varName = `v${currentVarCounterRef.count++}`;
                nestedArgs.push(`${argName}: $${varName}`);
                             variables[varName] = argValue;
                             const gqlType = getGqlTypeFromSchema(argDef.type);
                             if (!varParts.some(p => p.startsWith(`$${varName}:`))) {
                                  varParts.push(`$${varName}: ${gqlType}`);
                             }
                         } else {
                              debug(`Argument "%s" not found or value is undefined for field "%s"`, argName, fieldName);
                         }
                     });
                }
                const nestedArgsStr = nestedArgs.length > 0 ? `(${nestedArgs.join(', ')})` : '';

                let finalNestedReturning: (string | Record<string, any>)[] = [];
                 if (nestedReturning) {
                      if (Array.isArray(nestedReturning)) {
                            finalNestedReturning = nestedReturning;
                      } else if (typeof nestedReturning === 'string') {
                           finalNestedReturning = nestedReturning.split(/\s+/).filter(Boolean);
                      } else if (typeof nestedReturning === 'object') {
                            finalNestedReturning = Object.entries(nestedReturning)
                                .filter(([_, v]) => v)
                                .map(([k, v]) => {
                                    if (typeof v === 'object' && v !== null && (v as any)._isColumnsFunctionCall) {
                                        return { [k]: v };
                                    }
                                    return typeof v === 'boolean' ? k : { [k]: v };
                                });
                      }
                 }
                 if (finalNestedReturning.length === 0) {
                     const nestedTypeDetails = findTypeDetails(fieldReturnTypeName);
                     if (isAggregateField && nestedTypeDetails?.fields?.find((f: any) => f.name === 'aggregate')) {
                         const aggregateField = nestedTypeDetails.fields.find((f: any) => f.name === 'aggregate');
                         if (aggregateField) {
                             let aggregateTypeName: string | null = null;
                             let currentAggType = aggregateField.type;
                             while (currentAggType.ofType) currentAggType = currentAggType.ofType;
                             aggregateTypeName = currentAggType.name;
                             
                             const aggregateTypeDetails = findTypeDetails(aggregateTypeName);
                             if (aggregateTypeDetails?.fields?.find((f: any) => f.name === 'count')) {
                                 finalNestedReturning.push({ aggregate: { count: true } });
                             } else {
                                 finalNestedReturning.push('aggregate');
                             }
                         }
                     } else if (nestedTypeDetails?.fields?.find((f: any) => f.name === 'id')) {
                         if (!isAggregateFunction || !subFieldsOrParams || typeof subFieldsOrParams !== 'object') {
                             finalNestedReturning.push('id');
                         }
                     } else if (nestedTypeDetails?.kind === 'OBJECT' || nestedTypeDetails?.kind === 'INTERFACE') {
                          finalNestedReturning.push('__typename');
                     }
                 }

                const nestedReturningStr = finalNestedReturning
                    .map(f => processReturningField(f, fieldReturnTypeName, currentVarCounterRef))
                    .filter(Boolean)
                    .join('\n        ');

                const nestedFieldTypeDetails = findTypeDetails(fieldReturnTypeName);
                const needsNestedBody = (nestedFieldTypeDetails?.kind === 'OBJECT' || nestedFieldTypeDetails?.kind === 'INTERFACE') && nestedReturningStr;
                const nestedBody = needsNestedBody ? ` {\n        ${nestedReturningStr}\n      }` : '';
                return `${fieldDefinition}${nestedArgsStr}${nestedBody}`;
            }
        }
        return '';
    }

    // --- Main Returning Logic (REWORKED) ---
    let topLevelReturnTypeName: string | null = null;
    let currentQueryType = queryInfo.type;
    while (currentQueryType.ofType) currentQueryType = currentQueryType.ofType;
    topLevelReturnTypeName = currentQueryType.name;

    let finalReturningFields: string[] = [];

    // Helper to generate base default fields
    const baseGenerateDefaultFields = (parentTypeName: string | null): string[] => {
      const defaults: string[] = [];
      if (aggregate) {
           const aggregateFieldInfo = queryRoot.fields.find(f => f.name === queryName);
            let aggReturnTypeName: string | null = null;
             if(aggregateFieldInfo) {
                let currentAggType = aggregateFieldInfo.type;
                 while(currentAggType.ofType) currentAggType = currentAggType.ofType;
                 aggReturnTypeName = currentAggType.name;
             }
             const aggTypeDetails = findTypeDetails(aggReturnTypeName);
             if (aggTypeDetails?.fields?.find((f: any) => f.name === 'aggregate')) {
                  const aggregateNestedField = aggTypeDetails.fields.find((f: any) => f.name === 'aggregate');
                  let aggregateNestedTypeName: string | null = null;
                  if (aggregateNestedField) {
                      let currentNestedType = aggregateNestedField.type;
                      while(currentNestedType.ofType) currentNestedType = currentNestedType.ofType;
                       aggregateNestedTypeName = currentNestedType.name;
                  }
                  const aggregateNestedTypeDetails = findTypeDetails(aggregateNestedTypeName);
                  if (aggregateNestedTypeDetails?.fields?.find((f:any) => f.name === 'count')) {
                     defaults.push('aggregate { count }');
                  } else {
                     defaults.push('aggregate { __typename }');
                  }
             } else {
                 defaults.push('__typename');
             }
      } else {
          const returnTypeDetails = findTypeDetails(parentTypeName);
          if (returnTypeDetails?.fields?.find((f: any) => f.name === 'id')) {
              defaults.push('id');
          }
           if (returnTypeDetails?.fields?.find((f: any) => f.name === 'name')) {
               defaults.push('name');
           }
           if (returnTypeDetails?.fields?.find((f: any) => f.name === 'email')) {
                defaults.push('email');
           }
           if (returnTypeDetails?.fields?.find((f: any) => f.name === 'created_at')) {
                 defaults.push('created_at');
            }
            if (returnTypeDetails?.fields?.find((f: any) => f.name === 'updated_at')) {
                 defaults.push('updated_at');
            }
          if (defaults.length === 0 && (returnTypeDetails?.kind === 'OBJECT' || returnTypeDetails?.kind === 'INTERFACE')) {
              defaults.push('__typename');
          }
      }
      return defaults;
    };

    if (returning) {
      if (Array.isArray(returning)) {
        finalReturningFields = returning
          .map(field => processReturningField(field, topLevelReturnTypeName, varCounterRef))
          .filter(Boolean);
      } else if (typeof returning === 'string') {
        finalReturningFields = returning.split(/\s+/).filter(Boolean)
          .map(field => processReturningField(field, topLevelReturnTypeName, varCounterRef))
          .filter(Boolean);
      } else if (typeof returning === 'object' && returning !== null) {
        let currentDefaults = baseGenerateDefaultFields(topLevelReturnTypeName);
        const customFields: string[] = [];

        Object.entries(returning).forEach(([key, value]) => {
                 const fieldObject = { [key]: value };
          const processedField = processReturningField(fieldObject, topLevelReturnTypeName, varCounterRef);
                 if (processedField) {
            const baseNameMatch = processedField.match(/^([\w\d_]+)(?:\s*:\s*[\w\d_]+)?/);
             const baseName = (value?.alias && typeof value === 'object') ? key : (baseNameMatch ? baseNameMatch[1] : key);

            currentDefaults = currentDefaults.filter(defaultField => {
              const defaultBaseNameMatch = defaultField.match(/^([\w\d_]+)/);
              return !(defaultBaseNameMatch && defaultBaseNameMatch[1] === baseName);
            });
            customFields.push(processedField);
          }
        });
        finalReturningFields = [...currentDefaults, ...customFields];
        } else {
        finalReturningFields = baseGenerateDefaultFields(topLevelReturnTypeName);
        }
    } else {
      finalReturningFields = baseGenerateDefaultFields(topLevelReturnTypeName);
    }
     varCounter = varCounterRef.count;

    let assembledReturningFields = [...finalReturningFields];
    if (['insert', 'update', 'delete'].includes(operation) && !queryName.endsWith('_by_pk') && !queryName.endsWith('_one')) {
      let directFieldReturnType = queryInfo.type;
      while(directFieldReturnType.ofType) directFieldReturnType = directFieldReturnType.ofType;
      const returnTypeDetails = findTypeDetails(directFieldReturnType.name);

      if (returnTypeDetails?.fields?.find((f:any) => f.name === 'affected_rows') && returnTypeDetails?.fields?.find((f:any) => f.name === 'returning')) {
        const fieldsForNestedReturning = assembledReturningFields.filter(f => !f.trim().startsWith('affected_rows'));
        assembledReturningFields = ['affected_rows'];
        if (fieldsForNestedReturning.length > 0) {
          const returningFieldsStr = fieldsForNestedReturning.join('\n        ');
          assembledReturningFields.push(`returning {\n        ${returningFieldsStr}\n      }`);
        }
      } else {
        debug(`Mutation "%s" does not seem to return standard affected_rows/returning fields.`, queryName);
      }
    }

    let gqlOperationType: 'query' | 'mutation' | 'subscription';
    if (operation === 'query') gqlOperationType = 'query';
    else if (operation === 'subscription') gqlOperationType = 'subscription';
    else gqlOperationType = 'mutation';

    const opNamePrefix = gqlOperationType.charAt(0).toUpperCase() + gqlOperationType.slice(1);
    const queryNamePascal = queryName.split('_').map((part: string) => part ? part.charAt(0).toUpperCase() + part.slice(1) : '').join('');
    const operationName = `${opNamePrefix}${queryNamePascal}`;

    const argsStr = queryArgs.length > 0 ? `(${queryArgs.join(', ')})` : '';

    const needsBody = currentQueryType.kind === 'OBJECT' || currentQueryType.kind === 'INTERFACE';
    const returningStr = assembledReturningFields.length > 0 ? assembledReturningFields.join('\n      ') : '';
    const bodyStr = needsBody && returningStr ? ` {\n          ${returningStr}\n        }` : '';

    const fragmentsStr = fragments.length > 0 ? `\n${fragments.join('\n')}` : '';

    const queryStr = `
      ${gqlOperationType} ${operationName}${varParts.length > 0 ? `(${varParts.join(', ')})` : ''} {
        ${queryName}${argsStr}${bodyStr}
      }${fragmentsStr}
    `;

    try {
        const gqlQuery = gql(queryStr);
        return {
          queryString: queryStr,
          query: gqlQuery,
          variables,
          varCounter,
          queryName
        };
    } catch (error: any) {
         console.error("❌ Error parsing GraphQL query:", error.message);
         console.error("Generated Query String:", queryStr);
         console.error("Variables:", JSON.stringify(variables, null, 2));
         throw new Error(`Failed to parse generated GraphQL query: ${error.message}`);
    }
  };
}

// Export Generator with already loaded schema (or null/undefined if loading failed)