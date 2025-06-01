"use client";

import React from 'react';
import { useQuery } from 'hasyx';
import { Button as UIButton } from 'hasyx/components/ui/button';
import { Card as UICard, CardContent, CardHeader, CardTitle } from 'hasyx/components/ui/card';
import { Badge } from 'hasyx/components/ui/badge';
import { X } from 'lucide-react';

interface AccountData {
  id?: string;
  provider?: string;
  provider_id?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  __typename?: string;
  [key: string]: any;
}

interface AccountButtonProps {
  data: AccountData | string;
  [key: string]: any;
}

interface AccountCardProps {
  data: AccountData | string;
  onClose?: () => void;
  [key: string]: any;
}

export function Button({ data, ...props }: AccountButtonProps) {
  const accountId = typeof data === 'string' ? data : data?.id;
  const accountData = typeof data === 'object' ? data : null;
  
  const displayName = accountData?.provider ? 
    `${accountData.provider}` : 
    `Account ${accountId}`;
  
  const getProviderIcon = (provider?: string) => {
    switch (provider?.toLowerCase()) {
      case 'google': return '🔍';
      case 'github': return '🐙';
      case 'discord': return '💬';
      case 'twitter': return '🐦';
      default: return '🔑';
    }
  };

  return (
    <UIButton
      variant="outline"
      className="h-auto p-2 justify-start gap-2 min-w-0"
      {...props}
    >
      <span className="text-sm">{getProviderIcon(accountData?.provider)}</span>
      <span className="truncate text-xs">{displayName}</span>
    </UIButton>
  );
}

export function Card({ data, onClose, ...props }: AccountCardProps) {
  const accountId = typeof data === 'string' ? data : data?.id;
  const providedData = typeof data === 'object' ? data : null;
  
  // Fetch complete account data if we only have ID or partial data
  const { data: fetchedAccount, loading, error } = useQuery(
    {
      table: 'accounts',
      pk_columns: { id: accountId },
      returning: ['id', 'provider', 'user_id']
    },
    { 
      skip: !accountId,
      role: 'user'
    }
  );
  
  const accountData = providedData || fetchedAccount;
  
  if (loading) {
    return (
      <UICard className="w-80" {...props}>
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">Loading account...</div>
        </CardContent>
      </UICard>
    );
  }
  
  if (error || !accountData) {
    return (
      <UICard className="w-80" {...props}>
        <CardContent className="p-4">
          <div className="text-sm text-destructive">Failed to load account</div>
        </CardContent>
      </UICard>
    );
  }

  const getProviderIcon = (provider?: string) => {
    switch (provider?.toLowerCase()) {
      case 'google': return '🔍';
      case 'github': return '🐙';
      case 'discord': return '💬';
      case 'twitter': return '🐦';
      default: return '🔑';
    }
  };

  return (
    <UICard className="w-80" {...props}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center bg-muted rounded-full text-lg">
              {getProviderIcon(accountData.provider)}
            </div>
            <div>
              <CardTitle className="text-base capitalize">
                {accountData.provider || 'Unknown Provider'}
              </CardTitle>
              {accountData.provider_id && (
                <p className="text-sm text-muted-foreground">ID: {accountData.provider_id}</p>
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
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">ID: {accountData.id}</Badge>
            {accountData.user_id && (
              <Badge variant="secondary" className="text-xs">User: {accountData.user_id}</Badge>
            )}
          </div>
          {accountData.created_at && (
            <div className="text-xs text-muted-foreground">
              Created: {new Date(accountData.created_at).toLocaleDateString()}
            </div>
          )}
          {accountData.updated_at && (
            <div className="text-xs text-muted-foreground">
              Updated: {new Date(accountData.updated_at).toLocaleDateString()}
            </div>
          )}
        </div>
      </CardContent>
    </UICard>
  );
} 