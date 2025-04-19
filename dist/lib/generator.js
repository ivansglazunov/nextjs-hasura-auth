"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Generator = Generator;
// @ts-ignore // Assuming debug.js is moved to lib/debug.ts or similar and returns a function
const debug = Debug('apollo:generator');
const core_1 = require("@apollo/client/core"); // Use core for gql
/**
 * Creates a GraphQL query generator based on the provided schema.
 *
 * @param schema - The GraphQL schema in schema.json format.
 * @returns A function to generate queries.
 */
function Generator(schema) {
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
    return function generate(opts) {
        let varCounter = opts.varCounter || 1;
        if (!opts || !opts.operation || !opts.table) {
            throw new Error('❌ operation and table must be specified in options');
        }
        const { operation, table } = opts;
        const where = opts.where || null;
        const returning = opts.returning || null;
        const aggregate = opts.aggregate || null;
        const fragments = opts.fragments || [];
        const validOperations = ['query', 'subscription', 'insert', 'update', 'delete'];
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
        }
        else if (operation === 'subscription') {
            schemaSection = 'subscriptions';
        }
        else if (['insert', 'update', 'delete'].includes(operation)) {
            schemaSection = 'mutations';
            if (operation === 'insert') {
                tableName = `insert_${table}`;
            }
            else if (operation === 'update') {
                // Handle _by_pk update separately later
                // tableName = `update_${table}`; // Keep original table for now
            }
            else if (operation === 'delete') {
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
        }
        else if (operation === 'query' && opts.pk_columns) {
            isByPkOperation = true;
            tableName = `${table}_by_pk`; // e.g., users_by_pk
        }
        else if (operation === 'insert' && opts.object && !opts.objects) {
            // Try to find insert_table_one mutation
            const oneMutationName = `insert_${table}_one`;
            if (schema.mutations && schema.mutations[oneMutationName]) {
                tableName = oneMutationName;
                isByPkOperation = true; // Treat insert_one like a by_pk operation for simplicity
            }
            else {
                tableName = `insert_${table}`; // Fallback to regular insert
            }
        }
        else if (operation === 'insert') {
            tableName = `insert_${table}`;
        }
        else if (operation === 'update') {
            tableName = `update_${table}`;
        }
        else if (operation === 'delete') {
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
        const queryArgs = [];
        const variables = {};
        const varParts = [];
        // Simplified argument processing based on queryInfo.args (assuming schema provides arg info)
        const processArg = (argName, value, argSchema) => {
            if (value === undefined || value === null)
                return; // Skip null/undefined args
            const varName = `v${varCounter++}`;
            queryArgs.push(`${argName}: $${varName}`);
            variables[varName] = value;
            // Determine type from schema if possible, otherwise fallback or make required
            const type = (argSchema === null || argSchema === void 0 ? void 0 : argSchema.type) || 'String'; // Fallback, might need refinement
            const isRequired = (argSchema === null || argSchema === void 0 ? void 0 : argSchema.isRequired) || (argName === 'pk_columns' || argName === '_set' || argName === 'objects' ? '!' : ''); // Make common args required
            varParts.push(`$${varName}: ${type}${isRequired}`);
        };
        // Process known arguments
        if (queryInfo.args) {
            if (queryInfo.args.where && where)
                processArg('where', where, queryInfo.args.where);
            if (queryInfo.args.pk_columns && opts.pk_columns)
                processArg('pk_columns', opts.pk_columns, queryInfo.args.pk_columns);
            if (queryInfo.args._set && opts._set)
                processArg('_set', opts._set, queryInfo.args._set);
            if (queryInfo.args.objects && (opts.objects || opts.object)) {
                const insertData = opts.objects || [opts.object];
                processArg('objects', insertData, queryInfo.args.objects);
            }
            if (queryInfo.args.object && opts.object && !opts.objects) { // For insert_one
                processArg('object', opts.object, queryInfo.args.object);
            }
            if (queryInfo.args.limit && opts.limit !== undefined)
                processArg('limit', opts.limit, queryInfo.args.limit);
            if (queryInfo.args.offset && opts.offset !== undefined)
                processArg('offset', opts.offset, queryInfo.args.offset);
            if (queryInfo.args.order_by && opts.order_by)
                processArg('order_by', opts.order_by, queryInfo.args.order_by);
            // Handle potential by_pk args directly if pk_columns is used for non-update/delete
            if (isByPkOperation && opts.pk_columns && queryInfo.args) {
                for (const pkName in opts.pk_columns) {
                    if (queryInfo.args[pkName]) {
                        processArg(pkName, opts.pk_columns[pkName], queryInfo.args[pkName]);
                    }
                }
            }
        }
        const returningFields = [];
        function processReturningField(field, currentVarCounterRef) {
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
                    const { where: nestedWhere, limit: nestedLimit, offset: nestedOffset, order_by: nestedOrderBy, alias, returning: nestedReturningDef } = subFieldsOrParams, otherParams = __rest(subFieldsOrParams, ["where", "limit", "offset", "order_by", "alias", "returning"]);
                    // Use alias if provided, otherwise the field name itself
                    const relationName = fieldName; // Original relation name from schema key
                    const fieldAliasOrName = alias || relationName; // Name used in the query (could be alias)
                    // Determine the type name for arguments (usually relationName + _bool_exp, etc.)
                    // This might need refinement based on actual schema structure for relations
                    const relationArgTypeNameBase = alias ? alias : relationName; // Use alias if provided for arg type name base
                    const nestedArgs = [];
                    // Nested argument processing
                    const processNestedArg = (argName, value, typeSuffix, defaultType = 'String') => {
                        if (value === undefined || value === null)
                            return;
                        const varName = `v${currentVarCounterRef.count++}`;
                        nestedArgs.push(`${argName}: $${varName}`);
                        variables[varName] = value;
                        // Construct type, e.g., users_bool_exp, posts_order_by
                        const gqlType = typeSuffix ? `${relationArgTypeNameBase}${typeSuffix}` : defaultType;
                        // Determine if required (typically not for nested args unless specified)
                        const isRequired = ''; // Modify if schema indicates requirement
                        varParts.push(`$${varName}: ${gqlType}${isRequired}`);
                    };
                    processNestedArg('where', nestedWhere, '_bool_exp');
                    processNestedArg('limit', nestedLimit, '', 'Int');
                    processNestedArg('offset', nestedOffset, '', 'Int');
                    processNestedArg('order_by', nestedOrderBy, '_order_by!', '[String!]'); // Adjust default type as needed
                    // Process other arbitrary parameters
                    for (const paramName in otherParams) {
                        processNestedArg(paramName, otherParams[paramName], ''); // Assume String default
                    }
                    const nestedArgsStr = nestedArgs.length > 0 ? `(${nestedArgs.join(', ')})` : '';
                    let finalNestedReturning = ['id']; // Default returning 'id'
                    if (nestedReturningDef) {
                        if (Array.isArray(nestedReturningDef)) {
                            finalNestedReturning = nestedReturningDef;
                        }
                        else if (typeof nestedReturningDef === 'string') {
                            finalNestedReturning = nestedReturningDef.split(/\s+/).filter(Boolean);
                        }
                        else if (typeof nestedReturningDef === 'object') {
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
        // Process top-level returning fields
        if (aggregate) {
            const aggregateFields = [];
            for (const [key, value] of Object.entries(aggregate)) {
                if (typeof value === 'boolean' && value) {
                    aggregateFields.push(key);
                }
                else if (typeof value === 'object' && value !== null) {
                    const subFields = Object.entries(value)
                        .filter(([_, v]) => v)
                        .map(([k]) => k)
                        .join('\n            ');
                    if (subFields) {
                        aggregateFields.push(`${key} {\n            ${subFields}\n          }`);
                    }
                }
            }
            if (aggregateFields.length > 0) {
                returningFields.push(`aggregate {\n          ${aggregateFields.join('\n          ')}\n        }`);
            }
            if (returning) { // Add nodes if returning is also specified with aggregate
                const nodeFields = (Array.isArray(returning) ? returning : [returning])
                    .map(field => processReturningField(field, varCounterRef))
                    .filter(Boolean)
                    .join('\n          ');
                if (nodeFields) {
                    returningFields.push(`nodes {\n          ${nodeFields}\n        }`);
                }
            }
        }
        else if (returning) {
            (Array.isArray(returning) ? returning : [returning]) // Ensure it's an array
                .map(field => processReturningField(field, varCounterRef))
                .filter(Boolean) // Filter out empty strings from skipped fields
                .forEach(processedField => returningFields.push(processedField));
        }
        else if (queryInfo.returning_fields && !isByPkOperation && operation !== 'delete') { // Default fields for non-PK queries/subs/inserts
            returningFields.push('id');
            // Add other common fields if they exist in schema
            ['name', 'email', 'created_at', 'updated_at'].forEach(f => {
                if (queryInfo.returning_fields[f])
                    returningFields.push(f);
            });
        }
        else if (isByPkOperation && operation === 'delete') {
            // Default for delete_by_pk might be just the PK field or nothing practical to return
            // Often, affected_rows is preferred, handle below. Let's return PK if available.
            if (opts.pk_columns && queryInfo.returning_fields) {
                Object.keys(opts.pk_columns).forEach(pkField => {
                    if (queryInfo.returning_fields[pkField]) {
                        returningFields.push(pkField);
                    }
                });
            }
            else {
                returningFields.push('id'); // Default fallback
            }
        }
        else {
            // Default for mutations returning single object or _by_pk queries
            if (queryInfo.returning_fields) {
                returningFields.push('id'); // Default fallback
            }
        }
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
        let gqlOperationType;
        if (operation === 'query') {
            gqlOperationType = 'query';
        }
        else if (operation === 'subscription') {
            gqlOperationType = 'subscription';
        }
        else { // insert, update, delete
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
            const gqlQuery = (0, core_1.gql)(queryStr);
            return {
                queryString: queryStr,
                query: gqlQuery,
                variables,
                varCounter
            };
        }
        catch (error) {
            console.error("❌ Error parsing GraphQL query:", error.message);
            console.error("Generated Query String:", queryStr);
            console.error("Variables:", JSON.stringify(variables, null, 2));
            throw new Error(`Failed to parse generated GraphQL query: ${error.message}`);
        }
    };
}
// Export the factory function
exports.default = Generator;
