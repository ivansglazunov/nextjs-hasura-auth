'use client';

import { useState, useEffect } from 'react';
import { usePWA } from '../hooks/use-pwa';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Bug, X, Smartphone, Download, RefreshCw, Wifi, WifiOff, Info } from 'lucide-react';

interface DebugMessage {
  id: string;
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  data?: any;
}

interface DeviceInfo {
  userAgent: string;
  platform: string;
  isIOS: boolean;
  isAndroid: boolean;
  isDesktop: boolean;
  isSafari: boolean;
  isChrome: boolean;
  isStandalone: boolean;
  displayMode: string;
  hasServiceWorker: boolean;
  hasNotificationAPI: boolean;
  hasBeforeInstallPrompt: boolean;
  screenSize: string;
  orientation: string;
}

export function PWADebug() {
  const [messages, setMessages] = useState<DebugMessage[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  
  const {
    isSupported,
    isInstalled,
    installPromptAvailable,
    updateAvailable,
    displayMode,
    isInitialized,
    install
  } = usePWA();

  const addMessage = (type: DebugMessage['type'], title: string, message: string, data?: any) => {
    const newMessage: DebugMessage = {
      id: Date.now().toString(),
      timestamp: new Date(),
      type,
      title,
      message,
      data
    };
    
    setMessages(prev => [newMessage, ...prev.slice(0, 19)]); // Keep only last 20 messages
    
    // Auto show debug panel when new message arrives
    if (type === 'error' || type === 'warning') {
      setIsVisible(true);
    }
  };

  // Collect device information
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isAndroid = /Android/.test(userAgent);
    const isDesktop = !isIOS && !isAndroid;
    const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
    const isChrome = /Chrome/.test(userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    
    const info: DeviceInfo = {
      userAgent,
      platform: navigator.platform,
      isIOS,
      isAndroid,
      isDesktop,
      isSafari,
      isChrome,
      isStandalone,
      displayMode: isStandalone ? 'standalone' : 'browser',
      hasServiceWorker: 'serviceWorker' in navigator,
      hasNotificationAPI: 'Notification' in window,
      hasBeforeInstallPrompt: false, // Will be updated when event fires
      screenSize: `${window.screen.width}x${window.screen.height}`,
      orientation: window.screen.orientation?.type || 'unknown'
    };

    setDeviceInfo(info);

    // Log initial device info
    addMessage('info', 'Device Detection', `Platform: ${isIOS ? 'iOS' : isAndroid ? 'Android' : 'Desktop'}, Browser: ${isSafari ? 'Safari' : isChrome ? 'Chrome' : 'Other'}`, info);

    // Special iOS detection messages
    if (isIOS) {
      if (isStandalone) {
        addMessage('success', 'iOS PWA Mode', 'App is running in standalone mode on iOS');
      } else if (isSafari) {
        addMessage('info', 'iOS Safari Detected', 'Use Share → Add to Home Screen to install');
      } else {
        addMessage('warning', 'iOS Non-Safari Browser', 'PWA installation only works in Safari on iOS');
      }
    }

    // Android specific checks
    if (isAndroid && !isChrome) {
      addMessage('warning', 'Android Non-Chrome', 'PWA works best in Chrome on Android');
    }
  }, []);

  useEffect(() => {
    // Monitor PWA state changes
    if (isInitialized) {
      addMessage('info', 'PWA Initialized', `Support: ${isSupported}, Installed: ${isInstalled}, Display: ${displayMode}`);
    }
  }, [isInitialized, isSupported, isInstalled, displayMode]);

  useEffect(() => {
    if (installPromptAvailable) {
      addMessage('success', 'Install Prompt Available', 'PWA can be installed now');
      // Update device info
      if (deviceInfo) {
        setDeviceInfo({...deviceInfo, hasBeforeInstallPrompt: true});
      }
    }
  }, [installPromptAvailable, deviceInfo]);

  useEffect(() => {
    if (updateAvailable) {
      addMessage('warning', 'Update Available', 'New version ready to install');
    }
  }, [updateAvailable]);

  useEffect(() => {
    // Monitor network status
    const handleOnline = () => {
      setIsOnline(true);
      addMessage('success', 'Network Online', 'Internet connection restored');
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      addMessage('warning', 'Network Offline', 'No internet connection');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    // Monitor service worker events
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        addMessage('info', 'Service Worker Message', event.data?.type || 'Unknown message', event.data);
      });

      // Check if service worker is registered
      navigator.serviceWorker.getRegistration().then(registration => {
        if (registration) {
          addMessage('success', 'Service Worker Active', `State: ${registration.active?.state || 'unknown'}`);
          
          registration.addEventListener('updatefound', () => {
            addMessage('info', 'Service Worker Update', 'New service worker installing');
          });
        } else {
          addMessage('error', 'Service Worker Missing', 'No service worker registration found');
        }
      }).catch(error => {
        addMessage('error', 'Service Worker Check Failed', error.message);
      });
    } else {
      addMessage('error', 'Service Worker Not Supported', 'Browser does not support service workers');
    }

    // Monitor beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      const platforms = (e as any).platforms || [];
      addMessage('success', 'Install Prompt Event', 'beforeinstallprompt event fired', {
        platforms,
        userChoice: 'pending'
      });
    };

    // Monitor app installed event
    const handleAppInstalled = () => {
      addMessage('success', 'App Installed', 'PWA was successfully installed');
    };

    // Monitor PWA custom events
    const handlePWAInstallAvailable = () => {
      addMessage('info', 'PWA Install Available', 'Custom install event fired');
    };

    const handlePWAInstalled = () => {
      addMessage('success', 'PWA Installed', 'Custom installed event fired');
    };

    // Monitor iOS instructions event
    const handleIOSInstructions = (event: CustomEvent) => {
      addMessage('info', 'iOS Instructions', event.detail?.message || 'iOS installation instructions shown');
    };

    // Monitor PWA install blocked event
    const handlePWAInstallBlocked = (event: CustomEvent) => {
      const { reason, userAgent, isIOS, platform } = event.detail || {};
      addMessage('warning', 'Install Blocked', reason || 'Installation not available', {
        reason,
        userAgent: userAgent?.substring(0, 100),
        isIOS,
        platform
      });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('pwa-install-available', handlePWAInstallAvailable);
    window.addEventListener('pwa-installed', handlePWAInstalled);
    window.addEventListener('pwa-ios-instructions', handleIOSInstructions as EventListener);
    window.addEventListener('pwa-install-blocked', handlePWAInstallBlocked as EventListener);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('pwa-install-available', handlePWAInstallAvailable);
      window.removeEventListener('pwa-installed', handlePWAInstalled);
      window.removeEventListener('pwa-ios-instructions', handleIOSInstructions as EventListener);
      window.removeEventListener('pwa-install-blocked', handlePWAInstallBlocked as EventListener);
    };
  }, []);

  useEffect(() => {
    // Check manifest and service worker files
    fetch('/manifest.webmanifest')
      .then(response => {
        if (response.ok) {
          addMessage('success', 'Manifest Found', `Status: ${response.status}`);
          return response.json();
        } else {
          addMessage('error', 'Manifest Error', `Status: ${response.status}`);
          throw new Error(`HTTP ${response.status}`);
        }
      })
      .then(manifest => {
        addMessage('info', 'Manifest Loaded', `Name: ${manifest.name || 'Unknown'}, Display: ${manifest.display || 'Unknown'}`, manifest);
      })
      .catch(error => {
        addMessage('error', 'Manifest Failed', error.message);
      });

    fetch('/sw.js')
      .then(response => {
        if (response.ok) {
          addMessage('success', 'Service Worker Found', `Status: ${response.status}`);
        } else {
          addMessage('error', 'Service Worker Error', `Status: ${response.status}`);
        }
      })
      .catch(error => {
        addMessage('error', 'Service Worker Failed', error.message);
      });

    // Test notification permission
    if ('Notification' in window) {
      const permission = Notification.permission;
      addMessage('info', 'Notification Permission', `Status: ${permission}`);
    } else {
      addMessage('warning', 'Notifications Not Supported', 'Browser does not support notifications');
    }
  }, []);

  const clearMessages = () => {
    setMessages([]);
  };

  const testInstall = async () => {
    try {
      addMessage('info', 'Testing Install', 'Attempting to trigger install prompt...');
      await install();
      addMessage('success', 'Install Triggered', 'Install prompt was shown successfully');
    } catch (error) {
      addMessage('error', 'Install Failed', (error as Error).message);
    }
  };

  const testNotification = async () => {
    try {
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        addMessage('info', 'Notification Permission', `Result: ${permission}`);
        
        if (permission === 'granted') {
          new Notification('PWA Debug Test', {
            body: 'This is a test notification from PWA Debug',
            icon: '/icons/icon-192.webp'
          });
          addMessage('success', 'Test Notification', 'Notification sent successfully');
        }
      } else {
        addMessage('error', 'Notification Test Failed', 'Notifications not supported');
      }
    } catch (error) {
      addMessage('error', 'Notification Test Failed', (error as Error).message);
    }
  };

  const getTypeColor = (type: DebugMessage['type']) => {
    switch (type) {
      case 'success': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-blue-500';
    }
  };

  const getTypeIcon = (type: DebugMessage['type']) => {
    switch (type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return 'ℹ️';
    }
  };

  return (
    <>
      {/* Debug Toggle Button */}
      <Button
        onClick={() => setIsVisible(!isVisible)}
        size="sm"
        variant="outline"
        className="fixed top-4 left-4 z-[60] shadow-lg bg-white/90 backdrop-blur-sm border-2"
      >
        <Bug className="h-4 w-4 mr-1" />
        PWA Debug ({messages.length})
        {!isOnline && <WifiOff className="h-4 w-4 ml-1 text-red-500" />}
        {isOnline && <Wifi className="h-4 w-4 ml-1 text-green-500" />}
      </Button>

      {/* Debug Panel */}
      {isVisible && (
        <Card className="fixed top-16 left-4 z-[50] w-96 max-h-[80vh] overflow-hidden shadow-xl bg-white/95 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Bug className="h-5 w-5" />
                PWA Debug Console
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsVisible(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Status Badges */}
            <div className="flex flex-wrap gap-1 mt-2">
              <Badge variant={isSupported ? "default" : "destructive"}>
                {isSupported ? "Supported" : "Not Supported"}
              </Badge>
              <Badge variant={isInstalled ? "default" : "secondary"}>
                {isInstalled ? "Installed" : "Web App"}
              </Badge>
              <Badge variant={installPromptAvailable ? "default" : "secondary"}>
                {installPromptAvailable ? "Can Install" : "No Install"}
              </Badge>
              <Badge variant={isOnline ? "default" : "destructive"}>
                {isOnline ? "Online" : "Offline"}
              </Badge>
              {deviceInfo && (
                <>
                  <Badge variant="outline">
                    {deviceInfo.isIOS ? "iOS" : deviceInfo.isAndroid ? "Android" : "Desktop"}
                  </Badge>
                  <Badge variant="outline">
                    {deviceInfo.isSafari ? "Safari" : deviceInfo.isChrome ? "Chrome" : "Other"}
                  </Badge>
                </>
              )}
            </div>

            {/* Device Info */}
            {deviceInfo && (
              <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                <div className="font-medium mb-1">Device Info:</div>
                <div>Platform: {deviceInfo.platform}</div>
                <div>Screen: {deviceInfo.screenSize}</div>
                <div>Orientation: {deviceInfo.orientation}</div>
                <div>Standalone: {deviceInfo.isStandalone ? 'Yes' : 'No'}</div>
                <div>SW Support: {deviceInfo.hasServiceWorker ? 'Yes' : 'No'}</div>
                <div>Notifications: {deviceInfo.hasNotificationAPI ? 'Yes' : 'No'}</div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 mt-2">
              <Button size="sm" onClick={testInstall} disabled={!installPromptAvailable}>
                <Download className="h-3 w-3 mr-1" />
                Test Install
              </Button>
              <Button size="sm" variant="outline" onClick={testNotification}>
                Test Notify
              </Button>
              <Button size="sm" variant="outline" onClick={clearMessages}>
                Clear
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="pt-0">
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No debug messages yet...
                </p>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-2 border rounded text-xs bg-white/50"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full ${getTypeColor(msg.type)}`} />
                      <span className="font-medium">{getTypeIcon(msg.type)} {msg.title}</span>
                      <span className="text-muted-foreground ml-auto">
                        {msg.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-muted-foreground">{msg.message}</p>
                    {msg.data && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-blue-600">Show data</summary>
                        <pre className="mt-1 p-1 bg-gray-100 rounded text-xs overflow-x-auto">
                          {JSON.stringify(msg.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
} 