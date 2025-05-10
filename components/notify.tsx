"use client"

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useClient, useSubscription } from 'hasyx/lib/hasyx-client';
import { getDeviceInfo, NotificationPermission } from 'hasyx/lib/notify';
import { getFirebaseConfig } from 'hasyx/lib/notify-firebase';
import { useSession } from 'next-auth/react';
import { v4 as uuidv4 } from 'uuid';
import Debug from 'hasyx/lib/debug';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from 'hasyx/components/ui/card';
import { Button } from 'hasyx/components/ui/button';
import { Input } from 'hasyx/components/ui/input';
import { Textarea } from 'hasyx/components/ui/textarea';
import { Badge } from 'hasyx/components/ui/badge';
import { Skeleton } from 'hasyx/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from 'hasyx/components/ui/alert';
import { Ban, Bell, BellRing, Info, RefreshCw, X } from 'lucide-react';

const debug = Debug('notify:component');

// Type for notification context data
interface NotificationContextType {
  isSupported: boolean; // Browser supports Notification API and Firebase is configured
  isFcmInitialized: boolean; // Firebase Messaging is initialized
  isEnabled: boolean; // User has granted permission in browser and we have a DB record
  permissionStatus: NotificationPermissionState; // 'default', 'granted', 'denied' (browser level)
  dbPermission: NotificationPermission | null; // Permission record from DB
  deviceToken: string | null; // Current FCM token
  requestPermission: () => Promise<boolean>;
  removePermission: () => Promise<boolean>; // Revokes browser permission & deletes DB record
  sendTestNotification: (title: string, body: string, data?: Record<string, any>) => Promise<boolean>;
  loading: boolean;
  error: string | null;
}

// Browser notification permission states
export type NotificationPermissionState = 'default' | 'granted' | 'denied';

// Create notification context
const NotificationContext = createContext<NotificationContextType>({
  isSupported: false,
  isFcmInitialized: false,
  isEnabled: false,
  permissionStatus: 'default',
  dbPermission: null,
  deviceToken: null,
  requestPermission: async () => false,
  removePermission: async () => false,
  sendTestNotification: async () => false,
  loading: true,
  error: null,
});

// Hook to use notification context
export const useNotify = () => useContext(NotificationContext);

// Notification context provider
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  // Safer retrieval of userId, assuming id is added to the session
  const userId = (session?.user as { id?: string; })?.id;
  const client = useClient();

  const [isSupported, setIsSupported] = useState<boolean>(false); // Browser support + Firebase config
  const [isFcmInitialized, setIsFcmInitialized] = useState<boolean>(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermissionState>('default');
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [firebaseApp, setFirebaseApp] = useState<any | null>(null);
  const [firebaseMessaging, setFirebaseMessaging] = useState<any | null>(null); // Firebase Messaging instance
  const firebaseConfig = useMemo(() => getFirebaseConfig(), []);

  // Fetch existing permission from DB
  const { data: dbPermissionData, loading: dbPermissionLoading, error: dbPermissionError } = useSubscription<{ notification_permissions: NotificationPermission[] }>(
    { // Only subscribe if we have these
      table: 'notification_permissions',
      where: { user_id: { _eq: userId }, device_token: { _eq: deviceToken }, provider: { _eq: 'firebase' } },
      limit: 1, // Expect at most one permission for this user/device/token combo
      returning: ['id', 'user_id', 'provider', 'device_token', 'device_info', 'created_at', 'updated_at']
    }, // Pass null if not ready to subscribe
    { skip: !userId || !deviceToken || !isFcmInitialized }
  );

  const currentDbPermission = useMemo(() => {
    if (dbPermissionData?.notification_permissions && dbPermissionData.notification_permissions.length > 0) {
      return dbPermissionData.notification_permissions[0];
    }
    return null;
  }, [dbPermissionData]);

  useEffect(() => {
    if (dbPermissionError) {
      debug('Error subscribing to DB permission:', dbPermissionError);
      setError(prev => prev ? `${prev}\\nFailed to load DB permission: ${dbPermissionError.message}` : `Failed to load DB permission: ${dbPermissionError.message}`);
    }
  }, [dbPermissionError]);

  // Initialize Firebase and check for notification support
  useEffect(() => {
    async function initializeNotifications() {
      setLoading(true);
      try {
        // Check if notifications are supported in the browser
        if (typeof window !== 'undefined' && ('Notification' in window)) {
          debug('Browser Notification API supported.');

          // Check if Firebase is configured
          if (!firebaseConfig) {
            debug('Firebase is not configured in environment variables');
            setError("Firebase configuration is missing. Push notifications disabled.");
            setIsSupported(false);
            setLoading(false);
            return;
          }
          setIsSupported(true);

          // Dynamically import Firebase only on the client
          const { initializeApp: initApp, getApps: getAppsFn, deleteApp: deleteAppFn } = await import('firebase/app');
          const { getMessaging: getMsg, getToken: getTok, onMessage: onMsg, deleteToken: delTok, isSupported: isSupportedFcm } = await import('firebase/messaging');

          // Initialize Firebase
          let app: any;
          const apps = getAppsFn();
          if (apps.length > 0) {
            app = apps[0]!;
            debug('Using existing Firebase app.');
          } else {
            app = initApp(firebaseConfig);
            debug('Initialized new Firebase app.');
          }
          setFirebaseApp(app);

          if (await isSupportedFcm()) {
            const messaging = getMsg(app);
            setFirebaseMessaging(messaging);
            setIsFcmInitialized(true);
            debug('Firebase Messaging initialized.');

            // Set current browser permission status
            setPermissionStatus(Notification.permission as NotificationPermissionState);

            // If permission is already granted, get the device token
            if (Notification.permission === 'granted') {
              debug('Browser permission already granted, attempting to get token.');
              try {
                const currentToken = await getTok(messaging, { vapidKey: firebaseConfig.vapidKey });
                if (currentToken) {
                  debug('Device token received:', currentToken);
                  setDeviceToken(currentToken);
                } else {
                  debug('Failed to get device token (getToken returned null/undefined).');
                  // This can happen if service worker is not registered/active yet or other issues
                  setError("Could not retrieve notification token. Ensure service worker is active.");
                }
              } catch (tokenError: any) {
                debug('Error while getting device token:', tokenError);
                setError(`Failed to get device token: ${tokenError.message}`);
              }
            }

            // Setup incoming message handler when the app is in focus
            onMsg(messaging, (payload) => {
              debug('Message received in focus:', payload);
              // Can show a custom notification or update UI
              if (payload.notification) {
                // Example: Show a simple alert or use a custom in-app notification component
                alert(`In-app: ${payload.notification.title}\n${payload.notification.body}`);
              }
            });
          } else {
            debug('Firebase Cloud Messaging is not supported in this browser/environment (e.g., missing service worker).');
            setError("Push notifications (FCM) are not supported in this browser. Ensure a service worker is registered.");
            setIsFcmInitialized(false);
            setIsSupported(false); // If FCM not supported, overall support is off
          }
        } else {
          debug('Notifications are not supported in this browser (Notification API missing).');
          setIsSupported(false);
          setError("Browser does not support Notification API.");
        }
      } catch (err: any) {
        debug('Error initializing notifications:', err);
        setError(`Error initializing notifications: ${err.message}`);
        setIsSupported(false);
      } finally {
        setLoading(false);
      }
    }

    initializeNotifications();

    // Cleanup Firebase app on unmount if it was initialized by this component
    // return () => {
    //   if (firebaseApp && getApps().includes(firebaseApp) && getApps().length === 1) { // Only delete if it's the one we made and it's the only one
    //     debug("Cleaning up Firebase app instance.");
    //     deleteApp(firebaseApp).catch(e => debug("Error deleting Firebase app:", e));
    //   }
    // };
  }, [firebaseConfig]); // firebaseConfig is stable due to useMemo

  // Function to request permission to send notifications
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !isFcmInitialized || !userId || !firebaseMessaging || !firebaseConfig) {
      setError('Notifications are not supported, Firebase not ready, or user not authenticated.');
      debug('Request permission prerequisites not met:', { isSupported, isFcmInitialized, userId: !!userId, firebaseMessaging: !!firebaseMessaging, firebaseConfig: !!firebaseConfig });
      return false;
    }
    setLoading(true);
    setError(null);

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission as NotificationPermissionState);

      if (permission !== 'granted') {
        debug('User denied notification permission in browser.');
        setError('Notification permission denied. Please allow in browser settings.');
        setLoading(false);
        return false;
      }

      // Get device token
      const { getToken: getTok } = await import('firebase/messaging');
      const token = await getTok(firebaseMessaging, { vapidKey: firebaseConfig.vapidKey });

      if (!token) {
        setError('Failed to get device token after permission grant.');
        debug('Failed to get token even after permission was granted.');
        setLoading(false);
        return false;
      }
      setDeviceToken(token);
      debug('Device token received after permission grant:', token);

      // Check if permission already exists for this token and user
      // This uses the client directly, which might cause a re-render if its context changes, but it's a one-off check.
      const existingPermissions = await client.select<NotificationPermission[]>({
        table: 'notification_permissions',
        where: { user_id: { _eq: userId }, device_token: { _eq: token } },
        returning: ['id']
      });

      // If permission already exists, do not create a new one
      if (existingPermissions && existingPermissions.length > 0) {
        debug('Permission for this device and user already exists in DB.');
        setLoading(false);
        return true;
      }

      // Create permission record in the DB
      const deviceInfo = getDeviceInfo();
      const newPermissionRecord: Partial<NotificationPermission> = {
        id: uuidv4(),
        user_id: userId,
        provider: 'firebase',
        device_token: token,
        device_info: deviceInfo as any, // Cast needed if DeviceInfo type doesn't perfectly match jsonb expectations
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await client.insert({
        table: 'notification_permissions',
        object: newPermissionRecord,
      });

      debug('Notification permission created in DB:', newPermissionRecord);
      // The useSubscription for dbPermission should pick this up.
      setLoading(false);
      return true;
    } catch (err: any) {
      debug('Error requesting permission or saving to DB:', err);
      setError(err.message || 'Unknown error during permission request.');
      setLoading(false);
      return false;
    }
  }, [isSupported, isFcmInitialized, userId, client, firebaseMessaging, firebaseConfig]);

  // Function to remove notification permission
  const removePermission = useCallback(async (): Promise<boolean> => {
    if (!userId || !deviceToken || !client || !firebaseMessaging) {
      setError("Cannot remove permission: missing user, token, client or Firebase messaging instance.");
      return false;
    }
    setLoading(true);
    setError(null);
    try {
      // Delete FCM token from Firebase
      if (firebaseMessaging) {
        const { deleteToken: deleteTokenFcmFn } = await import('firebase/messaging');
        await deleteTokenFcmFn(firebaseMessaging);
        debug('FCM token deleted from Firebase.');
      } else {
        debug('Firebase messaging not initialized. Skipping FCM token deletion.');
      }
      setDeviceToken(null); // Clear local token
      setPermissionStatus('default'); // Reset browser permission status optimistically

      // Delete permission from DB
      if (currentDbPermission) {
        await client.delete({
          table: 'notification_permissions',
          where: { id: { _eq: currentDbPermission.id } }
        });
        debug('Notification permission removed from DB for ID:', currentDbPermission.id);
      } else {
        debug('No DB permission record found to remove (currentDbPermission is null).');
      }

      setLoading(false);
      return true;
    } catch (err: any) {
      debug('Error removing permission:', err);
      setError(err.message || 'Unknown error during permission removal.');
      setLoading(false);
      return false;
    }
  }, [userId, deviceToken, client, currentDbPermission, firebaseMessaging]);

  // Function to send a test notification (creates records in DB, actual sending is by backend worker)
  const sendTestNotification = useCallback(async (
    title: string,
    body: string,
    data?: Record<string, any>
  ): Promise<boolean> => {
    if (!currentDbPermission || !userId || !client) {
      setError('No permission to send notifications or user not authenticated.');
      debug('Send test notification prerequisites not met:', { currentDbPermission: !!currentDbPermission, userId: !!userId, client: !!client });
      return false;
    }
    setLoading(true);
    setError(null);
    try {
      // Create message for notification
      const messageId = uuidv4();
      const messageRecord: any = { // Type any for now, should be imported from Hasura types
        id: messageId,
        user_id: userId, // The sender of the test message is the current user
        title,
        body,
        data: data || { test: true },
        created_at: new Date().toISOString(),
      };
      await client.insert({
        table: 'notification_messages',
        object: messageRecord,
      });
      debug('Test notification message created in DB.');

      // Create notification, linked to the message and permission
      await client.insert({
        table: 'notifications',
        object: {
          id: uuidv4(),
          message_id: messageId,
          permission_id: currentDbPermission.id,
          status: 'pending', // Backend worker will pick this up
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });

      debug('Test notification created in DB, pending backend processing.');
      setLoading(false);
      return true;
    } catch (err: any) {
      debug('Error sending test notification (creating DB records):', err);
      setError(err.message || 'Unknown error sending test notification.');
      setLoading(false);
      return false;
    }
  }, [userId, client, currentDbPermission]);

  const isEnabled = permissionStatus === 'granted' && !!currentDbPermission;

  return (
    <NotificationContext.Provider value={{
      isSupported,
      isFcmInitialized,
      isEnabled,
      permissionStatus,
      dbPermission: currentDbPermission,
      deviceToken,
      requestPermission,
      removePermission,
      sendTestNotification,
      loading: loading || dbPermissionLoading,
      error
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

// Notification card component for display on the page
export function NotificationCard() {
  const {
    isSupported,
    isFcmInitialized,
    isEnabled,
    permissionStatus,
    dbPermission,
    deviceToken,
    requestPermission,
    removePermission,
    sendTestNotification,
    loading,
    error
  } = useNotify();
  const { data: session } = useSession();

  const [notificationTitle, setNotificationTitle] = useState('Test Title');
  const [notificationBody, setNotificationBody] = useState('This is a test notification body!');

  if (!session) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Login is required to work with notifications</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Please log in to manage your notification settings.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center">
          Notifications
          {isSupported && isFcmInitialized ? (
            <Badge variant="outline" className="ml-2 bg-green-100 text-green-700 border-green-300">
              Supported
            </Badge>
          ) : (
            <Badge variant="destructive" className="ml-2">
              Not Supported
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Setup browser push notifications for your application.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <Ban className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!isSupported && !loading && (
          <Alert variant="default">
            <Info className="h-4 w-4" />
            <AlertTitle>Notifications Not Supported</AlertTitle>
            <AlertDescription>
              Your browser does not support push notifications or Firebase is not configured correctly.
            </AlertDescription>
          </Alert>
        )}

        {isSupported && isFcmInitialized && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Permission Status</h4>
                <p className="text-sm text-muted-foreground">
                  {permissionStatus === 'granted' ? 'Granted' :
                    permissionStatus === 'denied' ? 'Denied' : 'Not Requested'}
                </p>
              </div>
              <Button
                onClick={requestPermission}
                disabled={loading || permissionStatus === 'granted' || permissionStatus === 'denied'}
                size="sm"
              >
                {loading && permissionStatus !== 'granted' ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Bell className="mr-2 h-4 w-4" />
                )}
                {permissionStatus === 'granted' ? 'Enabled' :
                  permissionStatus === 'denied' ? 'Blocked in Browser' : 'Enable Notifications'}
              </Button>
            </div>

            {isEnabled && dbPermission && (
              <>
                <div>
                  <h4 className="font-medium">Device Information</h4>
                  <p className="text-sm truncate text-muted-foreground">
                    Token: {deviceToken ? `${deviceToken.substring(0, 20)}...` : "N/A"}
                  </p>
                  {(dbPermission.device_info as any) && (
                    <p className="text-sm text-muted-foreground">
                      Platform: {(dbPermission.device_info as any).platform} / {(dbPermission.device_info as any).browser}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Registered: {new Date(dbPermission.created_at).toLocaleString()}
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Send Test Notification</h4>
                  <Input
                    placeholder="Notification Title"
                    value={notificationTitle}
                    onChange={(e) => setNotificationTitle(e.target.value)}
                    disabled={loading}
                  />
                  <Input
                    placeholder="Notification Body"
                    value={notificationBody}
                    onChange={(e) => setNotificationBody(e.target.value)}
                    disabled={loading}
                  />
                  <Button
                    onClick={() => sendTestNotification(notificationTitle, notificationBody)}
                    disabled={loading || !notificationTitle || !notificationBody}
                    className="w-full"
                  >
                    {loading && sendTestNotification.name === 'sendTestNotification' ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Sending...
                      </>
                    ) : (
                      <>
                        <BellRing className="mr-2 h-4 w-4" /> Send Test
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
      {isEnabled && dbPermission && (
        <CardFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={removePermission}
            disabled={loading}
            className="w-full text-red-600 hover:text-red-700 border-red-300 hover:bg-red-50"
          >
            {loading && removePermission.name === 'removePermission' ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <X className="mr-2 h-4 w-4" />
            )}
            Disable Notifications & Forget Device
          </Button>
        </CardFooter>
      )}
    </Card>
  );
} 