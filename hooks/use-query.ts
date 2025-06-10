'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type QueryState<T = any> = {
  [key: string]: T;
};

type SetterFunction<T> = (value: T | ((prev: T) => T)) => void;

// Global store for query states
const queryStores = new Map<string, {
  subscribers: Set<() => void>;
  getValue: () => any;
  setValue: (value: any) => void;
}>();

// Storage interface for URL parameters
const urlStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get(key);
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (value === null || value === undefined || value === '') {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
    }
    window.history.replaceState({}, '', url.toString());
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.delete(key);
    window.history.replaceState({}, '', url.toString());
  }
};

// Create a query hook factory
export function createQuery<T = string>(key: string, defaultValue?: T) {
  // Parse value from URL
  const parseValue = (rawValue: string | null): T => {
    if (rawValue === null) return defaultValue as T;
    
    try {
      // Try to parse as JSON first
      return JSON.parse(rawValue);
    } catch {
      // If not JSON, return as string (or the raw value)
      return rawValue as T;
    }
  };

  // Serialize value for URL
  const serializeValue = (value: T): string => {
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  };

  // Initialize store for this key if it doesn't exist
  if (!queryStores.has(key)) {
    const subscribers = new Set<() => void>();
    
    queryStores.set(key, {
      subscribers,
      getValue: () => parseValue(urlStorage.getItem(key)),
      setValue: (value: T) => {
        if (value === null || value === undefined) {
          urlStorage.removeItem(key);
        } else {
          urlStorage.setItem(key, serializeValue(value));
        }
        // Notify all subscribers
        subscribers.forEach(callback => callback());
      }
    });
  }

  // Return the hook function
  return function useQuery(): [T, SetterFunction<T>] {
    const store = queryStores.get(key)!;
    const [value, setValue] = useState<T>(() => store.getValue());

    // Subscribe to changes
    useEffect(() => {
      const updateValue = () => {
        setValue(store.getValue());
      };

      store.subscribers.add(updateValue);

      // Also listen to popstate for browser back/forward
      const handlePopState = () => {
        updateValue();
      };
      
      window.addEventListener('popstate', handlePopState);

      return () => {
        store.subscribers.delete(updateValue);
        window.removeEventListener('popstate', handlePopState);
      };
    }, [store]);

    // Setter function
    const setter = useCallback<SetterFunction<T>>((newValue) => {
      const valueToSet = typeof newValue === 'function' 
        ? (newValue as (prev: T) => T)(store.getValue()) 
        : newValue;
      
      store.setValue(valueToSet);
    }, [store]);

    return [value, setter];
  };
}

// Convenience hook for creating multiple queries at once
export function createQueries<T extends Record<string, any>>(
  schema: { [K in keyof T]: { key: string; defaultValue?: T[K] } }
) {
  const hooks = {} as {
    [K in keyof T]: () => [T[K], SetterFunction<T[K]>]
  };

  for (const [name, config] of Object.entries(schema)) {
    hooks[name as keyof T] = createQuery(config.key, config.defaultValue);
  }

  return hooks;
}

// Simple utility hook for single string values
export const useQueryString = (key: string, defaultValue = '') => {
  return createQuery<string>(key, defaultValue)();
};

// Utility hook for boolean values
export const useQueryBoolean = (key: string, defaultValue = false) => {
  return createQuery<boolean>(key, defaultValue)();
};

// Utility hook for number values
export const useQueryNumber = (key: string, defaultValue = 0) => {
  return createQuery<number>(key, defaultValue)();
};

// Utility hook for object/array values
export const useQueryObject = <T = any>(key: string, defaultValue?: T) => {
  return createQuery<T>(key, defaultValue)();
}; 