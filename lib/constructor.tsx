"use client";

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import _ from 'lodash';
import { useQuery, useSubscription, useClient } from "hasyx/lib/hasyx-client";
import { SidebarLayout } from "hasyx/components/sidebar/layout";
import { SidebarData } from "hasyx/components/sidebar";
import { Card, CardHeader, CardTitle, CardContent } from "hasyx/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "hasyx/components/ui/select";
import { Button } from "hasyx/components/ui/button";
import { Input } from "hasyx/components/ui/input";
import { Label } from "hasyx/components/ui/label";
import { Checkbox } from "hasyx/components/ui/checkbox";
import { Badge } from "hasyx/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "hasyx/components/ui/tabs";
import { Plus, X } from 'lucide-react';
import { Session } from 'next-auth';
import { useSession } from 'next-auth/react';

// Types
interface ConstructorState {
  table: string;
  where: Record<string, any>;
  returning: (string | NestedReturning)[];
}

interface NestedReturning {
  [relationName: string]: {
    where?: Record<string, any>;
    returning: (string | NestedReturning)[];
  };
}

interface HasyxConstructorProps {
  value: ConstructorState;
  onChange: (value: ConstructorState) => void;
  defaultTable?: string;
}

interface FieldInfo {
  name: string;
  type: string;
  isRelation: boolean;
  targetTable?: string;
}

// Utility functions
function setObjectAtPath<T extends Record<string, any>>(
  object: T, 
  path: string, 
  value: any
): T {
  _.set(object, path, value);
  return object;
}

function getObjectAtPath<T = any>(
  object: Record<string, any>, 
  path: string
): T | undefined {
  return _.get(object, path);
}

function getTablesFromSchema(schema: any): string[] {
  // Extract real tables from hasyx.tableMappings
  if (schema?.hasyx?.tableMappings) {
    return Object.keys(schema.hasyx.tableMappings)
      .filter(tableName => 
        // Filter out mapping tables and internal tables
        !tableName.includes('_mapping') &&
        !tableName.includes('_aggregate') &&
        !tableName.startsWith('__') &&
        !tableName.endsWith('_mutation_response')
      )
      .sort();
  }
  return [];
}

function getFieldsFromTable(schema: any, tableName: string): FieldInfo[] {
  // Find the corresponding GraphQL type for this table
  // First try exact match, then try with capitalization
  const possibleTypeNames = [
    tableName,
    tableName.toLowerCase(),
    tableName.charAt(0).toUpperCase() + tableName.slice(1),
    tableName.split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('_')
  ];
  
  let graphqlType: any = null;
  for (const typeName of possibleTypeNames) {
    graphqlType = schema?.data?.__schema?.types?.find((type: any) => type.name === typeName);
    if (graphqlType) break;
  }
  
  if (!graphqlType || !graphqlType?.fields) {
    // Fallback to basic fields for unknown tables, but keep backward compatibility for users
    const commonFields: FieldInfo[] = [
      { name: 'id', type: 'String', isRelation: false },
      { name: 'created_at', type: 'DateTime', isRelation: false },
      { name: 'updated_at', type: 'DateTime', isRelation: false }
    ];
    
    // Maintain backward compatibility for users table
    if (tableName === 'users') {
      return [
        ...commonFields,
        { name: 'name', type: 'String', isRelation: false },
        { name: 'email', type: 'String', isRelation: false },
        { name: 'accounts', type: 'Account', isRelation: true, targetTable: 'accounts' },
        { name: 'notifications', type: 'Notification', isRelation: true, targetTable: 'notifications' }
      ];
    }
    
    if (tableName === 'accounts') {
      return [
        ...commonFields,
        { name: 'provider', type: 'String', isRelation: false },
        { name: 'provider_id', type: 'String', isRelation: false },
        { name: 'user_id', type: 'String', isRelation: false },
        { name: 'user', type: 'User', isRelation: true, targetTable: 'users' }
      ];
    }
    
    if (tableName === 'notifications') {
      return [
        ...commonFields,
        { name: 'title', type: 'String', isRelation: false },
        { name: 'message', type: 'String', isRelation: false },
        { name: 'user_id', type: 'String', isRelation: false },
        { name: 'user', type: 'User', isRelation: true, targetTable: 'users' }
      ];
    }
    
    return commonFields;
  }
  
  return graphqlType?.fields?.map((field: any) => {
    const fieldType = field.type;
    const actualType = fieldType?.ofType || fieldType; // Handle NON_NULL wrappers
    
    // Determine if this is a relation
    const isRelation = actualType?.kind === 'OBJECT' || actualType?.kind === 'LIST';
    
    // Get the type name for display
    let typeName = 'String'; // default
    if (actualType?.name) {
      typeName = actualType.name;
    } else if (actualType?.ofType?.name) {
      typeName = actualType.ofType.name;
    }
    
    // Map GraphQL types to simplified types
    if (typeName === 'uuid') typeName = 'UUID';
    if (typeName === 'bigint') typeName = 'Int';
    if (typeName === 'timestamptz') typeName = 'DateTime';
    if (typeName === 'jsonb') typeName = 'JSONB';
    if (typeName === 'boolean') typeName = 'Boolean';
    
    return {
      name: field.name,
      type: typeName,
      isRelation,
      targetTable: isRelation ? actualType?.name : undefined
    };
  });
}

function getComparisonOperators(fieldType: string): Array<{name: string, label: string}> {
  const baseOperators = [
    { name: '_eq', label: 'equals' },
    { name: '_ne', label: 'not equals' },
    { name: '_is_null', label: 'is null' }
  ];
  
  if (fieldType === 'String') {
    return [
      ...baseOperators,
      { name: '_like', label: 'like' },
      { name: '_ilike', label: 'ilike' },
      { name: '_in', label: 'in' }
    ];
  }
  
  if (fieldType === 'Int' || fieldType === 'Float' || fieldType === 'DateTime') {
    return [
      ...baseOperators,
      { name: '_gt', label: '>' },
      { name: '_gte', label: '>=' },
      { name: '_lt', label: '<' },
      { name: '_lte', label: '<=' },
      { name: '_in', label: 'in' }
    ];
  }
  
  if (fieldType === 'Boolean') {
    return [
      { name: '_eq', label: 'equals' },
      { name: '_ne', label: 'not equals' }
    ];
  }
  
  return baseOperators;
}

// Where Input Component
function WhereInput({ value, onChange, operator, fieldType }: {
  value: any;
  onChange: (value: any) => void;
  operator: string;
  fieldType: string;
}) {
  if (operator === '_is_null') {
    return (
      <Select value={value?.toString() || 'false'} onValueChange={(val) => onChange(val === 'true')}>
        <SelectTrigger className="h-full border-0 rounded-none text-xs bg-transparent">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">true</SelectItem>
          <SelectItem value="false">false</SelectItem>
        </SelectContent>
      </Select>
    );
  }
  
  if (operator === '_in' || operator === '_nin') {
    return (
      <Input
        type="text"
        value={Array.isArray(value) ? value.join(', ') : value || ''}
        onChange={(e) => {
          const values = e.target.value.split(',').map(v => v.trim()).filter(v => v);
          onChange(values);
        }}
        placeholder="value1, value2, value3"
        className="h-full border-0 rounded-none text-xs bg-transparent focus:bg-transparent px-1"
      />
    );
  }
  
  if (fieldType === 'Boolean') {
    return (
      <Select value={value?.toString() || 'true'} onValueChange={(val) => onChange(val === 'true')}>
        <SelectTrigger className="h-full border-0 rounded-none text-xs bg-transparent">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">true</SelectItem>
          <SelectItem value="false">false</SelectItem>
        </SelectContent>
      </Select>
    );
  }
  
  if (fieldType === 'Int' || fieldType === 'Float') {
    return (
      <Input
        type="number"
        value={value || ''}
        onChange={(e) => onChange(Number(e.target.value))}
        placeholder="0"
        className="h-full border-0 rounded-none text-xs bg-transparent focus:bg-transparent px-1"
      />
    );
  }
  
  return (
    <Input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="value"
      className="h-full border-0 rounded-none text-xs bg-transparent focus:bg-transparent px-1"
    />
  );
}

// Where Field Component
function WhereField({ 
  fieldName, 
  fieldType, 
  value, 
  onUpdate, 
  onRemove 
}: {
  fieldName: string;
  fieldType: string;
  value: any;
  onUpdate: (operator: string, val: any) => void;
  onRemove: () => void;
}) {
  const operators = getComparisonOperators(fieldType);
  const currentOperator = Object.keys(value || {})[0] || '_eq';
  const currentValue = value?.[currentOperator];
  
  return (
    <div className="w-full flex items-center border rounded h-6 bg-background">
      {/* Field Name */}
      <div className="px-2 py-1 text-xs font-medium bg-muted/50 flex-shrink-0">
        {fieldName}
      </div>
      
      {/* Separator */}
      <div className="w-px h-4 bg-border"></div>
      
      {/* Operator Select */}
      <Select value={currentOperator} onValueChange={(op) => onUpdate(op, currentValue)}>
        <SelectTrigger className="h-6 border-0 rounded-none px-2 text-xs bg-transparent hover:bg-muted/50 flex-shrink-0 min-w-12 max-h-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {operators.map(op => (
            <SelectItem key={op.name} value={op.name} className="text-xs">{op.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {/* Separator */}
      <div className="w-px h-4 bg-border"></div>
      
      {/* Input */}
      <div className="flex-1 px-1">
        <WhereInput 
          value={currentValue}
          onChange={(val) => onUpdate(currentOperator, val)}
          operator={currentOperator}
          fieldType={fieldType}
        />
      </div>
      
      {/* Separator */}
      <div className="w-px h-4 bg-border"></div>
      
      {/* Delete Button */}
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={onRemove} 
        className="h-full w-6 px-0 border-0 rounded-none hover:bg-destructive/10 hover:text-destructive flex-shrink-0"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

// Recursive Returning Component
function ReturningSection({ 
  fields, 
  returning, 
  onReturningChange, 
  schema, 
  level = 0 
}: {
  fields: FieldInfo[];
  returning: (string | NestedReturning)[];
  onReturningChange: (newReturning: (string | NestedReturning)[]) => void;
  schema: any;
  level?: number;
}) {
  const addField = (fieldName: string, isRelation: boolean, targetTable?: string) => {
    if (isRelation && targetTable) {
      const newRelation: NestedReturning = {
        [fieldName]: {
          returning: ['id']
        }
      };
      onReturningChange([...returning, newRelation]);
    } else {
      onReturningChange([...returning, fieldName]);
    }
  };
  
  const removeField = (index: number) => {
    const newReturning = [...returning];
    newReturning.splice(index, 1);
    onReturningChange(newReturning);
  };
  
  const updateNestedReturning = (index: number, relationName: string, newNestedReturning: (string | NestedReturning)[]) => {
    const newReturning = [...returning];
    const item = newReturning[index] as NestedReturning;
    item[relationName].returning = newNestedReturning;
    onReturningChange(newReturning);
  };
  
  const updateNestedWhere = (index: number, relationName: string, newWhere: Record<string, any>) => {
    const newReturning = [...returning];
    const item = newReturning[index] as NestedReturning;
    item[relationName].where = newWhere;
    onReturningChange(newReturning);
  };
  
  const availableFields = fields.filter(field => 
    !returning.some(r => 
      typeof r === 'string' ? r === field.name : Object.keys(r)[0] === field.name
    )
  );
  
  return (
    <div className={level > 0 ? "ml-1 border-l pl-1" : ""}>
      <div className="flex items-center justify-between mb-1">
        <Label className="text-xs font-medium">Returning</Label>
        
        {availableFields.length > 0 && (
          <Select onValueChange={(fieldName) => {
            const field = fields.find(f => f.name === fieldName);
            if (field) {
              addField(field.name, field.isRelation, field.targetTable);
            }
          }}>
            <SelectTrigger className="square border-0 rounded-none hover:bg-destructive/10 hover:text-destructive flex-shrink-0 [&>svg:nth-child(2)]:hidden">
              <Plus className="h-2.5 w-2.5 flex-shrink-0" />
            </SelectTrigger>
            <SelectContent>
              {availableFields.map(field => (
                <SelectItem key={field.name} value={field.name} className="text-xs">
                  {field.name} {field.isRelation && <span className="text-muted-foreground">({field.targetTable})</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      
      <div className="space-y-1">
        {returning.map((item, index) => {
          if (typeof item === 'string') {
            return (
              <div key={index} className="w-full flex items-center border rounded h-6 bg-background">
                <div className="px-2 py-1 text-xs font-medium bg-muted/50 flex-1">
                  {item}
                </div>
                <div className="w-px h-4 bg-border"></div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => removeField(index)} 
                  className="h-full w-6 px-0 border-0 rounded-none hover:bg-destructive/10 hover:text-destructive flex-shrink-0"
                >
                  <X className="h-2.5 w-2.5" />
                </Button>
              </div>
            );
          } else {
            const relationName = Object.keys(item)[0];
            const relationData = item[relationName];
            const field = fields.find(f => f.name === relationName);
            const targetFields = field?.targetTable ? getFieldsFromTable(schema, field.targetTable) : [];
            
            return (
              <div key={index} className="border rounded p-1 my-1">
                <div className="w-full flex items-center border rounded h-6 bg-background mb-1">
                  <div className="px-2 py-1 text-xs font-medium bg-primary/10 flex-1">
                    {relationName}
                  </div>
                  <div className="w-px h-4 bg-border"></div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => removeField(index)} 
                    className="h-full w-6 px-0 border-0 rounded-none hover:bg-destructive/10 hover:text-destructive flex-shrink-0"
                  >
                    <X className="h-2.5 w-2.5" />
                  </Button>
                </div>
                
                <div className="space-y-1">
                  {/* Nested Where */}
                  <WhereSection 
                    fields={targetFields}
                    where={relationData.where || {}}
                    onWhereChange={(newWhere) => updateNestedWhere(index, relationName, newWhere)}
                    level={level + 1}
                  />
                  
                  {/* Nested Returning */}
                  <ReturningSection
                    fields={targetFields}
                    returning={relationData.returning}
                    onReturningChange={(newNestedReturning) => updateNestedReturning(index, relationName, newNestedReturning)}
                    schema={schema}
                    level={0}
                  />
                </div>
              </div>
            );
          }
        })}
      </div>
    </div>
  );
}

// Where Section Component
function WhereSection({ 
  fields, 
  where, 
  onWhereChange, 
  level = 0 
}: {
  fields: FieldInfo[];
  where: Record<string, any>;
  onWhereChange: (newWhere: Record<string, any>) => void;
  level?: number;
}) {
  const addWhereCondition = (fieldName: string) => {
    const newWhere = { ...where, [fieldName]: { _eq: '' } };
    onWhereChange(newWhere);
  };
  
  const updateWhereCondition = (fieldName: string, operator: string, val: any) => {
    const newWhere = { ...where, [fieldName]: { [operator]: val } };
    onWhereChange(newWhere);
  };
  
  const removeWhereCondition = (fieldName: string) => {
    const newWhere = { ...where };
    delete newWhere[fieldName];
    onWhereChange(newWhere);
  };
  
  // Include both regular fields and relations for where conditions
  const availableFields = fields.filter(field => !where[field.name]);
  
  return (
    <div className={level > 0 ? "mb-1" : "mb-2"}>
      <div className="flex items-center justify-between mb-1">
        <Label className="text-xs font-medium">Where</Label>
        
        {availableFields.length > 0 && (
          <Select onValueChange={(fieldName) => {
            addWhereCondition(fieldName);
          }}>
            <SelectTrigger className="square border-0 rounded-none hover:bg-destructive/10 hover:text-destructive flex-shrink-0 [&>svg:nth-child(2)]:hidden">
              <Plus className="h-2.5 w-2.5 flex-shrink-0" />
            </SelectTrigger>
            <SelectContent>
              {availableFields.map(field => (
                <SelectItem key={field.name} value={field.name} className="text-xs">
                  {field.name} {field.isRelation && <span className="text-muted-foreground">({field.targetTable})</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      
      <div className="space-y-1">
        {Object.entries(where).map(([fieldName, condition]) => {
          const field = fields.find(f => f.name === fieldName);
          return (
            <WhereField
              key={fieldName}
              fieldName={fieldName}
              fieldType={field?.type || 'String'}
              value={condition}
              onUpdate={(op, val) => updateWhereCondition(fieldName, op, val)}
              onRemove={() => removeWhereCondition(fieldName)}
            />
          );
        })}
      </div>
    </div>
  );
}

// Main HasyxConstructor component
function HasyxConstructor({ value, onChange, defaultTable = 'users' }: HasyxConstructorProps) {
  const [schema, setSchema] = useState<any>(null);
  
  // Load schema
  React.useEffect(() => {
    fetch('/hasura-schema.json')
      .then(res => res.json())
      .then(setSchema)
      .catch(console.error);
  }, []);
  
  const tables = useMemo(() => schema ? getTablesFromSchema(schema) : [], [schema]);
  const fields = useMemo(() => 
    schema && value.table ? getFieldsFromTable(schema, value.table) : [], 
    [schema, value.table]
  );
  
  const handleTableChange = (newTable: string) => {
    onChange({
      table: newTable,
      where: {},
      returning: []
    });
  };
  
  const handleWhereChange = (newWhere: Record<string, any>) => {
    onChange({ ...value, where: newWhere });
  };
  
  const handleReturningChange = (newReturning: (string | NestedReturning)[]) => {
    onChange({ ...value, returning: newReturning });
  };
  
  // Set default table if current table is empty or not in available tables
  React.useEffect(() => {
    if (schema && (!value.table || !tables.includes(value.table))) {
      const tableToSet = tables.includes(defaultTable) ? defaultTable : tables[0];
      if (tableToSet && tableToSet !== value.table) {
        handleTableChange(tableToSet);
      }
    }
  }, [schema, tables, value.table, defaultTable]);
  
  if (!schema) {
    return <div className="p-2 text-sm text-muted-foreground">Loading schema...</div>;
  }
  
  return (
    <div className="space-y-2">
      {/* Table Selection */}
      <Card>
        <CardContent className="pt-2 pb-2">
          <div className="w-full flex items-center border rounded h-6 bg-background mb-2">
            <div className="px-2 py-1 text-xs font-medium bg-muted/50 flex-shrink-0">
              Table
            </div>
            <div className="w-px h-4 bg-border"></div>
            <Select value={value.table} onValueChange={handleTableChange}>
              <SelectTrigger className="border-0 rounded-none px-2 text-xs bg-transparent hover:bg-muted/50 flex-1 max-h-full">
                <SelectValue placeholder="Select table" />
              </SelectTrigger>
              <SelectContent>
                {tables.map(table => (
                  <SelectItem key={table} value={table} className="text-xs">{table}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <WhereSection 
            fields={fields}
            where={value.where}
            onWhereChange={handleWhereChange}
          />
          <ReturningSection
            fields={fields}
            returning={value.returning}
            onReturningChange={handleReturningChange}
            schema={schema}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// Tab Components
function ExpTab({ constructorState }: { constructorState: ConstructorState }) {
  const queryOptions = constructorState.table ? {
    table: constructorState.table,
    where: Object.keys(constructorState.where).length > 0 ? constructorState.where : undefined,
    returning: constructorState.returning.length > 0 ? constructorState.returning : ['id']
  } : {
    table: 'users',
    where: undefined,
    returning: ['id']
  };

  return (
    <Card>
      <CardContent className="p-2">
        <pre className="text-xs bg-muted/30 p-2 rounded overflow-auto font-mono max-h-96">
          {JSON.stringify(queryOptions, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}

function GqlTab({ constructorState }: { constructorState: ConstructorState }) {
  const [operationType, setOperationType] = useState<'query' | 'subscription'>('query');
  const client = useClient();
  
  const queryOptions = useMemo(() => {
    if (!constructorState.table) return null;
    
    return {
      operation: operationType,
      table: constructorState.table,
      where: Object.keys(constructorState.where).length > 0 ? constructorState.where : undefined,
      returning: constructorState.returning.length > 0 ? constructorState.returning : ['id']
    };
  }, [constructorState, operationType]);

  const generatedQuery = useMemo(() => {
    if (!queryOptions || !client?.generate) return null;
    
    try {
      return client.generate(queryOptions);
    } catch (error: any) {
      return { error: error?.message || 'Unknown error' };
    }
  }, [queryOptions, client?.generate]);

  return (
    <div className="space-y-2">
      {/* Query/Subscription tabs */}
      <Tabs value={operationType} onValueChange={(value: string) => setOperationType(value as 'query' | 'subscription')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="query" className="text-xs h-full">query</TabsTrigger>
          <TabsTrigger value="subscription" className="text-xs h-full">subscription</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* GraphQL Query */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-xs">GraphQL Query</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 pb-2">
          {generatedQuery && 'error' in generatedQuery ? (
            <div className="text-red-500 text-xs">
              <pre className="whitespace-pre-wrap text-xs">{generatedQuery.error}</pre>
            </div>
          ) : (
            <pre className="text-xs bg-muted/30 p-2 rounded overflow-auto font-mono max-h-48">
              {generatedQuery?.queryString || 'Loading...'}
            </pre>
          )}
        </CardContent>
      </Card>

      {/* Variables */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-xs">Variables</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 pb-2">
          <pre className="text-xs bg-muted/30 p-2 rounded overflow-auto font-mono max-h-48">
            {generatedQuery && 'variables' in generatedQuery ? JSON.stringify(generatedQuery.variables, null, 2) : '{}'}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

function QueryTab({ constructorState }: { constructorState: ConstructorState }) {
  const queryOptions = constructorState.table ? {
    table: constructorState.table,
    where: Object.keys(constructorState.where).length > 0 ? constructorState.where : undefined,
    returning: constructorState.returning.length > 0 ? constructorState.returning : ['id']
  } : {
    table: 'users',
    where: undefined,
    returning: ['id']
  };
  
  const { data, loading, error } = useQuery(queryOptions);
  
  return (
    <Card>
      <CardContent className="p-2">
        {loading && <div className="text-muted-foreground text-xs">Loading...</div>}
        {error && (
          <div className="text-red-500 text-xs">
            <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(error, null, 2)}</pre>
          </div>
        )}
        {data && (
          <pre className="text-xs bg-muted/30 p-2 rounded overflow-auto font-mono max-h-96">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}

function SubscriptionTab({ constructorState }: { constructorState: ConstructorState }) {
  const queryOptions = constructorState.table ? {
    table: constructorState.table,
    where: Object.keys(constructorState.where).length > 0 ? constructorState.where : undefined,
    returning: constructorState.returning.length > 0 ? constructorState.returning : ['id']
  } : {
    table: 'users',
    where: undefined,
    returning: ['id']
  };
  
  const { data, loading, error } = useSubscription(queryOptions);
  
  return (
    <Card>
      <CardContent className="p-2">
        {loading && <div className="text-muted-foreground text-xs">Loading subscription...</div>}
        {error && (
          <div className="text-red-500 text-xs">
            <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(error, null, 2)}</pre>
          </div>
        )}
        {data && (
          <pre className="text-xs bg-muted/30 p-2 rounded overflow-auto font-mono max-h-96">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}

interface ConstructorProps {
  serverSession: Session | null;
  sidebarData: SidebarData;
}

export default function Constructor({ serverSession, sidebarData }: ConstructorProps) {
  const [constructorState, setConstructorState] = useState<ConstructorState>({
    table: 'users',
    where: {},
    returning: []
  });
  
  return (
    <SidebarLayout sidebarData={sidebarData} breadcrumb={[
      { title: 'Hasyx', link: '/' },
      { title: 'Constructor', link: '/hasyx/constructor' }
    ]}>
      <div className="flex flex-1 h-full">
        {/* Left side - Constructor */}
        <div className="flex-1 p-2 border-r overflow-auto">
          <h2 className="text-base font-semibold mb-2">Query Constructor</h2>
          <HasyxConstructor 
            value={constructorState}
            onChange={setConstructorState}
            defaultTable="users"
          />
        </div>
        
        {/* Right side - Tabs */}
        <div className="flex-1 p-2 overflow-auto">
          <h2 className="text-base font-semibold mb-2">Query Results</h2>
          <Tabs defaultValue="exp" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="exp" className="text-xs">exp</TabsTrigger>
              <TabsTrigger value="gql" className="text-xs">gql</TabsTrigger>
              <TabsTrigger value="query" className="text-xs">query</TabsTrigger>
              <TabsTrigger value="subscription" className="text-xs">subscription</TabsTrigger>
            </TabsList>
            
            <TabsContent value="exp" className="mt-2">
              <ExpTab constructorState={constructorState} />
            </TabsContent>
            
            <TabsContent value="gql" className="mt-2">
              <GqlTab constructorState={constructorState} />
            </TabsContent>
            
            <TabsContent value="query" className="mt-2">
              <QueryTab constructorState={constructorState} />
            </TabsContent>
            
            <TabsContent value="subscription" className="mt-2">
              <SubscriptionTab constructorState={constructorState} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </SidebarLayout>
  );
}

export { HasyxConstructor }; 