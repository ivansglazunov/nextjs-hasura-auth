'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Github, LogIn, LogOut, MailCheck, MailWarning, Loader2 } from "lucide-react";
import { signIn, signOut } from "next-auth/react";
import Image from 'next/image';
import React from "react";
import { useSession, useSubscription } from 'hasyx';

// Import provider icons (assuming they exist)
// import GoogleIcon from '@/public/icons/google.svg';
// import YandexIcon from '@/public/icons/yandex.svg';

export function AuthActionsCard(props: React.HTMLAttributes<HTMLDivElement>) {
  const { data: session, status } = useSession();
  const loading = status === 'loading';
  const userId = session?.user?.id;

  // --- Subscription for email verification status ---
  const { 
    data: subData, 
    loading: subLoading, 
    error: subError 
  } = useSubscription<{ users: { email_verified: string | null }[] }>(
    {
      table: 'users',
      where: { id: { _eq: userId } }, // Subscribe only if userId exists
      returning: ['email_verified'], // Only need verification status
    }, 
  );

  const emailVerified = subData?.users?.[0]?.email_verified;
  // --- End Subscription ---

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>Session & OAuth</CardTitle>
        <CardDescription>View session status and sign in using OAuth providers.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid w-full items-center gap-2">
          <Label>Client Session Status (useSession)</Label>
          {loading && <p className="flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading session...</p>}
          {session && !loading && (
            <div className="flex items-center space-x-2 flex-wrap">
              {/* Email Verification Status from Subscription */}
              {userId && (
                <span className="flex items-center">
                  {subLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {subError && <span className="text-xs text-red-500" title={subError.message}>Error loading status</span>}
                  {!subLoading && !subError && emailVerified && (
                     <span 
                      title={`Email verified at ${new Date(emailVerified).toLocaleString()}`}
                      className="mr-2 px-2 py-0.5 rounded text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 flex items-center"
                    >
                      <MailCheck className="mr-1 h-3 w-3" /> Verified
                    </span>
                  )}
                   {!subLoading && !subError && !emailVerified && (
                     <span 
                      title="Email not verified. Check your inbox or spam folder for the verification email."
                      className="mr-2 px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 flex items-center"
                    >
                       <MailWarning className="mr-1 h-3 w-3" /> Not Verified
                       {/* TODO: Add Resend Button Here */}
                    </span>
                  )}
                </span>
              )}
              {/* User Avatar */}
              {session.user?.image && (
                <Image
                  src={session.user.image}
                  alt={session.user.name || 'User avatar'}
                  width={24}
                  height={24}
                  className="rounded-full"
                />
              )}
              {/* User Name/Email */}
              <span>Signed in as {session.user?.name || session.user?.email} {session.provider ? `(${session.provider})` : ''}</span>
            </div>
          )}
          {!session && !loading && <p>Not signed in</p>}
        </div>

        <div className="grid w-full items-center gap-2">
          <Label>{session ? 'Sign Out' : 'Sign In with OAuth'}</Label>
          {session && (
            <Button onClick={() => signOut()} disabled={loading}>
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </Button>
          )}
          {!session && (
            <div className="flex flex-col space-y-4">
              {/* Provider Buttons */}
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