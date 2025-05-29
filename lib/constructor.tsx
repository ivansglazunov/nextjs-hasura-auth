"use client";

import { SidebarData } from "hasyx/components/sidebar";
import { SidebarLayout } from "hasyx/components/sidebar/layout";
import { Session } from "next-auth";
import { useCallback, useState, useMemo } from "react";
import { useQuery } from "hasyx/lib/hasyx-client";
import _ from 'lodash';
import { Button } from "hasyx/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "hasyx/components/ui/select";
import { Checkbox } from "hasyx/components/ui/checkbox";
import { Input } from "hasyx/components/ui/input";
import { Label } from "hasyx/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "hasyx/components/ui/card";

// Types
interface ConstructorState {
  table: string;
  where: Record<string, any>;
  returning: (string | Record<string, any>)[];
}

interface HasyxConstructorProps {
  value: ConstructorState;
  onChange: (value: ConstructorState) => void;
}

// Utility functions for object path manipulation
function setObjectAtPath<T extends Record<string, any>>(
  object: T, 
  path: string, 
  value: any
): T {
  const cloned = _.cloneDeep(object);
  _.set(cloned, path, value);
  return cloned;
}

function getObjectAtPath<T = any>(
  object: Record<string, any>, 
  path: string
): T | undefined {
  return _.get(object, path);
}

// Parse Hasura schema functions
function getTablesFromSchema(schema: any): string[] {
  if (!schema?.data?.__schema?.types) return [];
  
  return schema.data.__schema.types
    .filter((type: any) => 
      type.kind === 'OBJECT' && 
      type.name && 
      !type.name.startsWith('__') &&
      !type.name.endsWith('_mutation_response') &&
      !type.name.endsWith('_aggregate') &&
      !type.name.endsWith('_aggregate_fields') &&
      type.fields &&
      type.fields.length > 0
    )
    .map((type: any) => type.name)
    .sort();
}

function getFieldsFromTable(schema: any, tableName: string): Array<{name: string, type: string}> {
  if (!schema?.data?.__schema?.types) return [];
  
  const tableType = schema.data.__schema.types.find((type: any) => type.name === tableName);
  if (!tableType?.fields) return [];
  
  return tableType.fields
    .filter((field: any) => !field.name.endsWith('_aggregate'))
    .map((field: any) => ({
      name: field.name,
      type: getFieldTypeFromSchema(field.type)
    }));
}

function getFieldTypeFromSchema(fieldType: any): string {
  if (!fieldType) return 'String';
  
  if (fieldType.kind === 'NON_NULL') {
    return getFieldTypeFromSchema(fieldType.ofType);
  }
  
  if (fieldType.kind === 'LIST') {
    return getFieldTypeFromSchema(fieldType.ofType);
  }
  
  return fieldType.name || 'String';
}

function getComparisonOperators(fieldType: string): Array<{name: string, label: string}> {
  const baseOps = [
    { name: '_eq', label: 'equals' },
    { name: '_neq', label: 'not equals' },
    { name: '_is_null', label: 'is null' }
  ];
  
  if (['Int', 'Float', 'numeric', 'timestamptz'].includes(fieldType)) {
    baseOps.push(
      { name: '_gt', label: 'greater than' },
      { name: '_gte', label: 'greater than or equal' },
      { name: '_lt', label: 'less than' },
      { name: '_lte', label: 'less than or equal' }
    );
  }
  
  if (['String', 'text'].includes(fieldType)) {
    baseOps.push(
      { name: '_like', label: 'like' },
      { name: '_ilike', label: 'case insensitive like' }
    );
  }
  
  baseOps.push(
    { name: '_in', label: 'in list' },
    { name: '_nin', label: 'not in list' }
  );
  
  return baseOps;
}

// Input component for where conditions
function WhereInput({ value, onChange, operator, fieldType }: {
  value: any;
  onChange: (value: any) => void;
  operator: string;
  fieldType: string;
}) {
  if (operator === '_is_null') {
    return (
      <Select value={value ? 'true' : 'false'} onValueChange={(val) => onChange(val === 'true')}>
        <SelectTrigger className="w-32">
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
        placeholder="value1, value2, value3"
        value={Array.isArray(value) ? value.join(', ') : ''}
        onChange={(e) => {
          const vals = e.target.value.split(',').map(v => v.trim()).filter(Boolean);
          onChange(vals);
        }}
      />
    );
  }
  
  if (fieldType === 'Boolean') {
    return (
      <Select value={value ? 'true' : 'false'} onValueChange={(val) => onChange(val === 'true')}>
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">true</SelectItem>
          <SelectItem value="false">false</SelectItem>
        </SelectContent>
      </Select>
    );
  }
  
  const inputType = ['Int', 'Float', 'numeric'].includes(fieldType) ? 'number' : 'text';
  
  return (
    <Input 
      type={inputType}
      value={value || ''}
      onChange={(e) => {
        const val = inputType === 'number' ? (e.target.value ? Number(e.target.value) : null) : e.target.value;
        onChange(val);
      }}
    />
  );
}

// Where field component
function ConstructorWhereField({ 
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
    <div className="flex items-center gap-2 p-2 border rounded">
      <span className="font-medium min-w-24">{fieldName}</span>
      
      <Select value={currentOperator} onValueChange={(op) => onUpdate(op, currentValue)}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {operators.map(op => (
            <SelectItem key={op.name} value={op.name}>{op.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <WhereInput 
        value={currentValue}
        onChange={(val) => onUpdate(currentOperator, val)}
        operator={currentOperator}
        fieldType={fieldType}
      />
      
      <Button variant="outline" size="sm" onClick={onRemove}>×</Button>
    </div>
  );
}

// Main HasyxConstructor component
function HasyxConstructor({ value, onChange }: HasyxConstructorProps) {
  const [schema, setSchema] = useState<any>(null);
  
  // Load schema
  useState(() => {
    fetch('/hasura-schema.json')
      .then(res => res.json())
      .then(setSchema)
      .catch(console.error);
  });
  
  const setObject = useCallback((path: string, newValue: any) => {
    const updated = setObjectAtPath(value, path, newValue);
    onChange(updated);
  }, [value, onChange]);
  
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
  
  const addWhereCondition = (fieldName: string, fieldType: string) => {
    const path = `where.${fieldName}`;
    setObject(path, { _eq: '' });
  };
  
  const updateWhereCondition = (fieldName: string, operator: string, val: any) => {
    const path = `where.${fieldName}`;
    setObject(path, { [operator]: val });
  };
  
  const removeWhereCondition = (fieldName: string) => {
    const newWhere = { ...value.where };
    delete newWhere[fieldName];
    setObject('where', newWhere);
  };
  
  const toggleReturningField = (fieldName: string, checked: boolean) => {
    const currentReturning = [...value.returning];
    if (checked) {
      if (!currentReturning.includes(fieldName)) {
        currentReturning.push(fieldName);
      }
    } else {
      const index = currentReturning.indexOf(fieldName);
      if (index > -1) {
        currentReturning.splice(index, 1);
      }
    }
    setObject('returning', currentReturning);
  };
  
  if (!schema) {
    return <div>Loading schema...</div>;
  }
  
  return (
    <div className="space-y-6">
      {/* Table Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Table</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={value.table} onValueChange={handleTableChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select table" />
            </SelectTrigger>
            <SelectContent>
              {tables.map(table => (
                <SelectItem key={table} value={table}>{table}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      
      {/* Where Conditions */}
      <Card>
        <CardHeader>
          <CardTitle>Where Conditions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Existing conditions */}
          {Object.entries(value.where).map(([fieldName, condition]) => {
            const field = fields.find(f => f.name === fieldName);
            return (
              <ConstructorWhereField
                key={fieldName}
                fieldName={fieldName}
                fieldType={field?.type || 'String'}
                value={condition}
                onUpdate={(op, val) => updateWhereCondition(fieldName, op, val)}
                onRemove={() => removeWhereCondition(fieldName)}
              />
            );
          })}
          
          {/* Add new condition */}
          <div className="flex gap-2">
            <Label>Add condition:</Label>
            {fields.filter(f => !value.where[f.name]).map(field => (
              <Button 
                key={field.name}
                variant="outline" 
                size="sm"
                onClick={() => addWhereCondition(field.name, field.type)}
              >
                {field.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Returning Fields */}
      <Card>
        <CardHeader>
          <CardTitle>Returning Fields</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {fields.map(field => (
              <div key={field.name} className="flex items-center space-x-2">
                <Checkbox 
                  id={field.name}
                  checked={value.returning.includes(field.name)}
                  onCheckedChange={(checked) => toggleReturningField(field.name, !!checked)}
                />
                <Label htmlFor={field.name}>{field.name}</Label>
              </div>
            ))}
          </div>
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
    where: constructorState.where,
    returning: constructorState.returning.length > 0 ? constructorState.returning : ['id']
  } : {
    table: 'users', // fallback
    where: {},
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
        <div className="flex-1 p-4 border-r overflow-auto">
          <h2 className="text-xl font-semibold mb-4">Query Constructor</h2>
          <HasyxConstructor 
            value={constructorState}
            onChange={setConstructorState}
          />
        </div>
        
        {/* Right side - Results */}
        <div className="flex-1 p-4 overflow-auto">
          <h2 className="text-xl font-semibold mb-4">Query Results</h2>
          <Card>
            <CardContent className="p-4">
              {loading && <div className="text-muted-foreground">Loading...</div>}
              {error && (
                <div className="text-red-500">
                  <pre>{JSON.stringify(error, null, 2)}</pre>
                </div>
              )}
              {data && (
                <pre className="text-sm bg-muted/20 p-4 rounded overflow-auto">
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