"use client";

import React, { useState } from 'react';
import { useQuery } from 'hasyx';
import { Button as UIButton } from 'hasyx/components/ui/button';
import { Card as UICard, CardContent, CardHeader, CardTitle } from 'hasyx/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from 'hasyx/components/ui/avatar';
import { Badge } from 'hasyx/components/ui/badge';
import { X } from 'lucide-react';
import { CytoNode as CytoNodeComponent } from 'hasyx/lib/cyto';
import { cn } from 'hasyx/lib/utils';

interface UserData {
  id?: string;
  name?: string;
  email?: string;
  image?: string;
  created_at?: string;
  updated_at?: string;
  __typename?: string;
  [key: string]: any;
}

export function Button({ data, ...props }: {
  data: UserData | string;
  [key: string]: any;
}) {
  const userId = typeof data === 'string' ? data : data?.id;
  const userData = typeof data === 'object' ? data : null;
  
  // If we only have ID, we could fetch more data, but for Button we keep it minimal
  const displayName = userData?.name || userData?.email || `User ${userId}`;
  const initials = userData?.name ? 
    userData.name.split(' ').map(n => n[0]).join('').toUpperCase() : 
    (userData?.email ? userData.email.substring(0, 2).toUpperCase() : 'U');

  return (
    <UIButton
      variant="outline"
      className="h-auto p-2 justify-start gap-2 min-w-0"
      {...props}
    >
      <Avatar className="w-6 h-6 flex-shrink-0">
        <AvatarImage src={userData?.image} />
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
      <span className="truncate text-xs">{displayName}</span>
    </UIButton>
  );
}

export function Card({ data, onClose, ...props }: {
  data: UserData | string;
  onClose?: () => void;
  [key: string]: any;
}) {
  const userId = typeof data === 'string' ? data : data?.id;
  const providedData = typeof data === 'object' ? data : null;
  
  // Fetch complete user data if we only have ID or partial data
  const { data: fetchedUser, loading, error } = useQuery(
    {
      table: 'users',
      pk_columns: { id: userId },
      returning: ['id', 'name', 'email', 'image', 'created_at', 'updated_at']
    },
    { 
      skip: !userId,
      role: 'user' // Public user data accessible to user role
    }
  );
  
  const userData = providedData || fetchedUser;
  
  if (loading) {
    return (
      <UICard className="w-80" {...props}>
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">Loading user...</div>
        </CardContent>
      </UICard>
    );
  }
  
  if (error || !userData) {
    return (
      <UICard className="w-80" {...props}>
        <CardContent className="p-4">
          <div className="text-sm text-destructive">Failed to load user</div>
        </CardContent>
      </UICard>
    );
  }

  return (
    <UICard className="w-80" {...props}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={userData.image} />
              <AvatarFallback>
                {userData.name ? 
                  userData.name.split(' ').map(n => n[0]).join('') : 
                  (userData.email ? userData.email.substring(0, 2).toUpperCase() : 'U')
                }
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-base">{userData.name || 'Unknown User'}</CardTitle>
              {userData.email && (
                <p className="text-sm text-muted-foreground">{userData.email}</p>
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
            <Badge variant="outline" className="text-xs">ID: {userData.id}</Badge>
          </div>
          {userData.created_at && (
            <div className="text-xs text-muted-foreground">
              Created: {new Date(userData.created_at).toLocaleDateString()}
            </div>
          )}
          {userData.updated_at && (
            <div className="text-xs text-muted-foreground">
              Updated: {new Date(userData.updated_at).toLocaleDateString()}
            </div>
          )}
        </div>
      </CardContent>
    </UICard>
  );
}

export function CytoNode({ data, ...props }: {
  data: UserData;
  [key: string]: any;
}) {
  const name = data?.name || data?.id?.slice(0, 4);
  const image = data?.image;
  const [opened, setOpened] = useState(false);
  return <CytoNodeComponent {...props}
    onClick={() => setOpened(true)}
    element={{
      id: data.id,
      data: {
        id: data.id,
        label: name,
        image: image,
      },
      ...props?.element,
      classes: cn('entity', { avatar: !!image, opened, }, props.classes)
    }}
    children={opened ? <Card data={data} onClose={() => setOpened(false)} /> : null}
  />;
}