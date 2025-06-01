"use client";

import React from 'react';
import { useQuery } from 'hasyx';
import { Button as UIButton } from 'hasyx/components/ui/button';
import { Card as UICard, CardContent, CardHeader, CardTitle } from 'hasyx/components/ui/card';
import { Badge } from 'hasyx/components/ui/badge';
import { X, CreditCard } from 'lucide-react';

interface PaymentProviderData {
  id?: string;
  name?: string;
  type?: string;
  is_test_mode?: boolean;
  is_active?: boolean;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  __typename?: string;
  [key: string]: any;
}

interface PaymentProviderButtonProps {
  data: PaymentProviderData | string;
  [key: string]: any;
}

interface PaymentProviderCardProps {
  data: PaymentProviderData | string;
  onClose?: () => void;
  [key: string]: any;
}

export function Button({ data, ...props }: PaymentProviderButtonProps) {
  const providerId = typeof data === 'string' ? data : data?.id;
  const providerData = typeof data === 'object' ? data : null;
  
  const displayName = providerData?.name || `Provider ${providerId}`;
  const providerType = providerData?.type;
  
  const getProviderIcon = (type?: string) => {
    switch (type?.toLowerCase()) {
      case 'stripe': return '💳';
      case 'paypal': return '🅿️';
      case 'yookassa': return '💰';
      case 'cloudpayments': return '☁️';
      default: return '💳';
    }
  };

  return (
    <UIButton
      variant="outline"
      className="h-auto p-2 justify-start gap-2 min-w-0"
      {...props}
    >
      <span className="text-sm">{getProviderIcon(providerType)}</span>
      <span className="truncate text-xs">{displayName}</span>
      {providerData?.is_test_mode && (
        <Badge variant="secondary" className="text-xs">TEST</Badge>
      )}
      {providerData?.is_active === false && (
        <Badge variant="destructive" className="text-xs">INACTIVE</Badge>
      )}
    </UIButton>
  );
}

export function Card({ data, onClose, ...props }: PaymentProviderCardProps) {
  const providerId = typeof data === 'string' ? data : data?.id;
  const providedData = typeof data === 'object' ? data : null;
  
  // Fetch complete provider data if we only have ID or partial data
  const { data: fetchedProvider, loading, error } = useQuery(
    {
      table: 'payments_providers',
      pk_columns: { id: providerId },
      returning: ['id', 'name', 'type', 'is_test_mode', 'is_active', 'user_id', 'created_at', 'updated_at']
    },
    { 
      skip: !providerId,
      role: 'user'
    }
  );
  
  const providerData = providedData || fetchedProvider;
  
  if (loading) {
    return (
      <UICard className="w-80" {...props}>
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">Loading payment provider...</div>
        </CardContent>
      </UICard>
    );
  }
  
  if (error || !providerData) {
    return (
      <UICard className="w-80" {...props}>
        <CardContent className="p-4">
          <div className="text-sm text-destructive">Failed to load payment provider</div>
        </CardContent>
      </UICard>
    );
  }

  const getProviderIcon = (type?: string) => {
    switch (type?.toLowerCase()) {
      case 'stripe': return '💳';
      case 'paypal': return '🅿️';
      case 'yookassa': return '💰';
      case 'cloudpayments': return '☁️';
      default: return '💳';
    }
  };

  return (
    <UICard className="w-80" {...props}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center bg-muted rounded-full text-lg">
              {getProviderIcon(providerData.type)}
            </div>
            <div>
              <CardTitle className="text-base">{providerData.name || 'Unknown Provider'}</CardTitle>
              {providerData.type && (
                <p className="text-sm text-muted-foreground capitalize">{providerData.type}</p>
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
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant="outline" className="text-xs">ID: {providerData.id}</Badge>
            {providerData.is_test_mode && (
              <Badge variant="secondary" className="text-xs">Test Mode</Badge>
            )}
            {providerData.is_active === false ? (
              <Badge variant="destructive" className="text-xs">Inactive</Badge>
            ) : (
              <Badge variant="default" className="text-xs">Active</Badge>
            )}
            {providerData.user_id && (
              <Badge variant="outline" className="text-xs">Owner: {providerData.user_id}</Badge>
            )}
          </div>
          {providerData.created_at && (
            <div className="text-xs text-muted-foreground">
              Created: {new Date(providerData.created_at).toLocaleDateString()}
            </div>
          )}
          {providerData.updated_at && (
            <div className="text-xs text-muted-foreground">
              Updated: {new Date(providerData.updated_at).toLocaleDateString()}
            </div>
          )}
        </div>
      </CardContent>
    </UICard>
  );
} 