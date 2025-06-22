"use client";

import React, { useState } from 'react';
import { Button } from "hasyx/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "hasyx/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "hasyx/components/ui/avatar";
import { LogOut, LogIn, User, Settings, Github, Mail, MailCheck } from "lucide-react";
import { signOut, signIn } from "next-auth/react";
import { useNewHasyx, useSession } from 'hasyx';
import { useSubscription } from 'hasyx';
import { OAuthButtons } from '../auth/oauth-buttons';

function getInitials(name: string | null | undefined): string {
  if (!name) return "U";
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getProviderIcon(provider: string) {
  switch (provider.toLowerCase()) {
    case 'github':
      return <Github className="w-4 h-4" />;
    case 'google':
      return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
      );
    case 'yandex':
      return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 12C2 6.48 6.48 2 12 2C17.52 2 22 6.48 22 12C22 17.52 17.52 22 12 22C6.48 22 2 17.52 2 12Z" fill="#FC3F1D"/>
          <path d="M13.155 17.833H15.314V6.167H12.647C9.521 6.167 8.138 7.574 8.138 9.786C8.138 11.602 8.995 12.779 10.635 14.197L8 17.833H10.379L13.155 13.971L12.269 13.232C10.95 12.126 10.264 11.269 10.264 9.692C10.264 8.458 11.082 7.696 12.647 7.696H13.155V17.833Z" fill="white"/>
        </svg>
      );
    case 'facebook':
      return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#1877F2" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.676 0H1.324C.593 0 0 .593 0 1.324v21.352C0 23.407.593 24 1.324 24h11.494v-9.294H9.692v-3.622h3.128V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116c.73 0 1.323-.593 1.323-1.324V1.324C24 .593 23.407 0 22.676 0z"/>
        </svg>
      );
    case 'vk':
      return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#4680C2" xmlns="http://www.w3.org/2000/svg">
          <path d="M13.125 12.281L14.344 10.5H12.375V8.344C12.375 7.85625 12.6094 7.625 13.0969 7.625H14.375V5.8125C14.0156 5.76562 13.3906 5.71875 12.5 5.71875C10.6562 5.71875 9.5 6.82812 9.5 8.82812V10.5H7.5V12.281L9.5 14.062V18.281C9.5 18.9688 9.96875 19.4375 10.6562 19.4375H12.3125V16.1875C11.6094 16.1094 11.1562 15.625 11.1562 14.9375V14.062L13.125 12.281Z"/>
        </svg>
      );
    case 'telegram':
      return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#0088cc" xmlns="http://www.w3.org/2000/svg">
          <path d="m12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/>
        </svg>
      );
    default:
      return (
        <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="text-xs font-medium">
            {provider.charAt(0).toUpperCase()}
          </span>
        </div>
      );
  }
}

function UserAccountsList({ userId }: { userId: string }) {
  const { data: accounts = [], loading } = useSubscription(
    {
      table: 'accounts',
      where: { user_id: { _eq: userId } },
      returning: ['id', 'provider'],
    },
  );

  if (loading) {
    return <div className="text-sm text-muted-foreground px-2 py-1">Loading accounts...</div>;
  }

  if (accounts?.length === 0) {
    return <div className="text-sm text-muted-foreground px-2 py-1">No connected accounts</div>;
  }

  return (
    <div className="space-y-1">
      <DropdownMenuLabel className="text-xs text-muted-foreground">Connected Accounts</DropdownMenuLabel>
      {accounts.map((account) => (
        <DropdownMenuItem key={account.id} className="flex items-center gap-3 cursor-default">
          {getProviderIcon(account.provider)}
          <div className="flex flex-col flex-1">
            <span className="text-sm font-medium capitalize">{account.provider}</span>
          </div>
        </DropdownMenuItem>
      ))}
    </div>
  );
}

function AuthenticatedUserMenu({ session }: { session: any }) {
  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/' });
  };

  return (
    <>
      <DropdownMenuLabel className="font-normal">
        <div className="flex flex-col space-y-1">
          <p className="text-sm font-medium leading-none">{session.user?.name || 'User'}</p>
          <div className="flex items-center gap-1">
            <p className="text-xs leading-none text-muted-foreground">
              {session.user?.email}
            </p>
            {session.hasuraClaims?.['x-hasura-user-id'] && (
              <div className="ml-1">
                {/* Email verification status will be shown via subscription in accounts list */}
              </div>
            )}
          </div>
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      
      {session.user?.id && <UserAccountsList userId={session.user.id} />}
      
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-600">
        <LogOut className="mr-2 h-4 w-4" />
        Sign out
      </DropdownMenuItem>
    </>
  );
}

function UnauthenticatedUserMenu() {
  return (
    <>
      <DropdownMenuLabel>Sign in to your account</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <div className="p-2">
        <OAuthButtons />
      </div>
    </>
  );
}

export function UserProfileDropdown() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);

  const isLoading = status === 'loading';
  const isAuthenticated = status === 'authenticated' && session?.user;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-auto rounded-full px-3" disabled={isLoading}>
          {isLoading ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Loading...</span>
              <div className="h-6 w-6 rounded-full bg-muted animate-pulse" />
            </div>
          ) : isAuthenticated ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium hidden sm:inline-block">
                {session.user?.name || 'User'}
              </span>
              <Avatar className="h-6 w-6">
                <AvatarImage src={session.user?.image || undefined} alt={session.user?.name || 'User'} />
                <AvatarFallback className="text-xs">
                  {getInitials(session.user?.name)}
                </AvatarFallback>
              </Avatar>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Sign in</span>
              <LogIn className="h-4 w-4" />
            </div>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end">
        {isAuthenticated ? (
          <AuthenticatedUserMenu session={session} />
        ) : (
          <UnauthenticatedUserMenu />
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 