'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "hasyx/components/ui/card";
import { Button } from "hasyx/components/ui/button";
import { Badge } from "hasyx/components/ui/badge";
import { useSubscription } from 'hasyx';
import { Loader2, RefreshCw, Bug, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface DebugLog {
  id: string;
  value: any;
  created_at: string;
}

const getActionIcon = (action: string) => {
  switch (action) {
    case 'telegram_auth_success':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'telegram_auth_error':
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Bug className="h-4 w-4 text-blue-500" />;
  }
};

const getActionColor = (action: string) => {
  switch (action) {
    case 'telegram_auth_success':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'telegram_auth_error':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'telegram_auth_hash_verification':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  }
};

export function TelegramDebugCard() {
  const [limit, setLimit] = useState(10);
  
  const { 
    data, 
    loading, 
    error
  } = useSubscription<{ debug: DebugLog[] }>(
    {
      table: 'debug',
      where: {
        value: {
          _has_key: 'action'
        }
      },
      returning: ['id', 'value', 'created_at'],
      order_by: [{ created_at: 'desc' }],
      limit
    },
    {
      role: 'me'
    }
  );

  const debugLogs = data?.debug || [];
  const telegramLogs = debugLogs.filter(log => 
    log.value?.action && log.value.action.includes('telegram_auth')
  );

  const handleRefresh = () => {
    // Since useSubscription updates automatically, we can just trigger a state update
    // to cause a re-render which will show the latest data
    setLimit(current => current);
  };

  const handleLoadMore = () => {
    setLimit(prev => prev + 10);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5" />
              Telegram Debug Logs
            </CardTitle>
            <CardDescription>
              Диагностические логи авторизации через Telegram из базы данных
            </CardDescription>
          </div>
          <Button 
            onClick={handleRefresh} 
            variant="outline" 
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && telegramLogs.length === 0 && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Загружаем логи...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center p-3 rounded-lg bg-red-50 text-red-800 dark:bg-red-900 dark:text-red-200">
            <AlertCircle className="h-4 w-4 mr-2" />
            <span>Ошибка загрузки логов: {error.message}</span>
          </div>
        )}

        {!loading && !error && telegramLogs.length === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            Логи Telegram авторизации не найдены
          </div>
        )}

        {telegramLogs.length > 0 && (
          <div className="space-y-3">
            {telegramLogs.map((log) => {
              const logData = log.value || {};
              const action = logData.action || 'unknown';
              const timestamp = logData.timestamp || log.created_at;
              
              return (
                <div 
                  key={log.id} 
                  className="border rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getActionIcon(action)}
                      <Badge className={getActionColor(action)}>
                        {action.replace('telegram_auth_', '').replace('_', ' ')}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(timestamp), { 
                        addSuffix: true, 
                        locale: ru 
                      })}
                    </span>
                  </div>
                  
                  <div className="text-sm">
                    {logData.error && (
                      <div className="text-red-600 dark:text-red-400 font-medium">
                        Ошибка: {logData.error}
                      </div>
                    )}
                    
                    {logData.credentials && (
                      <div className="mt-1">
                        <span className="font-medium">Credentials:</span>
                        <div className="ml-2 text-xs">
                          ID: {logData.credentials.id}, 
                          Name: {logData.credentials.first_name}, 
                          Hash: {logData.credentials.has_hash ? '✓' : '✗'}
                        </div>
                      </div>
                    )}
                    
                    {logData.verification && (
                      <div className="mt-1">
                        <span className="font-medium">Verification:</span>
                        <div className="ml-2 text-xs">
                          {logData.verification.match !== undefined && (
                            <span className={logData.verification.match ? 'text-green-600' : 'text-red-600'}>
                              Hash Match: {logData.verification.match ? '✓' : '✗'}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {logData.user && (
                      <div className="mt-1">
                        <span className="font-medium">User:</span>
                        <div className="ml-2 text-xs">
                          ID: {logData.user.id}, Name: {logData.user.name}
                        </div>
                      </div>
                    )}
                    
                    {logData.dbUserId && (
                      <div className="mt-1">
                        <span className="font-medium">DB User ID:</span>
                        <span className="ml-2 text-xs font-mono">{logData.dbUserId}</span>
                      </div>
                    )}
                    
                    {logData.errorMessage && (
                      <div className="mt-1">
                        <span className="font-medium">Error Message:</span>
                        <div className="ml-2 text-xs text-red-600 dark:text-red-400">
                          {logData.errorMessage}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      Показать полные данные
                    </summary>
                    <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                      {JSON.stringify(logData, null, 2)}
                    </pre>
                  </details>
                </div>
              );
            })}
            
            {debugLogs.length >= limit && (
              <div className="text-center">
                <Button 
                  onClick={handleLoadMore} 
                  variant="outline" 
                  size="sm"
                  disabled={loading}
                >
                  Загрузить еще
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 