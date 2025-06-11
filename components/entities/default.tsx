"use client";

import React from 'react';
import { Button as UIButton } from 'hasyx/components/ui/button';
import { Card as UICard, CardContent, CardHeader, CardTitle } from 'hasyx/components/ui/card';
import { Badge } from 'hasyx/components/ui/badge';
import { CytoNode as CytoNodeComponent } from 'hasyx/lib/cyto';
import { X, Database } from 'lucide-react';
import { cn } from 'hasyx/lib/utils';

interface DefaultData {
  id: string;
  created_at?: string;
  updated_at?: string;
  __typename?: string;
  [key: string]: any;
}

function getEntityTypeFromTypename(typename?: string): { table: string; schema: string } {
  if (!typename) return { table: 'unknown', schema: 'public' };
  
  // __typename format: schema_table or just table (if schema is public)
  const parts = typename.split('_');
  if (parts.length === 1) {
    return { table: parts[0], schema: 'public' };
  }
  
  // Last part is table, everything before is schema
  const table = parts[parts.length - 1];
  const schema = parts.slice(0, -1).join('_');
  return { table, schema };
}

export function Button({ data, ...props }: {
  data: DefaultData;
  [key: string]: any;
}) {
  const entityId = typeof data === 'string' ? data : data?.id;
  const entityData = typeof data === 'object' ? data : null;
  
  const { table, schema } = getEntityTypeFromTypename(entityData?.__typename);
  const displayName = `${table}${entityId ? ` ${entityId}` : ''}`;

  return (
    <UIButton
      variant="outline"
      className="h-auto p-2 justify-start gap-2 min-w-0"
      {...props}
    >
      <Database className="w-4 h-4 flex-shrink-0" />
      <span className="truncate text-xs">{displayName}</span>
      {entityData?.created_at && (
        <span className="text-xs text-muted-foreground">
          {new Date(entityData.created_at).toLocaleDateString()}
        </span>
      )}
    </UIButton>
  );
}

export function Card({ data, onClose, ...props }: {
  data: DefaultData;
  onClose?: () => void;
  [key: string]: any;
}) {
  const entityId = typeof data === 'string' ? data : data?.id;
  const entityData = typeof data === 'object' ? data : null;
  
  if (!entityData && typeof data === 'string') {
    return (
      <UICard className="w-80" {...props}>
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">
            Entity ID: {data}
            <br />
            <span className="text-xs">No additional data available</span>
          </div>
        </CardContent>
      </UICard>
    );
  }

  const { table, schema } = getEntityTypeFromTypename(entityData?.__typename);
  
  // Separate system fields from user data
  const systemFields = ['id', 'created_at', 'updated_at', '__typename'];
  const userData = entityData ? Object.fromEntries(
    Object.entries(entityData).filter(([key]) => !systemFields.includes(key))
  ) : {};

  return (
    <UICard className="w-80" {...props}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center bg-muted rounded-full">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base capitalize">{table}</CardTitle>
              {schema !== 'public' && (
                <p className="text-sm text-muted-foreground">Schema: {schema}</p>
              )}
            </div>
          </div>
          {onClose && (
            <UIButton
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </UIButton>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {/* System fields */}
          <div className="flex flex-wrap items-center gap-1">
            {entityData?.id && (
              <Badge variant="outline" className="text-xs">ID: {entityData.id}</Badge>
            )}
            {entityData?.__typename && (
              <Badge variant="secondary" className="text-xs">{entityData.__typename}</Badge>
            )}
          </div>
          
          {/* Timestamps */}
          {entityData?.created_at && (
            <div className="text-xs text-muted-foreground">
              Created: {new Date(entityData.created_at).toLocaleDateString()}
            </div>
          )}
          {entityData?.updated_at && (
            <div className="text-xs text-muted-foreground">
              Updated: {new Date(entityData.updated_at).toLocaleDateString()}
            </div>
          )}
          
          {/* User data as JSON if present */}
          {Object.keys(userData).length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-medium mb-1">Data:</div>
              <div className="bg-muted rounded p-2 text-xs font-mono overflow-auto max-h-32">
                <pre>{JSON.stringify(userData, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </UICard>
  );
}

export function CytoNode({ data, ...props }: {
  data: DefaultData;
  [key: string]: any;
}) {
  return <CytoNodeComponent {...props} element={{
    id: data.id,
    data: {
      id: data.id,
      label: data?.name,
    },
    ...props?.element,
    classes: cn('entity', props.classes)
  }} />;
}
