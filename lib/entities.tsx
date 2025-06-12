"use client";

import React from 'react';

// Import all available entity components
import * as UsersEntity from 'hasyx/components/entities/users';
import * as AccountsEntity from 'hasyx/components/entities/accounts';
import * as DefaultEntity from 'hasyx/components/entities/default';

interface EntityData {
  id: string;
  __typename?: string;
  [key: string]: any;
}

interface EntityButtonProps {
  data: EntityData;
  [key: string]: any;
}

interface EntityCytoNodeProps {
  data: EntityData;
  [key: string]: any;
}

interface EntityCardProps {
  data: EntityData;
  onClose?: () => void;
  [key: string]: any;
}

// Registry of available entity components
const ENTITY_REGISTRY = {
  'users': UsersEntity,
  'accounts': AccountsEntity,
  'default': DefaultEntity,
  // Add more entities here as they are created
  // 'notifications': NotificationsEntity,
  // 'posts': PostsEntity,
} as const;

function getEntityTypeFromTypename(typename?: string): string {
  if (!typename) return 'default';
  
  // __typename format: schema_table or just table (if schema is public)
  const parts = typename.split('_');
  const table = parts.length === 1 ? parts[0] : parts[parts.length - 1];
  
  return table.toLowerCase();
}

function getEntityComponent(typename?: string) {
  const entityType = getEntityTypeFromTypename(typename);
  
  // Check if we have a specific component for this entity type
  if (entityType in ENTITY_REGISTRY) {
    return ENTITY_REGISTRY[entityType as keyof typeof ENTITY_REGISTRY];
  }
  
  // Fall back to default component
  return DefaultEntity;
}

export function Button({ data, ...props }: EntityButtonProps) {
  const entityData = typeof data === 'object' ? data : null;
  const typename = entityData?.__typename;
  
  const EntityComponent = getEntityComponent(typename);
  
  return <EntityComponent.Button data={data as any} {...props} />;
}

export function Card({ data, onClose, ...props }: EntityCardProps) {
  const entityData = typeof data === 'object' ? data : null;
  const typename = entityData?.__typename;
  
  const EntityComponent = getEntityComponent(typename);
  
  return <EntityComponent.Card data={data as any} onClose={onClose} {...props} />;
} 

export function CytoNode({ data, ...props }: EntityCytoNodeProps) {
  const entityData = typeof data === 'object' ? data : null;
  const typename = entityData?.__typename;
  
  const EntityComponent = getEntityComponent(typename);
  
  return <EntityComponent.CytoNode data={data as any} {...props} />;
} 