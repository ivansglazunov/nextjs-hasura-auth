'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "hasyx/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "hasyx/components/ui/card";
import { CodeBlock } from 'hasyx/components/code-block';
import { GetAuthStatus } from "./get-auth-status";
import { SocketAuthStatus } from "./socket-auth-status";
import { Session } from "next-auth";
import React from "react";

interface SessionCardProps {
  serverSession: Session | null;
}

export function SessionCard({ serverSession }: SessionCardProps & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Session Data</CardTitle>
        <CardDescription>View session information from different sources.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="ssr">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ssr">SSR</TabsTrigger>
            <TabsTrigger value="get">GET</TabsTrigger>
            <TabsTrigger value="socket">Socket</TabsTrigger>
          </TabsList>
          <TabsContent value="ssr" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Server Session Data</CardTitle>
                <CardDescription>Session data available during Server-Side Rendering.</CardDescription>
              </CardHeader>
              <CardContent>
                {serverSession ? (
                  <CodeBlock value={JSON.stringify(serverSession, null, 2)} />
                ) : (
                  <p>No session data available on the server.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="get" className="mt-4">
            {/* Mount GetAuthStatus only when tab is active */}
            <GetAuthStatus />
          </TabsContent>
          <TabsContent value="socket" className="mt-4">
             {/* Mount SocketAuthStatus only when tab is active */}
            <SocketAuthStatus />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
} 