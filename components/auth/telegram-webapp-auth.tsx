'use client';

import { Badge } from 'hasyx/components/ui/badge';
import { Button } from 'hasyx/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'hasyx/components/ui/card';
import { useTelegramWebApp } from 'hasyx/hooks/use-telegram-webapp';
import Debug from 'hasyx/lib/debug';
import { AlertCircle, CheckCircle, Loader2, Smartphone } from 'lucide-react';
import { signIn, useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';

const debug = Debug('auth:telegram-webapp');

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
      language_code?: string;
      is_premium?: boolean;
    };
    auth_date: number;
    hash: string;
    query_id?: string;
    chat_type?: string;
    chat_instance?: string;
    start_param?: string;
  };
  ready: () => void;
  close: () => void;
  expand: () => void;
  isExpanded: boolean;
  platform: string;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

interface TelegramWebAppAuthProps {
  onSuccess?: (user: any) => void;
  onError?: (error: string) => void;
  className?: string;
  autoAuth?: boolean;
}

export function TelegramWebAppAuth({ 
  onSuccess, 
  onError, 
  className,
  autoAuth = true 
}: TelegramWebAppAuthProps) {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const { data: session, status } = useSession();
  const {
    isInTelegram,
    isLoading,
    user,
    initData,
    platform,
    version,
    colorScheme,
    showAlert,
    haptic
  } = useTelegramWebApp();

  // Auto-authenticate if user data is available and not already signed in
  useEffect(() => {
    if (
      autoAuth &&
      isInTelegram &&
      user && 
      initData &&
      status === 'unauthenticated' && 
      !isAuthenticating &&
      !authError // Don't retry if there was an error
    ) {
      debug('Auto-authenticating Telegram user', {
        userId: user.id,
        username: user.username
      });
      handleTelegramAuth();
    }
  }, [autoAuth, isInTelegram, user, initData, status, isAuthenticating, authError]);

  const validateInitData = useCallback(async (initDataString: string): Promise<boolean> => {
    console.log('🔄 Client: validateInitData called');
    try {
      console.log('🔄 Client: Making POST request to /api/auth/verify-telegram-webapp');
      debug('Validating initData with server...');
      
      const response = await fetch('/api/auth/verify-telegram-webapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ initData: initDataString }),
      });

      console.log('🔄 Client: Response status:', response.status);
      console.log('🔄 Client: Response ok:', response.ok);

      const result = await response.json();
      console.log('🔄 Client: Response JSON:', result);
      debug('Server validation result:', { success: result.success || result.valid });
      
      return result.success === true || result.valid === true;
    } catch (error) {
      console.error('🔴 Client: Error validating initData:', error);
      debug('Error validating initData:', error);
      return false;
    }
  }, []);

  const handleTelegramAuth = useCallback(async () => {
    console.log('🔄 Starting handleTelegramAuth');
    console.log('🔄 InitData length:', initData?.length);
    console.log('🔄 User:', user);
    
    if (!initData || !user) {
      const error = 'Telegram WebApp not initialized or no user data';
      console.error('🔴 Missing data:', { initData: !!initData, user: !!user });
      debug(error);
      setAuthError(error);
      onError?.(error);
      return;
    }

    setIsAuthenticating(true);
    setAuthError(null);
    console.log('🔄 Starting Telegram WebApp authentication...');
    debug('Starting Telegram WebApp authentication...');

    try {
      // Add haptic feedback
      haptic.impact('light');

      // Validate initData with server
      console.log('🔄 Validating initData with server...');
      const isValid = await validateInitData(initData);
      console.log('🔄 Server validation result:', isValid);
      
      if (!isValid) {
        console.error('🔴 Server validation failed');
        throw new Error('Invalid Telegram data');
      }

      console.log('✅ Server validation passed, calling NextAuth signIn...');
      debug('Calling NextAuth signIn with validated data...');

      // Use NextAuth signIn with telegram-miniapp provider
      const result = await signIn('telegram-miniapp', {
        initData: initData,
        redirect: false,
      });

      console.log('🔄 NextAuth signIn result:', result);
      debug('NextAuth signIn result:', result);

      if (result?.ok) {
        debug('Authentication successful');
        haptic.notification('success');
        onSuccess?.(user);
      } else {
        throw new Error(result?.error || 'Authentication failed');
      }
    } catch (error: any) {
      debug('Authentication error:', error);
      const errorMessage = error.message || 'Authentication failed';
      console.error('🔴 Telegram auth error:', errorMessage, error);
      setAuthError(errorMessage);
      haptic.notification('error');
      onError?.(errorMessage);
      // Don't show alert to avoid blocking UI
      // await showAlert(`Authentication failed: ${errorMessage}`);
    } finally {
      setIsAuthenticating(false);
    }
  }, [initData, user, onSuccess, onError, validateInitData, haptic, showAlert]);

  // Loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <CardTitle className="text-lg">Loading Telegram WebApp...</CardTitle>
          </div>
          <CardDescription>
            Detecting Telegram environment...
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Server validation in progress
  if (status === 'server-validating') {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <CardTitle className="text-lg">Validating Authentication...</CardTitle>
          </div>
          <CardDescription>
            Verifying your Telegram data with server...
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center space-x-3">
                {user.photo_url && (
                  <img 
                    src={user.photo_url} 
                    alt="Avatar" 
                    className="w-10 h-10 rounded-full"
                  />
                )}
                <div>
                  <p className="font-medium">
                    {user.first_name} {user.last_name || ''}
                  </p>
                  {user.username && (
                    <p className="text-sm text-muted-foreground">
                      @{user.username}
                    </p>
                  )}
                </div>
                {user.is_premium && (
                  <Badge variant="secondary" className="ml-auto">
                    Premium
                  </Badge>
                )}
              </div>
            </div>
          )}
          <div className="mt-3 flex items-center justify-center space-x-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Please wait while we validate your authentication...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If already authenticated
  if (status === 'authenticated') {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <CardTitle className="text-lg">Already Authenticated</CardTitle>
          </div>
          <CardDescription>
            You are signed in as {session.user?.name || session.user?.email}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary">
              Provider: {(session as any)?.provider || 'Unknown'}
            </Badge>
            {isInTelegram && (
              <Badge variant="outline">
                <Smartphone className="h-3 w-3 mr-1" />
                Telegram WebApp
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // If not in Telegram environment
  if (!isInTelegram) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-lg">Not in Telegram</CardTitle>
          </div>
          <CardDescription>
            This component only works within Telegram WebApp environment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Please open this app from within Telegram to use Telegram authentication.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Main authentication UI
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-[#0088cc] rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="m12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/>
            </svg>
          </div>
          <CardTitle className="text-lg">Telegram Authentication</CardTitle>
        </div>
        <CardDescription>
          Sign in securely using your Telegram account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {user && (
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex items-center space-x-3">
              {user.photo_url && (
                <img 
                  src={user.photo_url} 
                  alt="Avatar" 
                  className="w-10 h-10 rounded-full"
                />
              )}
              <div>
                <p className="font-medium">
                  {user.first_name} {user.last_name || ''}
                </p>
                {user.username && (
                  <p className="text-sm text-muted-foreground">
                    @{user.username}
                  </p>
                )}
              </div>
              {user.is_premium && (
                <Badge variant="secondary" className="ml-auto">
                  Premium
                </Badge>
              )}
            </div>
          </div>
        )}

        {authError && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive">{authError}</p>
            </div>
          </div>
        )}

        <Button 
          onClick={handleTelegramAuth}
          disabled={isAuthenticating || !user || !initData}
          className="w-full"
          size="lg"
        >
          {isAuthenticating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Authenticating...
            </>
          ) : (
            <>
              <Smartphone className="mr-2 h-4 w-4" />
              Sign in with Telegram
            </>
          )}
        </Button>

        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="px-2 py-1">
            Platform: {platform || 'Unknown'}
          </Badge>
          {version && (
            <Badge variant="outline" className="px-2 py-1">
              Version: {version}
            </Badge>
          )}
          <Badge variant="outline" className="px-2 py-1">
            Theme: {colorScheme}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
} 