'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Debug from 'hasyx/lib/debug';
import { API_URL } from 'hasyx/lib/url';

const debug = Debug('auth:callback-page');
const AUTH_TOKEN_KEY = 'hasyx_auth_token'; // Ключ для localStorage

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessionAndStoreToken = async () => {
      debug('AuthCallbackPage mounted. Fetching session from API...');
      // Определяем URL для запроса сессии
      const sessionUrl = new URL('/api/auth/session', API_URL).toString();
      debug('Session URL:', sessionUrl);
      
      try {
        const response = await fetch(sessionUrl, {
          credentials: 'include', // ВАЖНО: для отправки cookie, установленных на домене API
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch session: ${response.status} ${response.statusText}`);
        }

        const sessionData = await response.json();
        debug('Session data received:', sessionData);

        if (sessionData && sessionData.accessToken) {
          debug('Access token found in session data. Storing in localStorage...');
          localStorage.setItem(AUTH_TOKEN_KEY, sessionData.accessToken);
          setStatus('success');
          
          // Перенаправляем на сохраненный URL или на главную
          const preAuthUrl = sessionStorage.getItem('preAuthUrl') || '/';
          sessionStorage.removeItem('preAuthUrl'); // Очищаем сохраненный URL
          debug('Redirecting to:', preAuthUrl);
          window.location.href = preAuthUrl;
        } else {
          // Ситуация, когда сессия есть, но токена нет (маловероятно с JWT, но возможно)
          // Или когда сессии нет вообще
          debug('No access token found in session data or no session active.');
          throw new Error('Authentication failed: No active session or token found after callback.');
        }
      } catch (err: any) {
        debug('Error fetching session or storing token:', err);
        setError(err.message || 'An unknown error occurred during authentication callback.');
        setStatus('error');
        // Опционально: можно перенаправить на страницу ошибки или показать сообщение
        // window.location.href = '/auth/error?error=CallbackFetchFailed';
      }
    };

    fetchSessionAndStoreToken();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      {status === 'loading' && (
        <>
          <Loader2 className="h-12 w-12 animate-spin mb-4" />
          <p className="text-lg text-muted-foreground">Completing authentication...</p>
        </>
      )}
      {status === 'error' && (
        <>
          <p className="text-lg text-red-600 mb-4">Authentication Error</p>
          <p className="text-muted-foreground mb-4">{error}</p>
          <p className="text-sm text-muted-foreground">You can try returning to the <a href="/" className="underline">homepage</a>.</p>
        </>
      )}
      {/* Статус success не отображается, т.к. происходит редирект */}
    </div>
  );
} 