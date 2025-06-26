'use client';

import React from 'react';
import { TelegramWebAppAuth } from 'hasyx/components/auth/telegram-webapp-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'hasyx/components/ui/card';
import { Badge } from 'hasyx/components/ui/badge';
import { Button } from 'hasyx/components/ui/button';
import { useSession, signOut } from 'next-auth/react';
import { useTelegramWebApp } from 'hasyx/hooks/use-telegram-webapp';
import { Smartphone, LogOut, Info, Settings } from 'lucide-react';

export default function TelegramMiniAppPage() {
  const { data: session, status } = useSession();
  const {
    isInTelegram,
    isLoading,
    user,
    platform,
    version,
    colorScheme,
    mainButton,
    backButton,
    showAlert,
    showConfirm,
    haptic
  } = useTelegramWebApp();

  const handleSuccess = (user: any) => {
    console.log('Authentication successful:', user);
  };

  const handleError = (error: string) => {
    console.error('Authentication error:', error);
  };

  const handleSignOut = async () => {
    const confirmed = await showConfirm('Are you sure you want to sign out?');
    if (confirmed) {
      haptic.impact('medium');
      await signOut({ callbackUrl: '/' });
    }
  };

  const testMainButton = () => {
    mainButton.setText('Loading...');
    mainButton.showProgress();
    mainButton.show();
    
    setTimeout(() => {
      mainButton.hideProgress();
      mainButton.setText('Done!');
      haptic.notification('success');
      
      setTimeout(() => {
        mainButton.hide();
      }, 2000);
    }, 3000);
  };

  const testBackButton = () => {
    backButton.setOnClick(() => {
      showAlert('Back button clicked!');
      backButton.hide();
    });
    backButton.show();
  };

  const testHaptics = () => {
    haptic.impact('light');
    setTimeout(() => haptic.impact('medium'), 200);
    setTimeout(() => haptic.impact('heavy'), 400);
    setTimeout(() => haptic.notification('success'), 600);
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Telegram WebApp Integration</h1>
        <p className="text-muted-foreground">
          Secure authentication and native Telegram WebApp features
        </p>
      </div>

      {/* Authentication Section */}
      <TelegramWebAppAuth
        onSuccess={handleSuccess}
        onError={handleError}
        className="max-w-md mx-auto"
      />

      {/* Environment Info */}
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Info className="h-5 w-5" />
            <CardTitle className="text-lg">Environment Info</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">In Telegram:</span>
            <Badge variant={isInTelegram ? "default" : "secondary"}>
              {isInTelegram ? "Yes" : "No"}
            </Badge>
          </div>
          
          {platform && (
            <div className="flex items-center justify-between">
              <span className="text-sm">Platform:</span>
              <Badge variant="outline">{platform}</Badge>
            </div>
          )}
          
          {version && (
            <div className="flex items-center justify-between">
              <span className="text-sm">Version:</span>
              <Badge variant="outline">{version}</Badge>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <span className="text-sm">Theme:</span>
            <Badge variant="outline">{colorScheme}</Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm">Auth Status:</span>
            <Badge variant={status === 'authenticated' ? "default" : "secondary"}>
              {status}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* User Info */}
      {session && user && (
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Smartphone className="h-5 w-5" />
              <CardTitle className="text-lg">User Info</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center space-x-3">
              {user.photo_url && (
                <img 
                  src={user.photo_url} 
                  alt="Avatar" 
                  className="w-12 h-12 rounded-full"
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
                <p className="text-xs text-muted-foreground">
                  ID: {user.id}
                </p>
              </div>
              {user.is_premium && (
                <Badge variant="secondary">Premium</Badge>
              )}
            </div>
            
            <Button 
              onClick={handleSignOut}
              variant="outline"
              size="sm"
              className="w-full"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      )}

      {/* WebApp Features Demo */}
      {isInTelegram && (
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <CardTitle className="text-lg">WebApp Features</CardTitle>
            </div>
            <CardDescription>
              Test native Telegram WebApp functionality
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              onClick={testMainButton}
              variant="outline"
              size="sm"
              className="w-full"
            >
              Test Main Button
            </Button>
            
            <Button 
              onClick={testBackButton}
              variant="outline"
              size="sm"
              className="w-full"
            >
              Test Back Button
            </Button>
            
            <Button 
              onClick={testHaptics}
              variant="outline"
              size="sm"
              className="w-full"
            >
              Test Haptic Feedback
            </Button>
            
            <Button 
              onClick={() => showAlert('Hello from Telegram WebApp!')}
              variant="outline"
              size="sm"
              className="w-full"
            >
              Test Alert
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>How to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">For Development:</h4>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
              <li>• Open this app in a regular browser to see the "Not in Telegram" state</li>
              <li>• The app automatically detects the Telegram WebApp environment</li>
              <li>• Mock data is used for testing outside of Telegram</li>
            </ul>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">For Production:</h4>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
              <li>• Create a Telegram bot using @BotFather</li>
              <li>• Set the Web App URL to your deployed application</li>
              <li>• Configure TELEGRAM_LOGIN_BOT_TOKEN in environment variables</li>
              <li>• Users can access the app through the bot's menu button</li>
            </ul>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">Authentication Flow:</h4>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
              <li>• User opens the WebApp from Telegram</li>
              <li>• initData is automatically validated on the server</li>
              <li>• User account is created/linked in the database</li>
              <li>• NextAuth session is established with Hasura claims</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 