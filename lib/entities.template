"use client";

import React from 'react';

// Import base entity components from hasyx
import * as UsersEntity from 'hasyx/components/entities/users';
import * as AccountsEntity from 'hasyx/components/entities/accounts';
import * as PaymentProvidersEntity from 'hasyx/components/entities/payments_providers';
import * as PaymentSubscriptionsEntity from 'hasyx/components/entities/payments_subscriptions';

// Import local project entities
import * as DefaultEntity from '@/components/entities/default';

interface EntityData {
  id?: string;
  __typename?: string;
  [key: string]: any;
}

interface EntityButtonProps {
  data: EntityData | string;
  [key: string]: any;
}

interface EntityCardProps {
  data: EntityData | string;
  onClose?: () => void;
  [key: string]: any;
}

// Registry of available entity components
const ENTITY_REGISTRY = {
  'users': UsersEntity,
  'accounts': AccountsEntity,
  'payments_providers': PaymentProvidersEntity,
  'payments_subscriptions': PaymentSubscriptionsEntity,
  // Add more project-specific entities here as they are created
  // 'posts': PostsEntity,
  // 'comments': CommentsEntity,
} as const;

function getEntityTypeFromTypename(typename?: string): string {
  if (!typename) return 'default';
  
  // __typename format: schema_table or just table (if schema is public)
  const parts = typename.split('_');
  
  // For schema_table format, join all parts back
  if (parts.length > 1) {
    return typename.toLowerCase();
  }
  
  // For single table name
  return parts[0].toLowerCase();
}

function getEntityComponent(typename?: string) {
  const entityType = getEntityTypeFromTypename(typename);
  
  // Check if we have a specific component for this entity type
  if (entityType in ENTITY_REGISTRY) {
    return ENTITY_REGISTRY[entityType as keyof typeof ENTITY_REGISTRY];
  }
  
  // Fall back to local default component
  return DefaultEntity;
}

export function Button({ data, ...props }: EntityButtonProps) {
  const entityData = typeof data === 'object' ? data : null;
  const typename = entityData?.__typename;
  
  const EntityComponent = getEntityComponent(typename);
  
  return <EntityComponent.Button data={data} {...props} />;
}

export function Card({ data, onClose, ...props }: EntityCardProps) {
  const entityData = typeof data === 'object' ? data : null;
  const typename = entityData?.__typename;
  
  const EntityComponent = getEntityComponent(typename);
  
  return <EntityComponent.Card data={data} onClose={onClose} {...props} />;
} 