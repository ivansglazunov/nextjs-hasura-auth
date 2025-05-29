"use client";

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import _ from 'lodash';
import { useQuery } from "hasyx/lib/hasyx-client";
import { SidebarLayout } from "hasyx/components/sidebar/layout";
import { SidebarData } from "hasyx/components/sidebar";
import { Card, CardHeader, CardTitle, CardContent } from "hasyx/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "hasyx/components/ui/select";
import { Button } from "hasyx/components/ui/button";
import { Input } from "hasyx/components/ui/input";
import { Label } from "hasyx/components/ui/label";
import { Checkbox } from "hasyx/components/ui/checkbox";
import { Badge } from "hasyx/components/ui/badge";
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
  // Mock implementation for now - in real implementation we'd parse the schema types
  const commonFields: FieldInfo[] = [
    { name: 'id', type: 'String', isRelation: false },
    { name: 'created_at', type: 'DateTime', isRelation: false },
    { name: 'updated_at', type: 'DateTime', isRelation: false }
  ];
  
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
        <SelectTrigger className="w-20 h-6 text-xs">
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
        className="min-w-32 h-6 text-xs"
      />
    );
  }
  
  if (fieldType === 'Boolean') {
    return (
      <Select value={value?.toString() || 'true'} onValueChange={(val) => onChange(val === 'true')}>
        <SelectTrigger className="w-20 h-6 text-xs">
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
        className="w-20 h-6 text-xs"
      />
    );
  }
  
  return (
    <Input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="value"
      className="min-w-24 h-6 text-xs"
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
    <div className="flex items-center gap-2 py-1">
      <Badge variant="outline" className="min-w-16 text-xs">{fieldName}</Badge>
      
      <Select value={currentOperator} onValueChange={(op) => onUpdate(op, currentValue)}>
        <SelectTrigger className="w-20 h-6 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {operators.map(op => (
            <SelectItem key={op.name} value={op.name} className="text-xs">{op.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <WhereInput 
        value={currentValue}
        onChange={(val) => onUpdate(currentOperator, val)}
        operator={currentOperator}
        fieldType={fieldType}
      />
      
      <Button variant="ghost" size="sm" onClick={onRemove} className="h-6 w-6 p-0 rounded-full">
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
    <div className={level > 0 ? "ml-3 border-l pl-2" : ""}>
      <div className="flex items-center justify-between mb-2">
        <Label className="text-sm font-medium">Returning</Label>
        
        {availableFields.length > 0 && (
          <Select onValueChange={(fieldName) => {
            const field = fields.find(f => f.name === fieldName);
            if (field) {
              addField(field.name, field.isRelation, field.targetTable);
            }
          }}>
            <SelectTrigger className="w-6 h-6 rounded-full p-0 border-2">
              <Plus className="h-3 w-3" />
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
              <div key={index} className="flex items-center gap-2 py-1">
                <Badge variant="secondary" className="text-xs">{item}</Badge>
                <Button variant="ghost" size="sm" onClick={() => removeField(index)} className="h-6 w-6 p-0 rounded-full">
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          } else {
            const relationName = Object.keys(item)[0];
            const relationData = item[relationName];
            const field = fields.find(f => f.name === relationName);
            const targetFields = field?.targetTable ? getFieldsFromTable(schema, field.targetTable) : [];
            
            return (
              <div key={index} className="border rounded p-2 my-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="text-xs">{relationName}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => removeField(index)} className="h-6 w-6 p-0 rounded-full">
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                
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
                  level={level + 1}
                />
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
    <div className={level > 0 ? "mb-2" : "mb-3"}>
      <div className="flex items-center justify-between mb-2">
        <Label className="text-sm font-medium">Where</Label>
        
        {availableFields.length > 0 && (
          <Select onValueChange={(fieldName) => {
            addWhereCondition(fieldName);
          }}>
            <SelectTrigger className="w-6 h-6 rounded-full p-0 border-2">
              <Plus className="h-3 w-3" />
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
    <div className="space-y-3">
      {/* Table Selection */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Table</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 pb-3">
          <Select value={value.table} onValueChange={handleTableChange}>
            <SelectTrigger className="h-7">
              <SelectValue placeholder="Select table" />
            </SelectTrigger>
            <SelectContent>
              {tables.map(table => (
                <SelectItem key={table} value={table} className="text-xs">{table}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      
      {/* Where Conditions */}
      <Card>
        <CardContent className="pt-3 pb-3">
          <WhereSection 
            fields={fields}
            where={value.where}
            onWhereChange={handleWhereChange}
          />
        </CardContent>
      </Card>
      
      {/* Returning Fields */}
      <Card>
        <CardContent className="pt-3 pb-3">
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
    <SidebarLayout sidebarData={sidebarData} breadcrumb={[
      { title: 'Hasyx', link: '/' },
      { title: 'Constructor', link: '/hasyx/constructor' }
    ]}>
      <div className="flex flex-1 h-full">
        {/* Left side - Constructor */}
        <div className="flex-1 p-3 border-r overflow-auto">
          <h2 className="text-lg font-semibold mb-3">Query Constructor</h2>
          <HasyxConstructor 
            value={constructorState}
            onChange={setConstructorState}
            defaultTable="users"
          />
        </div>
        
        {/* Right side - Results */}
        <div className="flex-1 p-3 overflow-auto">
          <h2 className="text-lg font-semibold mb-3">Query Results</h2>
          <Card>
            <CardContent className="p-3">
              {loading && <div className="text-muted-foreground text-sm">Loading...</div>}
              {error && (
                <div className="text-red-500 text-sm">
                  <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(error, null, 2)}</pre>
                </div>
              )}
              {data && (
                <pre className="text-xs bg-muted/30 p-3 rounded overflow-auto font-mono max-h-96">
                  {JSON.stringify(data, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </SidebarLayout>
  );
}

export { HasyxConstructor }; 