"use client";

import { useState, useEffect } from "react";
import { Session } from "next-auth";
import { SidebarData } from "hasyx/components/sidebar";
import { SidebarLayout } from "hasyx/components/sidebar/layout";
import { Card, CardContent, CardHeader, CardTitle } from "hasyx/components/ui/card";
import { Button } from "hasyx/components/ui/button";
import { Badge } from "hasyx/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "hasyx/components/ui/tabs";
import { 
  Smartphone, 
  Download, 
  RefreshCw, 
  Trash2, 
  Settings, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Wifi,
  WifiOff,
  Database,
  Bell,
  Globe,
  Monitor,
  Tablet,
  Code
} from "lucide-react";
import { usePWA } from "hasyx/hooks/use-pwa";
import { 
  checkPWASupport, 
  isPWA, 
  getPWADisplayMode,
  updateServiceWorker,
  requestNotificationPermission,
  showNotification
} from "hasyx/lib/pwa";

interface PWADiagnosticsProps {
  serverSession: Session | null;
  sidebarData: SidebarData;
}

interface CacheInfo {
  name: string;
  size: number;
  lastModified: Date;
  entries: number;
}

interface InstallationStatus {
  canInstall: boolean;
  isInstalled: boolean;
  platform: string;
  reason?: string;
}

interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'warning' | 'pending';
  message: string;
  details?: any;
}

export default function PWADiagnostics({ serverSession, sidebarData }: PWADiagnosticsProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [cacheInfo, setCacheInfo] = useState<CacheInfo[]>([]);
  const [installStatus, setInstallStatus] = useState<InstallationStatus>({ 
    canInstall: false, 
    isInstalled: false, 
    platform: 'unknown' 
  });
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [isUninstalling, setIsUninstalling] = useState(false);
  
  const {
    isSupported,
    isInstalled,
    installPromptAvailable,
    updateAvailable,
    displayMode,
    isInitialized,
    install,
    update
  } = usePWA();

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Set initial state
    setIsOnline(navigator.onLine);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load cache information
  useEffect(() => {
    loadCacheInfo();
  }, []);

  // Update installation status
  useEffect(() => {
    updateInstallationStatus();
  }, [isInstalled, installPromptAvailable]);

  const loadCacheInfo = async () => {
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        const info: CacheInfo[] = [];
        
        for (const name of cacheNames) {
          const cache = await caches.open(name);
          const keys = await cache.keys();
          
          info.push({
            name,
            size: 0, // We'll estimate this
            lastModified: new Date(),
            entries: keys.length
          });
        }
        
        setCacheInfo(info);
      }
    } catch (error) {
      console.error('Failed to load cache info:', error);
    }
  };

  const updateInstallationStatus = () => {
    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isAndroid = /Android/.test(userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                        (window.navigator as any).standalone;

    let platform = 'desktop';
    if (isIOS) platform = 'ios';
    else if (isAndroid) platform = 'android';

    let reason = '';
    if (isStandalone) {
      reason = 'Already installed and running in standalone mode';
    } else if (!isSupported) {
      reason = 'PWA not supported on this browser/device';
    } else if (isIOS && !/Safari/.test(userAgent)) {
      reason = 'iOS requires Safari browser for PWA installation';
    } else if (!installPromptAvailable) {
      reason = 'Browser install prompt not available (may need user engagement)';
    }

    setInstallStatus({
      canInstall: installPromptAvailable && !isInstalled,
      isInstalled: isStandalone || isInstalled,
      platform,
      reason
    });
  };

  const clearCache = async (cacheName?: string) => {
    try {
      if (cacheName) {
        const { clearCache: clearSingleCache } = await import('./pwa-cache-utils');
        await clearSingleCache(cacheName);
      } else {
        const { clearAllCaches } = await import('./pwa-cache-utils');
        const result = await clearAllCaches();
        
        if (result.success) {
          if ('Notification' in window && Notification.permission === 'granted') {
            showNotification('Cache Cleared', {
              body: `Cleared ${result.clearedCaches.length} caches, freed ~${Math.round(result.totalBytesFreed / 1024)}KB`,
              tag: 'cache-clear'
            });
          }
        }
      }
      
      await loadCacheInfo();
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  };

  const forceUpdate = async () => {
    try {
      const { forceReloadFromServer } = await import('./pwa-cache-utils');
      await forceReloadFromServer();
    } catch (error) {
      console.error('Failed to force update:', error);
      // Fallback to existing method
      await updateServiceWorker();
    }
  };

  const uninstallPWA = async () => {
    setIsUninstalling(true);
    
    try {
      const { completePWAReset } = await import('./pwa-cache-utils');
      const result = await completePWAReset();
      
      if (result.success) {
        // Show success notification
        if ('Notification' in window && Notification.permission === 'granted') {
          showNotification('PWA Reset Complete', {
            body: `${result.actions.length} actions completed. Page will reload shortly.`,
            tag: 'pwa-uninstall'
          });
        }
        
        // Reload page after a delay
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        console.error('PWA reset failed:', result.errors);
      }
      
    } catch (error) {
      console.error('Failed to uninstall PWA:', error);
    } finally {
      setIsUninstalling(false);
    }
  };

  const runPWATests = async () => {
    setIsRunningTests(true);
    const results: TestResult[] = [];

    // Test 1: PWA Support
    const support = checkPWASupport();
    results.push({
      name: 'PWA Support',
      status: support && support.serviceWorker ? 'passed' : 'failed',
      message: support && support.serviceWorker ? 'Browser supports PWA features' : 'Browser lacks PWA support',
      details: support
    });

    // Test 2: Manifest
    try {
      const manifestResponse = await fetch('/manifest.webmanifest');
      const manifestData = await manifestResponse.json();
      
      results.push({
        name: 'Web App Manifest',
        status: manifestResponse.ok ? 'passed' : 'failed',
        message: manifestResponse.ok ? `Manifest loaded: ${manifestData.name}` : 'Manifest not found',
        details: manifestData
      });
    } catch (error) {
      results.push({
        name: 'Web App Manifest',
        status: 'failed',
        message: 'Failed to load manifest',
        details: error
      });
    }

    // Test 3: Service Worker
    try {
      const swResponse = await fetch('/sw.js');
      results.push({
        name: 'Service Worker',
        status: swResponse.ok ? 'passed' : 'failed',
        message: swResponse.ok ? 'Service worker file accessible' : 'Service worker not found',
        details: { status: swResponse.status }
      });
    } catch (error) {
      results.push({
        name: 'Service Worker',
        status: 'failed',
        message: 'Service worker not accessible',
        details: error
      });
    }

    // Test 4: HTTPS
    results.push({
      name: 'Secure Context',
      status: window.isSecureContext ? 'passed' : 'failed',
      message: window.isSecureContext ? 'Running on HTTPS' : 'HTTPS required for PWA',
      details: { protocol: window.location.protocol }
    });

    // Test 5: Notifications
    const notificationPermission = 'Notification' in window ? Notification.permission : 'not-supported';
    results.push({
      name: 'Notifications',
      status: notificationPermission === 'granted' ? 'passed' : 
              notificationPermission === 'default' ? 'warning' : 'failed',
      message: `Notification permission: ${notificationPermission}`,
      details: { permission: notificationPermission }
    });

    // Test 6: Cache API
    const cacheSupported = 'caches' in window;
    results.push({
      name: 'Cache API',
      status: cacheSupported ? 'passed' : 'failed',
      message: cacheSupported ? 'Cache API available' : 'Cache API not supported',
      details: { supported: cacheSupported }
    });

    // Test 7: Network Status
    results.push({
      name: 'Network Status',
      status: isOnline ? 'passed' : 'warning',
      message: isOnline ? 'Online' : 'Offline (testing offline capability)',
      details: { online: isOnline }
    });

    // Test 8: Installation Status
    results.push({
      name: 'Installation',
      status: installStatus.isInstalled ? 'passed' : 
              installStatus.canInstall ? 'warning' : 'failed',
      message: installStatus.isInstalled ? 'PWA is installed' :
               installStatus.canInstall ? 'Can be installed' : 'Cannot be installed',
      details: installStatus
    });

    setTestResults(results);
    setIsRunningTests(false);
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'passed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <SidebarLayout sidebarData={sidebarData} breadcrumb={[
      { title: 'Hasyx', link: '/' },
      { title: 'PWA Diagnostics', link: '/hasyx/pwa' }
    ]}>
      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* Header with Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">PWA Diagnostics</h1>
            {isOnline ? (
              <Badge variant="default" className="flex items-center gap-1">
                <Wifi className="h-3 w-3" />
                Online
              </Badge>
            ) : (
              <Badge variant="destructive" className="flex items-center gap-1">
                <WifiOff className="h-3 w-3" />
                Offline
              </Badge>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button onClick={forceUpdate} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Force Update
            </Button>
            {installStatus.canInstall && (
              <Button onClick={install} size="sm">
                <Download className="h-4 w-4 mr-2" />
                Install PWA
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="overview" className="flex-1">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tests">Tests</TabsTrigger>
            <TabsTrigger value="cache">Cache</TabsTrigger>
            <TabsTrigger value="install">Install</TabsTrigger>
            <TabsTrigger value="uninstall">Uninstall</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* PWA Status Card */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">PWA Status</CardTitle>
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {installStatus.isInstalled ? 'Installed' : 'Web App'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Platform: {installStatus.platform}
                  </p>
                  <div className="mt-2">
                    <Badge variant={isSupported ? "default" : "destructive"}>
                      {isSupported ? "Supported" : "Not Supported"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Display Mode Card */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Display Mode</CardTitle>
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold capitalize">
                    {displayMode || getPWADisplayMode()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isPWA() ? 'Running as PWA' : 'Running in browser'}
                  </p>
                </CardContent>
              </Card>

              {/* Cache Card */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cache Status</CardTitle>
                  <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {cacheInfo.length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Active caches
                  </p>
                  <div className="mt-2">
                    <Badge variant="outline">
                      {cacheInfo.reduce((sum, cache) => sum + cache.entries, 0)} entries
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Test Results */}
            {testResults.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent Test Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {testResults.slice(0, 5).map((result, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(result.status)}
                          <span className="text-sm font-medium">{result.name}</span>
                        </div>
                        <Badge variant={
                          result.status === 'passed' ? 'default' :
                          result.status === 'warning' ? 'secondary' : 'destructive'
                        }>
                          {result.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="tests" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>PWA Stability Tests</CardTitle>
                  <Button 
                    onClick={runPWATests} 
                    disabled={isRunningTests}
                    className="flex items-center gap-2"
                  >
                    <Code className="h-4 w-4" />
                    {isRunningTests ? 'Running Tests...' : 'Run Tests'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {testResults.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Click "Run Tests" to start PWA stability testing
                  </p>
                ) : (
                  <div className="space-y-3">
                    {testResults.map((result, index) => (
                      <div key={index} className="border rounded p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(result.status)}
                            <span className="font-medium">{result.name}</span>
                          </div>
                          <Badge variant={
                            result.status === 'passed' ? 'default' :
                            result.status === 'warning' ? 'secondary' : 'destructive'
                          }>
                            {result.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{result.message}</p>
                        {result.details && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs text-blue-600">
                              Show details
                            </summary>
                            <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                              {JSON.stringify(result.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cache" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Cache Management</CardTitle>
                  <div className="flex gap-2">
                    <Button onClick={loadCacheInfo} variant="outline" size="sm">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                    <Button 
                      onClick={() => clearCache()} 
                      variant="destructive" 
                      size="sm"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear All
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {cacheInfo.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No caches found
                  </p>
                ) : (
                  <div className="space-y-3">
                    {cacheInfo.map((cache, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded">
                        <div>
                          <h4 className="font-medium">{cache.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {cache.entries} entries
                          </p>
                        </div>
                        <Button 
                          onClick={() => clearCache(cache.name)} 
                          variant="outline" 
                          size="sm"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Clear
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="install" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Installation Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="flex items-center justify-between p-4 border rounded">
                    <div>
                      <h4 className="font-medium">Current Status</h4>
                      <p className="text-sm text-muted-foreground">
                        {installStatus.isInstalled ? 'PWA is installed' : 'Running as web app'}
                      </p>
                    </div>
                    <Badge variant={installStatus.isInstalled ? "default" : "secondary"}>
                      {installStatus.isInstalled ? "Installed" : "Not Installed"}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded">
                    <div>
                      <h4 className="font-medium">Platform</h4>
                      <p className="text-sm text-muted-foreground">
                        {installStatus.platform} - {navigator.userAgent.substring(0, 50)}...
                      </p>
                    </div>
                    <Badge variant="outline">
                      {installStatus.platform}
                    </Badge>
                  </div>

                  {installStatus.reason && (
                    <div className="p-4 border rounded bg-muted/50">
                      <h4 className="font-medium mb-2">Installation Info</h4>
                      <p className="text-sm text-muted-foreground">
                        {installStatus.reason}
                      </p>
                    </div>
                  )}

                  {installStatus.canInstall && (
                    <Button onClick={install} className="w-full">
                      <Download className="h-4 w-4 mr-2" />
                      Install PWA
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="uninstall" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-red-600">PWA Uninstall & Reset</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded p-4">
                  <h4 className="font-medium text-red-800 mb-2">⚠️ Warning</h4>
                  <p className="text-sm text-red-700">
                    This will completely reset the PWA by clearing all cached data, 
                    unregistering service workers, and removing all local storage. 
                    The page will reload automatically.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium">What will be cleared:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                    <li>• All cache storage</li>
                    <li>• Service worker registrations</li>
                    <li>• Local storage data</li>
                    <li>• Session storage data</li>
                    <li>• IndexedDB databases</li>
                  </ul>
                </div>

                <Button 
                  onClick={uninstallPWA} 
                  variant="destructive" 
                  disabled={isUninstalling}
                  className="w-full"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {isUninstalling ? 'Uninstalling...' : 'Complete PWA Reset'}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Note: This doesn't remove the PWA from your home screen. 
                  You'll need to manually remove it from your device.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SidebarLayout>
  );
} 