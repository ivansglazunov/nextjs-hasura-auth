'use client';

import { useEffect } from 'react';
import Debug from './debug';

const debug = Debug('auth:token-handler');
const AUTH_TOKEN_KEY = 'hasyx_auth_token'; // Key for localStorage

/**
 * Client component that checks URL for 'auth_token' parameter when mounted,
 * saves it to localStorage and cleans the URL.
 */
export function AuthTokenHandler() {
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('auth_token');

    if (tokenFromUrl) {
      debug('AuthTokenHandler: Found auth_token in URL.');
      localStorage.setItem(AUTH_TOKEN_KEY, tokenFromUrl);
      // Clean token from URL, preserving hash if present
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);
      debug('AuthTokenHandler: Token stored and URL cleaned.');
      // Can add forced update of Apollo Client state,
      // if necessary for immediate token usage.
      // For example, through Apollo Client cache reinitialization or refetchQueries.
    }
  }, []); // Run only once when mounting

  // This component doesn't render anything
  return null;
} 