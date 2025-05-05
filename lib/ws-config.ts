import Debug from './debug';

const debug = Debug('ws-config');

/**
 * WebSocket configuration for proper CORS support
 */

// CORS headers for WebSocket connections
export const wsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400'
};

/**
 * Creates a URL for WebSocket connection, considering requirements for different environments
 */
export function createWebSocketUrl(baseUrl: string): string {
  debug(`Creating WebSocket URL from base: ${baseUrl}`);
  
  // If we're accessing vercel.app, always use WSS
  if (baseUrl.includes('vercel.app')) {
    const wsUrl = baseUrl.replace(/^http/, 'ws').replace(/^https/, 'wss');
    debug(`Using secure wss for Vercel domain: ${wsUrl}`);
    return wsUrl;
  }
  
  // Determine if the application is running over HTTPS
  const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  
  // Create the appropriate WS URL
  const wsUrl = baseUrl.replace(/^http/, isSecure ? 'wss' : 'ws');
  
  debug(`Created WebSocket URL: ${wsUrl} (secure: ${isSecure})`);
  return wsUrl;
}

export default {
  wsHeaders,
  createWebSocketUrl,
}; 