import fs from 'fs'; // Add fs import
import path from 'path'; // Add path import
import Debug from './debug';
import { gql, DocumentNode } from '@apollo/client/core';
import type { Query_Root, Mutation_Root, Subscription_Root } from '../types/hasura-types';

const debug = Debug('apollo:generator');

// --- Dynamic Schema Loading ---
let schema: any; // Define schema variable

try {
    // Determine project root based on current working directory
    const projectRoot = process.cwd(); // Assumes CWD is project root when CLI runs
    const schemaPath = path.join(projectRoot, 'public', 'hasura-schema.json');
    debug(`Dynamically loading schema from: ${schemaPath}`);

    if (!fs.existsSync(schemaPath)) {
        throw new Error(`Schema file not found at expected location: ${schemaPath}. Run 'npx hasyx schema' first in your project root.`);
    }

    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    const introspectionResult = JSON.parse(schemaContent);

    // Add basic validation
    if (!introspectionResult || !introspectionResult.data || !introspectionResult.data.__schema) {
        throw new Error(`Invalid introspection result format in ${schemaPath}. Expected { data: { __schema: { ... } } }`);
    }
    schema = introspectionResult.data.__schema;
    debug(`Successfully loaded and parsed schema from ${schemaPath}`);

} catch (error: any) {
    console.error("❌ CRITICAL ERROR: Failed to load or parse hasura-schema.json.", error);
    // Optionally re-throw or exit, depending on desired behavior if schema is missing
    // For now, let it proceed, Generator() will throw if schema is invalid
    schema = null; // Ensure Generator receives null or throws later
}
// --- End Dynamic Schema Loading ---


// Types for options and return value
export type GenerateOperation = 'query' | 'subscription' | 'insert' | 'update' | 'delete';

export interface GenerateOptions {
  operation: GenerateOperation;
  table: string; // Пока оставим string, типизируем на следующем шаге
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

// --- Вспомогательная функция для разбора типа GraphQL ---
// Рекурсивно разбирает тип (обрабатывая NON_NULL и LIST) и возвращает базовое имя и флаги
function getTypeInfo(type: any): { name: string | null; kind: string; isList: boolean; isNonNull: boolean; isNonNullItem: boolean } {
    let isList = false;
    let isNonNull = false;
    let isNonNullItem = false; // Для проверки [Type!]
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
     // Второй NON_NULL возможен для [Type!]!
     if (currentType.kind === 'NON_NULL') {
         isNonNullItem = true; // Если внешний LIST был NON_NULL, то и внутренний тоже
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

export function Generator(schema: any) { // Принимаем __schema объект
  // --- Validation moved here ---
  if (!schema || !schema.queryType || !schema.types) {
    // Throw a more specific error if dynamic loading failed earlier
    if (schema === null) {
        throw new Error('❌ CRITICAL: Schema could not be loaded dynamically. See previous error.');
    }
    throw new Error('❌ Invalid schema format passed to Generator. Expected standard introspection __schema object.');
  }
  // --- End validation ---

  const queryRootName = schema.queryType.name;
  const mutationRootName = schema.mutationType?.name; // Может отсутствовать
  const subscriptionRootName = schema.subscriptionType?.name; // Может отсутствовать

  // Находим детальные описания корневых типов
  const queryRoot = schema.types.find((t: any) => t.kind === 'OBJECT' && t.name === queryRootName);
  const mutationRoot = mutationRootName ? schema.types.find((t: any) => t.kind === 'OBJECT' && t.name === mutationRootName) : null;
  const subscriptionRoot = subscriptionRootName ? schema.types.find((t: any) => t.kind === 'OBJECT' && t.name === subscriptionRootName) : null;

  if (!queryRoot) {
      throw new Error('❌ Query root type description not found in schema types.');
  }


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

    // --- Определение корневого типа и полей для поиска ---
    let rootType: any = null; // Тип будет 'OBJECT' из __schema.types
    let rootFields: any[] = []; // Массив полей из корневого типа

    if (operation === 'query') {
      rootType = queryRoot;
      rootFields = queryRoot.fields || [];
    } else if (operation === 'subscription') {
      if (!subscriptionRoot) throw new Error('❌ Subscription operations not supported by the schema.');
      rootType = subscriptionRoot;
      rootFields = subscriptionRoot.fields || [];
    } else { // insert, update, delete
      if (!mutationRoot) throw new Error('❌ Mutation operations not supported by the schema.');
      rootType = mutationRoot;
      rootFields = mutationRoot.fields || [];
    }
    // --- ---

    // --- Логика определения имени операции (queryName) ---
    let targetFieldName = table; // Имя поля, которое ищем в корневом типе
    let isByPkOperation = false;
    let isAggregate = operation === 'query' && !!aggregate;

    // Определяем префиксы и суффиксы для мутаций и by_pk запросов
    const mutationPrefix = operation === 'insert' ? 'insert_' : operation === 'update' ? 'update_' : operation === 'delete' ? 'delete_' : '';
    const pkSuffix = '_by_pk';
    const aggregateSuffix = '_aggregate';
    const oneSuffix = '_one';

    // Формируем ожидаемые имена полей (улучшенная логика)
    if (isAggregate) {
        targetFieldName = `${table}${aggregateSuffix}`;
    } else if (opts.pk_columns) {
        if (operation === 'query') {
             targetFieldName = `${table}${pkSuffix}`;
        isByPkOperation = true;
        } else if (['update', 'delete'].includes(operation)) {
             targetFieldName = `${mutationPrefix}${table}${pkSuffix}`;
        isByPkOperation = true;
        }
        // pk_columns не влияет на insert
    } else if (operation === 'insert' && opts.object && !opts.objects) {
        const oneFieldName = `${mutationPrefix}${table}${oneSuffix}`;
        if (rootFields.find(f => f.name === oneFieldName)) {
            targetFieldName = oneFieldName;
            // Не ставим isByPkOperation в true для insert_one, т.к. аргументы другие
        } else {
            targetFieldName = `${mutationPrefix}${table}`;
        }
    } else if (operation === 'insert') {
        targetFieldName = `${mutationPrefix}${table}`;
    } else if (operation === 'update') {
         targetFieldName = `${mutationPrefix}${table}`; // Bulk update
    } else if (operation === 'delete') {
         targetFieldName = `${mutationPrefix}${table}`; // Bulk delete
    }
    // Для обычных query/subscription без pk_columns и aggregate, имя таблицы (targetFieldName) остается исходным 'table'


    const queryInfo = rootFields.find(f => f.name === targetFieldName);

    if (!queryInfo) {
         // Fallback для случая, когда _by_pk/aggregate/etc не найдены, но базовый запрос есть
         const fallbackQueryInfo = rootFields.find(f => f.name === table);
         if (fallbackQueryInfo && ['query', 'subscription'].includes(operation) && !isAggregate && !isByPkOperation) {
             console.warn(`[generator] ⚠️ Exact field "${targetFieldName}" not found, using fallback "${table}" in ${rootType.name}`);
             targetFieldName = table; // Используем базовое имя
             // queryInfo = fallbackQueryInfo; // Переприсваиваем для дальнейшего использования
             throw new Error(`❌ Field "${targetFieldName}" not found in root type "${rootType.name}"`); // Упадем здесь, если все равно не нашли
         } else {
             throw new Error(`❌ Field "${targetFieldName}" not found in root type "${rootType.name}"`);
         }
    }
    const queryName = queryInfo.name; // Имя поля GraphQL, которое будем использовать
    // --- ---


    const queryArgs: string[] = [];
    const variables: Record<string, any> = {};
    const varParts: string[] = [];

    // --- РЕФАКТОРИНГ getGqlType ---
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

    // --- РЕФАКТОРИНГ Цикла обработки аргументов (Top Level) ---
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

    // 1. Обработка прямых аргументов поля (из queryInfo.args)
    queryInfo.args?.forEach((argDef: any) => {
        const argName = argDef.name;
        let value: any = undefined;
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
                 value = [opts.object];
                 if (!queryInfo.args.find((a: any) => a.name === 'objects')) {
                      debug(`Passing single 'object' to bulk operation "%s" which might expect 'objects' array.`, queryName);
                      const objectsArgDef = queryInfo.args.find((a: any) => a.name === 'objects');
                       if (objectsArgDef) {
                           addArgument('objects', value, objectsArgDef);
                       } else {
                           console.error(`[generator] Cannot determine correct argument ('object' or 'objects') for "${queryName}".`);
                       }
                       return;
                 } else if(queryInfo.args.find((a: any) => a.name === 'object')) {
                       return; 
                 } else {
                      const objectsArgDef = queryInfo.args.find((a: any) => a.name === 'objects');
                       if (objectsArgDef) {
                            addArgument('objects', value, objectsArgDef);
                       }
                        return; 
                 }
             }
        } else if (isByPkOperation && opts.pk_columns && opts.pk_columns[argName] !== undefined) {
             value = opts.pk_columns[argName];
        } else if (opts[argName as keyof GenerateOptions] !== undefined) {
             value = opts[argName as keyof GenerateOptions];
        }

        if (value !== undefined) {
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
        return schema.types.find((t: any) => t.name === typeName && (t.kind === 'OBJECT' || t.kind === 'INTERFACE'));
    };

    // Recursive function to process fields
    function processReturningField(
        field: string | Record<string, any>,
        parentTypeName: string | null,
        currentVarCounterRef: { count: number }
    ): string {
        if (typeof field === 'string') return field.trim();

      if (typeof field === 'object' && field !== null) {
        const fieldName = Object.keys(field)[0];
        const subFieldsOrParams = field[fieldName];

            // Find the field definition in the parent type
            const parentTypeDetails = findTypeDetails(parentTypeName);
            const fieldInfo = parentTypeDetails?.fields?.find((f: any) => f.name === fieldName);
            if (!fieldInfo) {
                 // Use debug instead of console.warn
                 debug(`Field "%s" not found in type "%s". Skipping.`, fieldName, parentTypeName);
                 return ''; // Skip if field not found in parent
            }

            // Determine the return type of this field
            let fieldReturnTypeName: string | null = null;
            let currentFieldType = fieldInfo.type;
            while (currentFieldType.ofType) currentFieldType = currentFieldType.ofType; // Unwrap LIST/NON_NULL
            fieldReturnTypeName = currentFieldType.name;


            if (typeof subFieldsOrParams === 'boolean' && subFieldsOrParams) return fieldName;
            if (typeof subFieldsOrParams === 'boolean' && !subFieldsOrParams) return ''; // Skip false

            if (Array.isArray(subFieldsOrParams) || typeof subFieldsOrParams === 'string') {
                // Simple nested fields (array of strings/objects or single string)
                const nestedFields = Array.isArray(subFieldsOrParams) ? subFieldsOrParams : subFieldsOrParams.split(/\s+/).filter(Boolean);
                const nestedProcessed = nestedFields
                    .map(sf => processReturningField(sf, fieldReturnTypeName, currentVarCounterRef)) // <<< Pass return type as new parent
                    .filter(Boolean)
             .join('\n        ');
                return nestedProcessed ? `${fieldName} {\n        ${nestedProcessed}\n      }` : fieldName; // Return just fieldName if no nested fields processed
            }

            if (typeof subFieldsOrParams === 'object') { // Nested query with potential args
                const { returning: nestedReturning, alias, ...nestedArgsInput } = subFieldsOrParams;
                const fieldAliasOrName = alias || fieldName;
                // Field definition might include alias
                const fieldDefinition = alias ? `${alias}: ${fieldName}` : fieldName;

                // --- Process Nested Arguments --- (IMPLEMENTED)
          const nestedArgs: string[] = [];
                if (fieldInfo.args && Object.keys(nestedArgsInput).length > 0) {
                     Object.entries(nestedArgsInput).forEach(([argName, argValue]) => {
                         const argDef = fieldInfo.args.find((a: any) => a.name === argName);
                         if (argDef && argValue !== undefined) {
                const varName = `v${currentVarCounterRef.count++}`;
                nestedArgs.push(`${argName}: $${varName}`);
                             variables[varName] = argValue;
                             const gqlType = getGqlTypeFromSchema(argDef.type); // Use existing helper
                             // Check if var already exists before pushing
                             if (!varParts.some(p => p.startsWith(`$${varName}:`))) {
                                  varParts.push(`$${varName}: ${gqlType}`);
                             }
                         } else {
                              // Use debug instead of console.warn
                              debug(`Argument "%s" not found or value is undefined for field "%s"`, argName, fieldName);
                         }
                     });
                }
                const nestedArgsStr = nestedArgs.length > 0 ? `(${nestedArgs.join(', ')})` : '';
                // --- End Nested Arguments ---


                // --- Process Nested Returning Fields --- (Improved Default Logic)
                let finalNestedReturning: (string | Record<string, any>)[] = [];
                 if (nestedReturning) {
                      if (Array.isArray(nestedReturning)) {
                            finalNestedReturning = nestedReturning;
                      } else if (typeof nestedReturning === 'string') {
                           finalNestedReturning = nestedReturning.split(/\s+/).filter(Boolean);
                      } else if (typeof nestedReturning === 'object') {
                            finalNestedReturning = Object.entries(nestedReturning)
                                .filter(([_, v]) => v)
                                .map(([k, v]) => (typeof v === 'boolean' ? k : { [k]: v }));
                      }
                 }
                 // If no nested returning specified, try to add default 'id' or '__typename'
                 if (finalNestedReturning.length === 0) {
                     const nestedTypeDetails = findTypeDetails(fieldReturnTypeName);
                     if (nestedTypeDetails?.fields?.find((f: any) => f.name === 'id')) {
                         finalNestedReturning.push('id');
                     } else if (nestedTypeDetails?.kind === 'OBJECT' || nestedTypeDetails?.kind === 'INTERFACE') {
                          finalNestedReturning.push('__typename');
                     }
                      // If it's a SCALAR/ENUM, no body needed
                 }

                const nestedReturningStr = finalNestedReturning
                    .map(f => processReturningField(f, fieldReturnTypeName, currentVarCounterRef)) // <<< Pass return type
                    .filter(Boolean)
                    .join('\n        ');
                // --- End Nested Returning Fields ---

                // Only add body if there are fields to return AND the type is OBJECT/INTERFACE
                 const nestedFieldTypeDetails = findTypeDetails(fieldReturnTypeName);
                 const needsNestedBody = (nestedFieldTypeDetails?.kind === 'OBJECT' || nestedFieldTypeDetails?.kind === 'INTERFACE') && nestedReturningStr;
                const nestedBody = needsNestedBody ? ` {\n        ${nestedReturningStr}\n      }` : '';
                return `${fieldDefinition}${nestedArgsStr}${nestedBody}`;
            }
        }
        return ''; // Should not happen for valid input
    }

    // --- Main Returning Logic (REWORKED) ---
    let topLevelReturnTypeName: string | null = null;
    let currentQueryType = queryInfo.type;
    while (currentQueryType.ofType) currentQueryType = currentQueryType.ofType;
    topLevelReturnTypeName = currentQueryType.name;

    let finalReturningFields: string[] = []; // Initialize final list

    // Helper to generate base default fields
    const baseGenerateDefaultFields = (parentTypeName: string | null): string[] => {
      const defaults: string[] = [];
      if (aggregate) {
          // Simplified default for aggregate
           const aggregateFieldInfo = rootFields.find(f => f.name === queryName);
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
          // Add other simple default fields like name, email if they exist?
          // Example: Check if 'name' exists and add it
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
           // Fallback __typename if still empty and it's an object/interface
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
        // Defaults are fully overridden by array
      } else if (typeof returning === 'string') {
        finalReturningFields = returning.split(/\s+/).filter(Boolean)
          .map(field => processReturningField(field, topLevelReturnTypeName, varCounterRef))
          .filter(Boolean);
        // Defaults are fully overridden by string
      } else if (typeof returning === 'object' && returning !== null) {
        // 1. Get default fields
        let currentDefaults = baseGenerateDefaultFields(topLevelReturnTypeName);
        const customFields: string[] = [];

        // 2. Process fields from the returning object
             Object.entries(returning).forEach(([key, value]) => {
                 const fieldObject = { [key]: value };
          const processedField = processReturningField(fieldObject, topLevelReturnTypeName, varCounterRef);
                 if (processedField) {
            // Determine base name (handle alias: "alias: realName" or just "realName")
            const baseNameMatch = processedField.match(/^([\w\d_]+)(?:\s*:\s*[\w\d_]+)?/);
             // If alias exists use the original field name (key), otherwise use the matched name
             const baseName = (value?.alias && typeof value === 'object') ? key : (baseNameMatch ? baseNameMatch[1] : key);

            // Remove default if it exists with the same base name
            currentDefaults = currentDefaults.filter(defaultField => {
              const defaultBaseNameMatch = defaultField.match(/^([\w\d_]+)/);
              return !(defaultBaseNameMatch && defaultBaseNameMatch[1] === baseName);
            });
            customFields.push(processedField); // Add the processed field
          }
        });
        // 3. Combine remaining defaults and custom fields
        finalReturningFields = [...currentDefaults, ...customFields];
        } else {
        // Invalid type or null, use defaults
        finalReturningFields = baseGenerateDefaultFields(topLevelReturnTypeName);
        }
    } else {
      // No returning provided, use defaults
      finalReturningFields = baseGenerateDefaultFields(topLevelReturnTypeName);
    }
     varCounter = varCounterRef.count; // Update main counter
    // --- End Returning ---

    // --- Final Query String Assembly --- (Adjusted section)
    // const returningStr = finalReturningFields.length > 0 ? finalReturningFields.join('\n      ') : ''; // Use the calculated finalReturningFields

    // Логика для affected_rows
    let assembledReturningFields = [...finalReturningFields]; // Start with the combined list
    if (['insert', 'update', 'delete'].includes(operation) && !queryName.endsWith('_by_pk') && !queryName.endsWith('_one')) {
      let directFieldReturnType = queryInfo.type;
      while(directFieldReturnType.ofType) directFieldReturnType = directFieldReturnType.ofType;
      const returnTypeDetails = findTypeDetails(directFieldReturnType.name);

      if (returnTypeDetails?.fields?.find((f:any) => f.name === 'affected_rows') && returnTypeDetails?.fields?.find((f:any) => f.name === 'returning')) {
        const fieldsForNestedReturning = assembledReturningFields.filter(f => !f.trim().startsWith('affected_rows'));
        assembledReturningFields = ['affected_rows']; // Reset and start with affected_rows
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
    // --- End Assembly ---

    try {
        // debug("Generated Query:", queryStr);
        // debug("Generated Variables:", variables);
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

// Экспортируем Generator с уже загруженной схемой (или null/undefined if loading failed)
export default Generator(schema);