'use client';

import { useEffect } from 'react';
import Debug from './debug';

const debug = Debug('auth:token-handler');
const AUTH_TOKEN_KEY = 'hasyx_auth_token'; // Ключ для localStorage

/**
 * Клиентский компонент, который при монтировании проверяет URL
 * на наличие параметра 'auth_token', сохраняет его в localStorage
 * и очищает URL.
 */
export function AuthTokenHandler() {
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('auth_token');

    if (tokenFromUrl) {
      debug('AuthTokenHandler: Found auth_token in URL.');
      localStorage.setItem(AUTH_TOKEN_KEY, tokenFromUrl);
      // Очищаем URL от токена, сохраняя хэш, если он есть
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);
      debug('AuthTokenHandler: Token stored and URL cleaned.');
      // Можно добавить принудительное обновление состояния Apollo Client,
      // если это необходимо для немедленного подхвата токена.
      // Например, через Apollo Client cache reinitialization или refetchQueries.
    }
  }, []); // Запускаем только один раз при монтировании

  // Этот компонент ничего не рендерит
  return null;
} 