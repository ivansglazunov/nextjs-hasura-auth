"use client"

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useClient, useInsert, useSelect, useSubscription } from 'hasyx/lib/hasyx-client';
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

// Тип для данных контекста уведомлений
interface NotificationContextType {
  isSupported: boolean;
  isEnabled: boolean;
  permission: NotificationPermission | null;
  permissionStatus: 'default' | 'granted' | 'denied';
  deviceToken: string | null;
  requestPermission: () => Promise<boolean>;
  removePermission: () => Promise<boolean>;
  sendNotification: (title: string, body: string, data?: Record<string, any>) => Promise<boolean>;
  loading: boolean;
  error: string | null;
}

// Создаем контекст уведомлений
const NotificationContext = createContext<NotificationContextType>({
  isSupported: false,
  isEnabled: false,
  permission: null,
  permissionStatus: 'default',
  deviceToken: null,
  requestPermission: async () => false,
  removePermission: async () => false,
  sendNotification: async () => false,
  loading: false,
  error: null
});

// Хук для использования контекста уведомлений
export const useNotify = () => useContext(NotificationContext);

// Провайдер контекста уведомлений
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  // Более безопасное получение userId, предполагая, что id добавляется в сессию
  const userId = (session?.user as { id?: string; name?: string | null; email?: string | null; image?: string | null })?.id;
  
  const client = useClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'default' | 'granted' | 'denied'>('default');
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [firebaseMessaging, setFirebaseMessaging] = useState<any>(null);
  
  // Запрос на получение разрешения из БД для текущего устройства
  const { data: permissionFromSubscription } = useSubscription<NotificationPermission | null>({
    table: 'notification_permissions',
    where: userId ? { 
      user_id: { _eq: userId },
      device_token: { _eq: deviceToken }
    } : { id: { _eq: 'none' } }, // Если нет userId или deviceToken, используем невыполнимое условие
    returning: ['id', 'user_id', 'provider', 'device_token', 'device_info', 'created_at', 'updated_at'],
    limit: 1
  }, {
    skip: !userId || !deviceToken || !isSupported,
    fetchPolicy: 'network-only'
  });

  // Инициализация Firebase и проверка поддержки уведомлений
  useEffect(() => {
    const initializeNotifications = async () => {
      try {
        // Проверяем, поддерживаются ли уведомления в браузере
        if (typeof window !== 'undefined' && 'Notification' in window) {
          setIsSupported(true);
          setPermissionStatus(Notification.permission as 'default' | 'granted' | 'denied');
          
          // Проверяем, настроен ли Firebase
          const firebaseConfig = getFirebaseConfig();
          if (!firebaseConfig) {
            debug('Firebase не настроен в переменных окружения');
            return;
          }
          
          // Динамически импортируем Firebase только на клиенте
          const firebase = await import('firebase/app');
          const { getMessaging, getToken, onMessage } = await import('firebase/messaging');
          
          // Инициализируем Firebase
          let app;
          if (!firebase.getApps().length) {
            app = firebase.initializeApp(firebaseConfig);
          } else {
            app = firebase.getApp();
          }
          
          const messaging = getMessaging(app);
          setFirebaseMessaging(messaging);
          
          // Если разрешение уже предоставлено, получаем токен устройства
          if (Notification.permission === 'granted') {
            try {
              const currentToken = await getToken(messaging, {
                vapidKey: firebaseConfig.vapidKey
              });
              
              if (currentToken) {
                debug('Получен токен устройства:', currentToken);
                setDeviceToken(currentToken);
              } else {
                debug('Не удалось получить токен устройства');
              }
            } catch (tokenError) {
              debug('Ошибка при получении токена устройства:', tokenError);
              setError('Не удалось получить токен устройства');
            }
          }
          
          // Настройка обработчика входящих сообщений, когда приложение в фокусе
          onMessage(messaging, (payload) => {
            debug('Получено сообщение в фокусе:', payload);
            // Можно показать кастомное уведомление или обновить UI
            if (payload.notification) {
              const { title, body } = payload.notification;
              new Notification(title || 'Новое уведомление', {
                body: body || '',
                icon: '/favicon.ico'
              });
            }
          });
        } else {
          debug('Уведомления не поддерживаются в этом браузере');
          setIsSupported(false);
        }
      } catch (err) {
        debug('Ошибка при инициализации уведомлений:', err);
        setError('Ошибка при инициализации уведомлений');
        setIsSupported(false);
      }
    };
    
    initializeNotifications();
  }, []);
  
  // Функция запроса разрешения на отправку уведомлений
  const requestPermission = async (): Promise<boolean> => {
    if (!isSupported || !userId || !firebaseMessaging) {
      setError('Уведомления не поддерживаются или пользователь не аутентифицирован');
      return false;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Запрашиваем разрешение на уведомления
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
      
      if (permission !== 'granted') {
        debug('Пользователь отклонил разрешение на уведомления');
        setError('Необходимо разрешить уведомления в настройках браузера');
        return false;
      }
      
      // Получаем токен устройства
      const { getToken } = await import('firebase/messaging');
      const firebaseConfig = getFirebaseConfig();
      
      if (!firebaseConfig) {
        setError('Firebase не настроен');
        return false;
      }
      
      const token = await getToken(firebaseMessaging, {
        vapidKey: firebaseConfig.vapidKey
      });
      
      if (!token) {
        setError('Не удалось получить токен устройства');
        return false;
      }
      
      setDeviceToken(token);
      debug('Получен токен устройства:', token);
      
      // Проверяем, есть ли уже разрешение с этим токеном
      const existingPermission = await client.select({
        table: 'notification_permissions',
        where: { 
          user_id: { _eq: userId },
          device_token: { _eq: token }
        },
        returning: ['id'],
        limit: 1
      });
      
      // Если разрешение уже существует, не создаем новое
      if (existingPermission && existingPermission.length > 0) {
        debug('Разрешение для этого устройства уже существует');
        return true;
      }
      
      // Создаем запись о разрешении в БД
      const deviceInfo = getDeviceInfo();
      const result = await client.insert({
        table: 'notification_permissions',
        object: {
          id: uuidv4(),
          user_id: userId,
          provider: 'firebase',
          device_token: token,
          device_info: deviceInfo,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        returning: ['id']
      });
      
      debug('Создано разрешение на уведомления:', result);
      return true;
    } catch (err) {
      debug('Ошибка при запросе разрешения:', err);
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      return false;
    } finally {
      setLoading(false);
    }
  };
  
  // Функция удаления разрешения на отправку уведомлений
  const removePermission = async (): Promise<boolean> => {
    if (!permissionFromSubscription || !userId) {
      return false;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Удаляем разрешение из БД
      await client.delete({
        table: 'notification_permissions',
        pk_columns: { id: permissionFromSubscription.id },
      });
      
      debug('Удалено разрешение на уведомления');
      return true;
    } catch (err) {
      debug('Ошибка при удалении разрешения:', err);
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      return false;
    } finally {
      setLoading(false);
    }
  };
  
  // Функция отправки тестового уведомления
  const sendNotification = async (
    title: string, 
    body: string, 
    data?: Record<string, any>
  ): Promise<boolean> => {
    if (!permissionFromSubscription || !userId) {
      setError('Нет разрешения на отправку уведомлений');
      return false;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Создаем сообщение для уведомления
      const messageId = uuidv4();
      await client.insert({
        table: 'notification_messages',
        object: {
          id: messageId,
          title,
          body,
          data,
          user_id: userId,
          created_at: new Date().toISOString()
        },
        returning: ['id']
      });
      
      // Создаем уведомление, связанное с сообщением и разрешением
      await client.insert({
        table: 'notifications',
        object: {
          id: uuidv4(),
          message_id: messageId,
          permission_id: permissionFromSubscription.id,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        returning: ['id']
      });
      
      debug('Создано уведомление');
      return true;
    } catch (err) {
      debug('Ошибка при отправке уведомления:', err);
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      return false;
    } finally {
      setLoading(false);
    }
  };
  
  const isEnabled = Boolean(permissionFromSubscription && permissionStatus === 'granted');
  
  return (
    <NotificationContext.Provider value={{
      isSupported,
      isEnabled,
      permission: permissionFromSubscription ?? null,
      permissionStatus,
      deviceToken,
      requestPermission,
      removePermission,
      sendNotification,
      loading,
      error
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

// Компонент карточки уведомлений для отображения на странице
export function NotificationCard() {
  const {
    isSupported,
    isEnabled,
    permission,
    permissionStatus,
    requestPermission,
    removePermission,
    sendNotification,
    loading,
    error
  } = useNotify();
  
  const [notificationText, setNotificationText] = useState('Тестовое уведомление от Hasyx');
  const [notificationTitle, setNotificationTitle] = useState('Hasyx Notification');
  const { data: session } = useSession();
  
  if (!session?.user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Уведомления</CardTitle>
          <CardDescription>Для работы с уведомлениями необходимо войти в систему</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="h-5 w-5" />
          <span>Уведомления</span>
          {isSupported ? (
            <Badge variant="outline" className="ml-2">
              Поддерживаются
            </Badge>
          ) : (
            <Badge variant="destructive" className="ml-2">
              Не поддерживаются
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Настройка браузерных push-уведомлений для вашего приложения.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {!isSupported && (
          <Alert variant="destructive">
            <Info className="h-4 w-4" />
            <AlertTitle>Уведомления не поддерживаются</AlertTitle>
            <AlertDescription>
              Ваш браузер не поддерживает push-уведомления или Firebase не настроен.
            </AlertDescription>
          </Alert>
        )}
        
        {error && (
          <Alert variant="destructive">
            <Ban className="h-4 w-4" />
            <AlertTitle>Ошибка</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {isSupported && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Статус разрешения</h4>
                <p className="text-sm text-muted-foreground">
                  {permissionStatus === 'granted' ? 'Разрешено' : 
                   permissionStatus === 'denied' ? 'Отклонено' : 'Не запрошено'}
                </p>
              </div>
              
              {loading ? (
                <Skeleton className="h-10 w-[120px]" />
              ) : isEnabled ? (
                <Button 
                  variant="outline" 
                  onClick={() => removePermission()}
                  disabled={loading}
                >
                  <X className="mr-2 h-4 w-4" /> Отключить
                </Button>
              ) : (
                <Button 
                  variant="default" 
                  onClick={() => requestPermission()}
                  disabled={loading || permissionStatus === 'denied'}
                >
                  <Bell className="mr-2 h-4 w-4" /> {permissionStatus === 'denied' ? 'Запрещено в браузере' : 'Включить'}
                </Button>
              )}
            </div>
            
            {permission && (
              <div>
                <h4 className="font-medium">Информация об устройстве</h4>
                <p className="text-sm truncate text-muted-foreground">
                  ID: {permission.id}
                </p>
                <p className="text-sm text-muted-foreground">
                  Платформа: {permission.device_info.platform} / {permission.device_info.browser}
                </p>
                <p className="text-sm text-muted-foreground">
                  Создано: {new Date(permission.created_at).toLocaleString()}
                </p>
              </div>
            )}
            
            {isEnabled && (
              <div className="space-y-2">
                <h4 className="font-medium">Отправить тестовое уведомление</h4>
                <Input 
                  placeholder="Заголовок уведомления" 
                  value={notificationTitle}
                  onChange={(e) => setNotificationTitle(e.target.value)}
                  className="mb-2"
                />
                <Textarea 
                  placeholder="Текст уведомления"
                  value={notificationText}
                  onChange={(e) => setNotificationText(e.target.value)}
                  rows={3}
                  className="mb-2"
                />
                <Button 
                  className="w-full" 
                  onClick={() => sendNotification(notificationTitle, notificationText)}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Отправка...
                    </>
                  ) : (
                    <>
                      <BellRing className="mr-2 h-4 w-4" /> Отправить
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 