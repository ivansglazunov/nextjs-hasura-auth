'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useSubscription } from 'nextjs-hasura-auth'; 
import { Loader2, Terminal } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Debug from '@/lib/debug';

const debug = Debug('users-subscription');

// Define a basic structure for user data (can be shared)
interface User {
  id: string;
  name?: string | null;
  email?: string | null;
}

export function UsersSubscription() {
  const { data, loading, error } = useSubscription<{ users: User[] }>(
    {
      table: 'users',
      limit: 5,
      returning: ['id', 'created_at', 'updated_at'], // Fetch name and email
      // Optionally add order_by: { created_at: 'desc' }
    },
    {
      role: 'anonymous'
    }
  );

  debug('Subscription state:', { loading, error, data });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Users via Subscription</CardTitle>
        <CardDescription>Fetched using WebSocket connection.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading...
          </div>
        )}
        {error && (
          <Alert variant="destructive">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Subscription Error!</AlertTitle>
            <AlertDescription>
              {error.message || 'Failed to fetch users via subscription.'}
            </AlertDescription>
          </Alert>
        )}
        {!loading && !error && data?.users && data.users.length > 0 && (
          <ul className="space-y-2">
            {data.users.map((user) => (
              <li key={user.id} className="text-sm p-2 border rounded bg-muted/40">
                <p><strong>ID:</strong> {user.id}</p>
                {user.name && <p><strong>Name:</strong> {user.name}</p>}
                {user.email && <p><strong>Email:</strong> {user.email}</p>}
              </li>
            ))}
          </ul>
        )}
         {!loading && !error && (!data?.users || data.users.length === 0) && (
           <p className="text-sm text-muted-foreground">No users found.</p>
         )}
      </CardContent>
    </Card>
  );
} 