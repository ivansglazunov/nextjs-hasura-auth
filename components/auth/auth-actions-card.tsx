'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Github, LogIn, LogOut } from "lucide-react";
import { signIn, signOut, useSession } from "next-auth/react";
import Image from 'next/image';
import React from "react";

// Import provider icons (assuming they exist)
// import GoogleIcon from '@/public/icons/google.svg';
// import YandexIcon from '@/public/icons/yandex.svg';

export function AuthActionsCard(props: React.HTMLAttributes<HTMLDivElement>) {
  const { data: session, status } = useSession();
  const loading = status === 'loading';

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>Authentication & Status</CardTitle>
        <CardDescription>Manage your session and check connection status.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid w-full items-center gap-2">
          <Label>Client Session Status (useSession)</Label>
          {loading && <p>Loading session...</p>}
          {session && (
            <div className="flex items-center space-x-2">
              {session.user?.image && (
                <Image
                  src={session.user.image}
                  alt={session.user.name || 'User avatar'}
                  width={24}
                  height={24}
                  className="rounded-full"
                />
              )}
              <span>Signed in as {session.user?.name || session.user?.email} ({session.provider})</span>
            </div>
          )}
          {!session && !loading && <p>Not signed in</p>}
        </div>

        <div className="grid w-full items-center gap-2">
          <Label>Actions</Label>
          {session && (
            <Button onClick={() => signOut()} disabled={loading}>
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </Button>
          )}
          {!session && (
            <div className="flex flex-col space-y-2">
              <Button onClick={() => signIn('google')} disabled={loading}>
                {/* <GoogleIcon className="mr-2 h-4 w-4" /> */}
                <LogIn className="mr-2 h-4 w-4" /> Sign In with Google
              </Button>
              <Button onClick={() => signIn('yandex')} disabled={loading}>
                {/* <YandexIcon className="mr-2 h-4 w-4" /> */} Sign In with Yandex
              </Button>
              <Button onClick={() => signIn('github')} disabled={loading}>
                <Github className="mr-2 h-4 w-4" /> Sign In with GitHub (coming soon)
              </Button>
              <Button variant="outline" disabled>
                <Label>More providers coming soon...</Label>
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 