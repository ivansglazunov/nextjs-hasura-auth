/**
 * Formats URL with protocol and path
 */
export const url = (protocol: string, url: string, path: string): string => {
  // Normalize protocol (ensure it ends with "://")
  const normalizedProtocol = protocol.endsWith('://') 
    ? protocol 
    : protocol.endsWith(':') ? `${protocol}/` : `${protocol}://`;
  
  // Remove any protocol from url if present
  let cleanUrl = url.replace(/^[a-z]+:\/\//, '');
  
  // Remove trailing slashes from url
  cleanUrl = cleanUrl.replace(/\/+$/, '');
  
  // Create a base URL with the normalized protocol and cleaned URL
  try {
    // Use a dummy protocol if none provided to make URL parsing work
    const urlObj = new globalThis.URL(`${normalizedProtocol}${cleanUrl}`);
    
    // Handle the path - ensure proper joining with the base URL
    if (path.startsWith('/')) {
      // If path starts with /, it replaces the pathname
      urlObj.pathname = path;
    } else {
      // Otherwise, join it to the current path ensuring a / separator
      urlObj.pathname = urlObj.pathname === '/' ? `/${path}` : `${urlObj.pathname}/${path}`;
    }
    
    // Return the full URL
    return urlObj.toString();
  } catch (e) {
    // Fallback in case URL parsing fails
    const pathWithSlash = path.startsWith('/') ? path : `/${path}`;
    return `${normalizedProtocol}${cleanUrl}${pathWithSlash}`;
  }
};

export default url;
