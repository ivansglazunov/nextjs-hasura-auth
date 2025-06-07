'use client';

import { usePWA } from '../hooks/use-pwa';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Download, X, RefreshCw } from 'lucide-react';
import { useState } from 'react';

export function PWAInstallPrompt() {
  const [show, setShow] = useState(true);

  const { 
    isSupported,
    isInstalled,
    installPromptAvailable,
    updateAvailable,
    displayMode,
    install,
    update,
    dismissUpdate
  } = usePWA();

  // Don't show anything if PWA is not supported or already installed
  if (!isSupported || isInstalled) {
    return null;
  }

  return (
    <>
      {/* Install Prompt */}
      {installPromptAvailable && show && (
        <Card className="fixed bottom-4 right-4 z-50 w-80 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Download className="h-5 w-5" />
                Install Hasyx
              </CardTitle>
            </div>
            <CardDescription>
              Install this app on your device for a better experience.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex gap-2">
              <Button onClick={install} className="flex-1">
                Install
              </Button>
              <Button variant="outline" onClick={() => setShow(false)}>
                Later
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Update Available Prompt */}
      {updateAvailable && (
        <Card className="fixed top-4 right-4 z-50 w-80 shadow-lg border-orange-200 bg-orange-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2 text-orange-900">
                <RefreshCw className="h-5 w-5" />
                Update Available
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={dismissUpdate}
                className="text-orange-600 hover:text-orange-800"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription className="text-orange-700">
              A new version of the app is available.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex gap-2">
              <Button onClick={update} className="flex-1">
                Update Now
              </Button>
              <Button variant="outline" onClick={dismissUpdate}>
                Later
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

export function PWAStatus() {
  const { 
    isSupported,
    isInstalled,
    displayMode,
    isInitialized
  } = usePWA();

  if (!isInitialized) {
    return null;
  }

  return (
    <div className="text-xs text-muted-foreground p-2 border-t">
      PWA: {isSupported ? '✅ Supported' : '❌ Not Supported'} | 
      {isInstalled ? ' 📱 Installed' : ' 🌐 Web'} | 
      Mode: {displayMode}
    </div>
  );
} 