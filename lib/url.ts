import Debug from './debug';

const debug = Debug('url');

export const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_MAIN_URL || process.env.NEXT_PUBLIC_BASE_URL || 'localhost:3000';

// Testing field for environment simulation in tests
declare global {
  interface URLFunction {
    _isClient?: boolean;
  }
}

/**
 * Enhanced URL formatter with protocol normalization and environment-aware secure protocol detection
 * 
 * Features:
 * - Protocol family normalization (http/https -> http, ws/wss -> ws)
 * - Environment-aware secure protocol detection (client: window.location.protocol, server: always secure)
 * - Vercel domain special handling for both HTTP and WebSocket
 * - Testing support via _isClient field
 */
export const url = (protocol: string, host: string, path: string): string => {
  debug(`Input: protocol=${protocol}, host=${host}, path=${path}`);
  
  // Step 1: Normalize protocol to base family
  const originalProtocol = protocol;
  const normalizedProtocol = normalizeProtocol(protocol);
  debug(`Protocol normalized: ${originalProtocol} → ${normalizedProtocol}`);
  
  // Step 2: Clean host and extract any existing protocol
  let cleanHost = host.replace(/^[a-z]+:\/\//, '');
  cleanHost = cleanHost.replace(/\/+$/, '');
  debug(`Host cleaned: ${host} → ${cleanHost}`);
  
  // Step 3: Determine if we need secure protocol
  const needSecure = determineSecureProtocol(cleanHost, normalizedProtocol);
  debug(`Secure protocol needed: ${needSecure}`);
  
  // Step 4: Apply secure protocol if needed
  const finalProtocol = needSecure ? makeSecureProtocol(normalizedProtocol) : normalizedProtocol;
  debug(`Final protocol: ${normalizedProtocol} → ${finalProtocol}`);
  
  // Step 5: Construct URL
  const normalizedProtocolWithColon = finalProtocol.endsWith('://') 
    ? finalProtocol 
    : finalProtocol.endsWith(':') ? `${finalProtocol}//` : `${finalProtocol}://`;
  
  try {
    // Use URL constructor for proper handling without encoding path
    const baseUrl = `${normalizedProtocolWithColon}${cleanHost}`;
    const urlObj = new globalThis.URL(baseUrl);
    
    // Handle path properly without double encoding
    // For paths with query parameters, we need to be careful not to double-encode
    if (path.startsWith('/')) {
      // Check if path contains query parameters
      if (path.includes('?')) {
        // Split path and query parts
        const [pathPart, ...queryParts] = path.split('?');
        urlObj.pathname = pathPart;
        if (queryParts.length > 0) {
          urlObj.search = '?' + queryParts.join('?');
        }
      } else {
        urlObj.pathname = path;
      }
    } else {
      // Handle relative paths
      const fullPath = urlObj.pathname === '/' ? `/${path}` : `${urlObj.pathname}/${path}`;
      if (fullPath.includes('?')) {
        const [pathPart, ...queryParts] = fullPath.split('?');
        urlObj.pathname = pathPart;
        if (queryParts.length > 0) {
          urlObj.search = '?' + queryParts.join('?');
        }
      } else {
        urlObj.pathname = fullPath;
      }
    }
    
    const result = urlObj.toString();
    debug(`Final URL: ${result}`);
    return result;
  } catch (e) {
    // Fallback for URL construction errors
    const pathWithSlash = path.startsWith('/') ? path : `/${path}`;
    const result = `${normalizedProtocolWithColon}${cleanHost}${pathWithSlash}`;
    debug(`Fallback URL: ${result}`);
    return result;
  }
};

/**
 * Normalizes protocol to base family (http/ws)
 */
function normalizeProtocol(protocol: string): string {
  const lower = protocol.toLowerCase().replace(/:?\/?\/?\s*$/, '');
  
  // HTTP family -> http
  if (['http', 'https'].includes(lower)) {
    return 'http';
  }
  
  // WebSocket family -> ws
  if (['ws', 'wss'].includes(lower)) {
    return 'ws';
  }
  
  // Unknown protocols pass through
  return lower;
}

/**
 * Determines if secure protocol should be used based on environment and domain
 */
function determineSecureProtocol(host: string, protocol: string): boolean {
  debug(`Determining secure protocol for host=${host}, protocol=${protocol}`);
  
  // Vercel domains always use secure protocols
  if (host.includes('vercel.app')) {
    debug('Vercel domain detected - forcing secure protocol');
    return true;
  }
  
  // Determine client/server environment
  // If _isClient is explicitly set (for testing), use that value
  // Otherwise, check if window is available
  const isClient = (url as any)._isClient !== undefined 
    ? !!(url as any)._isClient 
    : typeof window !== 'undefined';
  debug(`Environment: isClient=${isClient} (_isClient=${(url as any)._isClient}, hasWindow=${typeof window !== 'undefined'})`);
  
  if (isClient) {
    // Client: check window.location.protocol
    const isSecureLocation = typeof window !== 'undefined' 
      ? window.location.protocol === 'https:'
      : false;
    debug(`Client secure location: ${isSecureLocation}`);
    return isSecureLocation;
  } else {
    // Server: always assume secure
    debug('Server environment - using secure protocol');
    return true;
  }
}

/**
 * Converts base protocol to secure version
 */
function makeSecureProtocol(protocol: string): string {
  switch (protocol) {
    case 'http':
      return 'https';
    case 'ws':
      return 'wss';
    default:
      return protocol;
  }
}

// Attach testing field
(url as any)._isClient = undefined;
