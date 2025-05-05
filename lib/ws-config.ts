import Debug from './debug';

const debug = Debug('ws-config');

/**
 * Конфигурация WebSocket для корректной работы CORS
 */

// Заголовки CORS для WebSocket соединений
export const wsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400'
};

/**
 * Создает URL для WebSocket соединения, учитывая требования для различных окружений
 */
export function createWebSocketUrl(baseUrl: string): string {
  debug(`Creating WebSocket URL from base: ${baseUrl}`);
  
  // Если мы обращаемся к vercel.app, всегда используем WSS
  if (baseUrl.includes('vercel.app')) {
    const wsUrl = baseUrl.replace(/^http/, 'ws').replace(/^https/, 'wss');
    debug(`Using secure wss for Vercel domain: ${wsUrl}`);
    return wsUrl;
  }
  
  // Определение, запущено ли приложение по HTTPS
  const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  
  // Создание соответствующего WS URL
  const wsUrl = baseUrl.replace(/^http/, isSecure ? 'wss' : 'ws');
  
  debug(`Created WebSocket URL: ${wsUrl} (secure: ${isSecure})`);
  return wsUrl;
}

export default {
  wsHeaders,
  createWebSocketUrl,
}; 