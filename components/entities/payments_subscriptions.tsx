"use client";

import React from 'react';
import { useQuery } from 'hasyx';
import { Button as UIButton } from 'hasyx/components/ui/button';
import { Card as UICard, CardContent, CardHeader, CardTitle } from 'hasyx/components/ui/card';
import { Badge } from 'hasyx/components/ui/badge';
import { X, RefreshCw } from 'lucide-react';

interface PaymentSubscriptionData {
  id?: string;
  status?: string;
  amount?: number;
  currency?: string;
  plan_id?: string;
  user_id?: string;
  provider_id?: string;
  method_id?: string;
  next_payment_at?: string;
  created_at?: string;
  updated_at?: string;
  __typename?: string;
  [key: string]: any;
}

interface PaymentSubscriptionButtonProps {
  data: PaymentSubscriptionData | string;
  [key: string]: any;
}

interface PaymentSubscriptionCardProps {
  data: PaymentSubscriptionData | string;
  onClose?: () => void;
  [key: string]: any;
}

export function Button({ data, ...props }: PaymentSubscriptionButtonProps) {
  const subscriptionId = typeof data === 'string' ? data : data?.id;
  const subscriptionData = typeof data === 'object' ? data : null;
  
  const displayName = subscriptionData?.amount && subscriptionData?.currency ? 
    `${subscriptionData.amount} ${subscriptionData.currency.toUpperCase()}` : 
    `Subscription ${subscriptionId}`;
  
  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'default';
      case 'pending': return 'secondary';
      case 'cancelled': return 'destructive';
      case 'expired': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <UIButton
      variant="outline"
      className="h-auto p-2 justify-start gap-2 min-w-0"
      {...props}
    >
      <RefreshCw className="w-4 h-4 flex-shrink-0" />
      <span className="truncate text-xs">{displayName}</span>
      {subscriptionData?.status && (
        <Badge variant={getStatusColor(subscriptionData.status)} className="text-xs capitalize">
          {subscriptionData.status}
        </Badge>
      )}
    </UIButton>
  );
}

export function Card({ data, onClose, ...props }: PaymentSubscriptionCardProps) {
  const subscriptionId = typeof data === 'string' ? data : data?.id;
  const providedData = typeof data === 'object' ? data : null;
  
  // Fetch complete subscription data if we only have ID or partial data
  const { data: fetchedSubscription, loading, error } = useQuery(
    {
      table: 'payments_subscriptions',
      pk_columns: { id: subscriptionId },
      returning: ['id', 'status', 'amount', 'currency', 'plan_id', 'user_id', 'provider_id', 'method_id', 'next_payment_at', 'created_at', 'updated_at']
    },
    { 
      skip: !subscriptionId,
      role: 'user'
    }
  );
  
  const subscriptionData = providedData || fetchedSubscription;
  
  if (loading) {
    return (
      <UICard className="w-80" {...props}>
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">Loading subscription...</div>
        </CardContent>
      </UICard>
    );
  }
  
  if (error || !subscriptionData) {
    return (
      <UICard className="w-80" {...props}>
        <CardContent className="p-4">
          <div className="text-sm text-destructive">Failed to load subscription</div>
        </CardContent>
      </UICard>
    );
  }

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'default';
      case 'pending': return 'secondary';
      case 'cancelled': return 'destructive';
      case 'expired': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <UICard className="w-80" {...props}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center bg-muted rounded-full">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base">
                {subscriptionData.amount && subscriptionData.currency ? 
                  `${subscriptionData.amount} ${subscriptionData.currency.toUpperCase()}` : 
                  'Subscription'
                }
              </CardTitle>
              {subscriptionData.status && (
                <p className="text-sm text-muted-foreground capitalize">{subscriptionData.status}</p>
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
            <Badge variant="outline" className="text-xs">ID: {subscriptionData.id}</Badge>
            {subscriptionData.status && (
              <Badge variant={getStatusColor(subscriptionData.status)} className="text-xs capitalize">
                {subscriptionData.status}
              </Badge>
            )}
            {subscriptionData.plan_id && (
              <Badge variant="secondary" className="text-xs">Plan: {subscriptionData.plan_id}</Badge>
            )}
          </div>
          
          {subscriptionData.user_id && (
            <div className="text-xs text-muted-foreground">
              User: {subscriptionData.user_id}
            </div>
          )}
          
          {subscriptionData.next_payment_at && (
            <div className="text-xs text-muted-foreground">
              Next Payment: {new Date(subscriptionData.next_payment_at).toLocaleDateString()}
            </div>
          )}
          
          {subscriptionData.created_at && (
            <div className="text-xs text-muted-foreground">
              Created: {new Date(subscriptionData.created_at).toLocaleDateString()}
            </div>
          )}
          
          {subscriptionData.updated_at && (
            <div className="text-xs text-muted-foreground">
              Updated: {new Date(subscriptionData.updated_at).toLocaleDateString()}
            </div>
          )}
        </div>
      </CardContent>
    </UICard>
  );
} 