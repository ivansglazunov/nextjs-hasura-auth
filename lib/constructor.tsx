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
import { Plus, X, Search } from 'lucide-react';
import { Session } from 'next-auth';
import { useSession } from 'next-auth/react';
import hasyxSchema from 'hasyx/app/hasyx/hasura-schema.json';
import { cn } from 'hasyx/lib/utils';

function getFieldsForType(graphqlType: any, schema: any): any[] {
  if (!graphqlType?.fields) return [];
  return graphqlType.fields.map((field: any) => {
    let currentType = field.type;
    let isList = false;

    // Unwrap NON_NULL
    if (currentType.kind === 'NON_NULL') {
      currentType = currentType.ofType;
    }

    // Check for LIST
    if (currentType.kind === 'LIST') {
      isList = true;
      currentType = currentType.ofType; // Unwrap list
      if (currentType.kind === 'NON_NULL') {
        currentType = currentType.ofType; // Unwrap NON_NULL inside list
      }
    }

    const isObjectRelation = currentType.kind === 'OBJECT';
    const isRelation = isObjectRelation;
    const isScalar = currentType.kind === 'SCALAR';

    const typeName = currentType.name;
    let targetTypename: string | undefined = undefined;

    if (isRelation) {
        const tableMappings = schema?.hasyx?.tableMappings;
        if (tableMappings) {
            // Find the table mapping where the 'type' matches our GQL type name
            const mappingKey = Object.keys(tableMappings).find(key => {
                const mapping = tableMappings[key];
                return mapping.type === currentType.name;
            });
            targetTypename = mappingKey || currentType.name; // The key is the __typename
        } else {
            targetTypename = currentType.name;
        }
    }
    
    return {
      name: field.name,
      isRelation,
      isList,
      isScalar,
      typeName,
      targetTypename,
    };
  });
}

function getFieldDetails(schema: any, typename: string): any[] {
  if (!typename) return [];
  const tableConfig = schema?.hasyx?.tableMappings?.[typename];
  const typeNameFromSchema = tableConfig?.type || typename;

  let graphqlType = schema?.data?.__schema?.types?.find((type: any) => type.name === typeNameFromSchema);
  
  if (!graphqlType || !graphqlType?.fields) {
    graphqlType = schema?.data?.__schema?.types?.find((type: any) => type.name === typename);
  }

  return getFieldsForType(graphqlType, schema);
}

export function getObjectRelationsByTypename(schema: any, typename: string): Record<string, string> {
    const fields = getFieldDetails(schema, typename);
    const relations: Record<string, string> = {};
    fields.filter(f => f.isRelation && !f.isList && f.targetTypename).forEach(f => {
        relations[f.name] = f.targetTypename!;
    });
    return relations;
}

export function getArrayRelationsByTypename(schema: any, typename: string): Record<string, string> {
    const fields = getFieldDetails(schema, typename);
    const relations: Record<string, string> = {};
    fields.filter(f => f.isRelation && f.isList && f.targetTypename).forEach(f => {
        relations[f.name] = f.targetTypename!;
    });
    return relations;
}

export function getIdFieldsByTypename(schema: any, typename: string): string[] {
    const fields = getFieldDetails(schema, typename);
    return fields.filter(f => f.isScalar && f.typeName === 'uuid').map(f => f.name);
}

// Types
interface ConstructorState {
  table: string;
  where: Record<string, any>;
  returning: (string | NestedReturning)[];
  limit?: number;
  offset?: number;
  order_by?: Array<{ [field: string]: 'asc' | 'desc' }>;
  targetTable?: string;
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
  schema?: any;
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

// Utility function to sort fields: physical fields first, then relations
function sortFieldsByType(fields: FieldInfo[]): FieldInfo[] {
  const physicalFields = fields.filter(field => !field.isRelation);
  const relationFields = fields.filter(field => field.isRelation);
  
  // Sort each group alphabetically by name
  physicalFields.sort((a, b) => a.name.localeCompare(b.name));
  relationFields.sort((a, b) => a.name.localeCompare(b.name));
  
  return [...physicalFields, ...relationFields];
}

// Utility function to identify primary key field
function getPrimaryKeyField(fields: FieldInfo[]): string | null {
  // Look for common primary key field names
  const primaryKeyNames = ['id', 'uuid', 'pk', '_id'];
  
  for (const pkName of primaryKeyNames) {
    const field = fields.find(f => f.name === pkName && !f.isRelation);
    if (field) {
      return field.name;
    }
  }
  
  return null;
}

// Utility function to check if where clause should be converted to pk_columns
function shouldUsePkColumns(where: Record<string, any>, primaryKeyField: string | null): { usePk: boolean; pkValue?: any; remainingWhere: Record<string, any> } {
  if (!primaryKeyField || !where[primaryKeyField]) {
    return { usePk: false, remainingWhere: where };
  }
  
  const whereKeys = Object.keys(where);
  
  // If only primary key is in where and it's a simple equality check
  if (whereKeys.length === 1 && whereKeys[0] === primaryKeyField) {
    const condition = where[primaryKeyField];
    // Check if it's a simple _eq condition
    if (condition && typeof condition === 'object' && condition._eq !== undefined) {
      return { 
        usePk: true, 
        pkValue: condition._eq,
        remainingWhere: {}
      };
    }
  }
  
  return { usePk: false, remainingWhere: where };
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
  
  // Sort fields: physical fields first, then relations
  const sortedAvailableFields = sortFieldsByType(availableFields);
  
  return (
    <div className={level > 0 ? "ml-1 border-l pl-1" : ""}>
      <div className="flex items-center justify-between mb-1">
        <Label className="text-xs font-medium">Returning</Label>
        
        <div className="flex items-center">
          {returning.length > 0 && (
            <Button variant="ghost" onClick={() => onReturningChange([])} className="h-6 w-6 p-0 rounded-none">
              <X className="h-2.5 w-2.5" />
            </Button>
          )}
          {sortedAvailableFields.length > 0 && (
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
                {sortedAvailableFields.map(field => (
                  <SelectItem key={field.name} value={field.name} className="text-xs">
                    {field.name} {field.isRelation && <span className="text-muted-foreground">({field.targetTable})</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
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
  
  // Sort fields: physical fields first, then relations
  const sortedAvailableFields = sortFieldsByType(availableFields);
  
  // Get primary key field
  const primaryKeyField = getPrimaryKeyField(fields);

  return (
    <div className={level > 0 ? "mb-1" : "mb-2"}>
      <div className="flex items-center justify-between mb-1">
        <Label className="text-xs font-medium">Where</Label>
        
        <div className="flex items-center">
          {Object.keys(where).length > 0 && (
            <Button variant="ghost" onClick={() => onWhereChange({})} className="h-6 w-6 p-0 rounded-none">
              <X className="h-2.5 w-2.5" />
            </Button>
          )}
          {sortedAvailableFields.length > 0 && (
            <Select onValueChange={(fieldName) => {
              addWhereCondition(fieldName);
            }}>
              <SelectTrigger className="square border-0 rounded-none hover:bg-destructive/10 hover:text-destructive flex-shrink-0 [&>svg:nth-child(2)]:hidden">
                <Plus className="h-2.5 w-2.5 flex-shrink-0" />
              </SelectTrigger>
              <SelectContent>
                {sortedAvailableFields.map(field => (
                  <SelectItem key={field.name} value={field.name} className="text-xs">
                    <div className="flex items-center gap-1">
                      <span>{field.name}</span>
                      {field.name === primaryKeyField && (
                        <Badge variant="outline" className="text-xs px-1 py-0 h-3">PK</Badge>
                      )}
                      {field.isRelation && (
                        <span className="text-muted-foreground">({field.targetTable})</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
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

// Limit/Offset Section Component
function LimitOffsetSection({
  limit,
  offset,
  onLimitChange,
  onOffsetChange
}: {
  limit?: number;
  offset?: number;
  onLimitChange: (limit: number | undefined) => void;
  onOffsetChange: (offset: number | undefined) => void;
}) {
  return (
    <div className="mb-2">
      <Label className="text-xs font-medium mb-1 block">Pagination</Label>
      <div className="grid grid-cols-2 gap-1">
        <div className="w-full flex items-center border rounded h-6 bg-background">
          <div className="px-2 py-1 text-xs font-medium bg-muted/50 flex-shrink-0">
            Limit
          </div>
          <div className="w-px h-4 bg-border"></div>
          <Input
            type="number"
            value={limit || ''}
            onChange={(e) => {
              const val = e.target.value === '' ? undefined : Number(e.target.value);
              onLimitChange(val);
            }}
            placeholder="100"
            className="h-full border-0 rounded-none text-xs bg-transparent focus:bg-transparent px-1"
            min="0"
          />
        </div>
        
        <div className="w-full flex items-center border rounded h-6 bg-background">
          <div className="px-2 py-1 text-xs font-medium bg-muted/50 flex-shrink-0">
            Offset
          </div>
          <div className="w-px h-4 bg-border"></div>
          <Input
            type="number"
            value={offset || ''}
            onChange={(e) => {
              const val = e.target.value === '' ? undefined : Number(e.target.value);
              onOffsetChange(val);
            }}
            placeholder="0"
            className="h-full border-0 rounded-none text-xs bg-transparent focus:bg-transparent px-1"
            min="0"
          />
        </div>
      </div>
    </div>
  );
}

// Order By Field Component
function OrderByField({
  field,
  direction,
  onUpdate,
  onRemove
}: {
  field: string;
  direction: 'asc' | 'desc';
  onUpdate: (field: string, direction: 'asc' | 'desc') => void;
  onRemove: () => void;
}) {
  return (
    <div className="w-full flex items-center border rounded h-6 bg-background">
      <div className="px-2 py-1 text-xs font-medium bg-muted/50 flex-shrink-0">
        {field}
      </div>
      <div className="w-px h-4 bg-border"></div>
      <Select value={direction} onValueChange={(dir: 'asc' | 'desc') => onUpdate(field, dir)}>
        <SelectTrigger className="h-6 border-0 rounded-none px-2 text-xs bg-transparent hover:bg-muted/50 flex-shrink-0 min-w-12 max-h-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="asc" className="text-xs">↑ asc</SelectItem>
          <SelectItem value="desc" className="text-xs">↓ desc</SelectItem>
        </SelectContent>
      </Select>
      <div className="w-px h-4 bg-border"></div>
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

// Order By Section Component
function OrderBySection({
  fields,
  orderBy,
  onChange
}: {
  fields: FieldInfo[];
  orderBy?: Array<{ [field: string]: 'asc' | 'desc' }>;
  onChange: (orderBy: Array<{ [field: string]: 'asc' | 'desc' }> | undefined) => void;
}) {
  const addOrderBy = (fieldName: string) => {
    const newOrderBy = [...(orderBy || []), { [fieldName]: 'asc' as const }];
    onChange(newOrderBy);
  };
  
  const updateOrderBy = (index: number, field: string, direction: 'asc' | 'desc') => {
    if (!orderBy) return;
    const newOrderBy = [...orderBy];
    newOrderBy[index] = { [field]: direction };
    onChange(newOrderBy);
  };
  
  const removeOrderBy = (index: number) => {
    if (!orderBy) return;
    const newOrderBy = [...orderBy];
    newOrderBy.splice(index, 1);
    onChange(newOrderBy.length === 0 ? undefined : newOrderBy);
  };
  
  // Get fields that aren't already used in order_by
  const usedFields = new Set((orderBy || []).map(order => Object.keys(order)[0]));
  const availableFields = fields.filter(field => !usedFields.has(field.name));
  const sortedAvailableFields = sortFieldsByType(availableFields);
  
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-1">
        <Label className="text-xs font-medium">Order By</Label>
        
        {sortedAvailableFields.length > 0 && (
          <Select onValueChange={addOrderBy}>
            <SelectTrigger className="square border-0 rounded-none hover:bg-destructive/10 hover:text-destructive flex-shrink-0 [&>svg:nth-child(2)]:hidden">
              <Plus className="h-2.5 w-2.5 flex-shrink-0" />
            </SelectTrigger>
            <SelectContent>
              {sortedAvailableFields.map(field => (
                <SelectItem key={field.name} value={field.name} className="text-xs">
                  {field.name} {field.isRelation && <span className="text-muted-foreground">({field.targetTable})</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      
      <div className="space-y-1">
        {(orderBy || []).map((order, index) => {
          const field = Object.keys(order)[0];
          const direction = order[field];
          return (
            <OrderByField
              key={`${field}-${index}`}
              field={field}
              direction={direction}
              onUpdate={(newField, newDirection) => updateOrderBy(index, newField, newDirection)}
              onRemove={() => removeOrderBy(index)}
            />
          );
        })}
      </div>
    </div>
  );
}

// Main HasyxConstructor component
function HasyxConstructor({ value, onChange, defaultTable = 'users', schema = hasyxSchema }: HasyxConstructorProps) {
  const tables = useMemo(() => schema ? getTablesFromSchema(schema) : [], [schema]);
  const fields = useMemo(() => 
    schema && value.table ? getFieldsFromTable(schema, value.table) : [], 
    [schema, value.table]
  );
  
  const handleTableChange = (newTable: string) => {
    // Get fields for the new table
    const newTableFields = schema ? getFieldsFromTable(schema, newTable) : [];
    
    // Auto-populate returning with all physical fields (non-relation fields)
    // Exclude Hasyx system fields
    const physicalFields = newTableFields
      .filter(field => !field.isRelation && !field.name.startsWith('_hasyx_'))
      .map(field => field.name);
    
    onChange({
      table: newTable,
      where: {},
      returning: physicalFields,
      limit: undefined,
      offset: undefined,
      order_by: undefined
    });
  };
  
  const handleWhereChange = (newWhere: Record<string, any>) => {
    onChange({ ...value, where: newWhere });
  };
  
  const handleReturningChange = (newReturning: (string | NestedReturning)[]) => {
    onChange({ ...value, returning: newReturning });
  };
  
  const handleLimitChange = (limit: number | undefined) => {
    onChange({ ...value, limit });
  };
  
  const handleOffsetChange = (offset: number | undefined) => {
    onChange({ ...value, offset });
  };
  
  const handleOrderByChange = (orderBy: Array<{ [field: string]: 'asc' | 'desc' }> | undefined) => {
    onChange({ ...value, order_by: orderBy });
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
          <LimitOffsetSection
            limit={value.limit}
            offset={value.offset}
            onLimitChange={handleLimitChange}
            onOffsetChange={handleOffsetChange}
          />
          <OrderBySection
            fields={fields}
            orderBy={value.order_by}
            onChange={handleOrderByChange}
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
  const fields = constructorState.table ? getFieldsFromTable(null, constructorState.table) : [];
  const primaryKeyField = getPrimaryKeyField(fields);
  const { usePk, pkValue, remainingWhere } = shouldUsePkColumns(constructorState.where, primaryKeyField);
  
  const queryOptions = constructorState.table ? {
    table: constructorState.table,
    ...(usePk ? { pk_columns: { [primaryKeyField!]: pkValue } } : {}),
    ...(Object.keys(remainingWhere).length > 0 ? { where: remainingWhere } : {}),
    ...(constructorState.limit ? { limit: constructorState.limit } : {}),
    ...(constructorState.offset ? { offset: constructorState.offset } : {}),
    ...(constructorState.order_by && constructorState.order_by.length > 0 ? { order_by: constructorState.order_by } : {}),
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
    
    const fields = getFieldsFromTable(null, constructorState.table);
    const primaryKeyField = getPrimaryKeyField(fields);
    const { usePk, pkValue, remainingWhere } = shouldUsePkColumns(constructorState.where, primaryKeyField);
    
    return {
      operation: operationType,
      table: constructorState.table,
      ...(usePk ? { pk_columns: { [primaryKeyField!]: pkValue } } : {}),
      ...(Object.keys(remainingWhere).length > 0 ? { where: remainingWhere } : {}),
      ...(constructorState.limit ? { limit: constructorState.limit } : {}),
      ...(constructorState.offset ? { offset: constructorState.offset } : {}),
      ...(constructorState.order_by && constructorState.order_by.length > 0 ? { order_by: constructorState.order_by } : {}),
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
  const fields = constructorState.table ? getFieldsFromTable(null, constructorState.table) : [];
  const primaryKeyField = getPrimaryKeyField(fields);
  const { usePk, pkValue, remainingWhere } = shouldUsePkColumns(constructorState.where, primaryKeyField);
  
  const queryOptions = constructorState.table ? {
    table: constructorState.table,
    ...(usePk ? { pk_columns: { [primaryKeyField!]: pkValue } } : {}),
    ...(Object.keys(remainingWhere).length > 0 ? { where: remainingWhere } : {}),
    ...(constructorState.limit ? { limit: constructorState.limit } : {}),
    ...(constructorState.offset ? { offset: constructorState.offset } : {}),
    ...(constructorState.order_by && constructorState.order_by.length > 0 ? { order_by: constructorState.order_by } : {}),
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
  const fields = constructorState.table ? getFieldsFromTable(null, constructorState.table) : [];
  const primaryKeyField = getPrimaryKeyField(fields);
  const { usePk, pkValue, remainingWhere } = shouldUsePkColumns(constructorState.where, primaryKeyField);
  
  const queryOptions = constructorState.table ? {
    table: constructorState.table,
    ...(usePk ? { pk_columns: { [primaryKeyField!]: pkValue } } : {}),
    ...(Object.keys(remainingWhere).length > 0 ? { where: remainingWhere } : {}),
    ...(constructorState.limit ? { limit: constructorState.limit } : {}),
    ...(constructorState.offset ? { offset: constructorState.offset } : {}),
    ...(constructorState.order_by && constructorState.order_by.length > 0 ? { order_by: constructorState.order_by } : {}),
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

// Results component (right side tabs)
function HasyxConstructorResults({ constructorState }: { constructorState: ConstructorState }) {
  return (
    <div className="h-full">
      <Tabs defaultValue="exp" className="w-full h-full flex flex-col">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="exp" className="text-xs">exp</TabsTrigger>
          <TabsTrigger value="gql" className="text-xs">gql</TabsTrigger>
          <TabsTrigger value="query" className="text-xs">query</TabsTrigger>
          <TabsTrigger value="subscription" className="text-xs">subscription</TabsTrigger>
        </TabsList>
        
        <TabsContent value="exp" className="mt-2 flex-1">
          <ExpTab constructorState={constructorState} />
        </TabsContent>
        
        <TabsContent value="gql" className="mt-2 flex-1">
          <GqlTab constructorState={constructorState} />
        </TabsContent>
        
        <TabsContent value="query" className="mt-2 flex-1">
          <QueryTab constructorState={constructorState} />
        </TabsContent>
        
        <TabsContent value="subscription" className="mt-2 flex-1">
          <SubscriptionTab constructorState={constructorState} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Columns layout (current layout for constructor page)
function HasyxConstructorColumns({ 
  value, 
  onChange, 
  defaultTable = 'users',
  schema = hasyxSchema
}: {
  value: ConstructorState;
  onChange: (value: ConstructorState) => void;
  defaultTable?: string;
  schema?: any;
}) {
  return (
    <div className="flex flex-1 h-full">
      {/* Left side - Constructor */}
      <div className="flex-1 p-2 border-r overflow-auto">
        <h2 className="text-base font-semibold mb-2">Query Constructor</h2>
        <HasyxConstructor 
          value={value}
          onChange={onChange}
          defaultTable={defaultTable}
          schema={schema}
        />
      </div>
      
      {/* Right side - Results */}
      <div className="flex-1 p-2 overflow-auto">
        <h2 className="text-base font-semibold mb-2">Query Results</h2>
        <HasyxConstructorResults constructorState={value} />
      </div>
    </div>
  );
}

// Tabs layout (new layout for floating cards)
function HasyxConstructorTabs({ 
  value, 
  onChange, 
  defaultTable = 'users',
  schema = hasyxSchema
}: {
  value: ConstructorState;
  onChange: (value: ConstructorState) => void;
  defaultTable?: string;
  schema?: any;
}) {
  return (
    <div className="w-full h-full">
      <Tabs defaultValue="constructor" className="w-full h-full flex flex-col">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="constructor" className="text-xs">Constructor</TabsTrigger>
          <TabsTrigger value="results" className="text-xs">Results</TabsTrigger>
        </TabsList>
        
        <TabsContent value="constructor" className="mt-2 flex-1 overflow-auto">
          <HasyxConstructor 
            value={value}
            onChange={onChange}
            defaultTable={defaultTable}
            schema={schema}
          />
        </TabsContent>
        
        <TabsContent value="results" className="mt-2 flex-1 overflow-auto">
          <HasyxConstructorResults constructorState={value} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Button component with modal dialog
function HasyxConstructorButton({ 
  value, 
  onChange, 
  defaultTable = 'users',
  icon,
  size = 'default',
  schema = hasyxSchema,
  children = null,
  ...props
}: {
  value: ConstructorState;
  onChange: (value: ConstructorState) => void;
  defaultTable?: string;
  icon?: React.ReactNode;
  size?: 'sm' | 'default' | 'lg';
  schema?: any;
  children?: React.ReactNode;
  [key: string]: any;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {children ? <Button 
        variant="outline" 
        size={size}
        onClick={() => setIsOpen(true)}
        {...props}
        className={cn('square', props.className)}
      >
        {children}
      </Button> : <Button 
        variant="outline" 
        size={size}
        onClick={() => setIsOpen(true)}
        {...props}
        className={cn('square', props.className)}
      >
        {icon || <Search className="h-4 w-4" />}
      </Button>}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-6xl h-[80vh] max-h-[800px] relative">
            <div className="absolute top-2 right-2 z-10">
              <Button 
                variant="ghost" 
                size="sm"
                className="square"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <CardContent className="p-4 h-full">
              <HasyxConstructorTabs
                value={value}
                onChange={onChange}
                defaultTable={defaultTable}
                schema={schema}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

interface ConstructorProps {
  serverSession: Session | null;
  sidebarData: SidebarData;
  schema?: any;
}

export default function Constructor({ serverSession, sidebarData, schema = hasyxSchema }: ConstructorProps) {
  const [constructorState, setConstructorState] = useState<ConstructorState>({
    table: 'users',
    where: {},
    returning: [],
    limit: undefined,
    offset: undefined,
    order_by: undefined
  });
  
  return (
    <SidebarLayout sidebarData={sidebarData} breadcrumb={[
      { title: 'Hasyx', link: '/' },
      { title: 'Constructor', link: '/hasyx/constructor' }
    ]}>
      <HasyxConstructorColumns
        value={constructorState}
        onChange={setConstructorState}
        defaultTable="users"
        schema={hasyxSchema}
      />
    </SidebarLayout>
  );
}

export { HasyxConstructor, HasyxConstructorResults, HasyxConstructorColumns, HasyxConstructorTabs, HasyxConstructorButton }; 