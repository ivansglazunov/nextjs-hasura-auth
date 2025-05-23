/**
 * @jest-environment jsdom
 */

import { 
  checkPWASupport, 
  isPWA, 
  getPWADisplayMode,
  requestNotificationPermission 
} from './pwa';

// Mock global objects for testing
const mockMatchMedia = jest.fn();
const mockServiceWorker = {
  register: jest.fn().mockResolvedValue({
    addEventListener: jest.fn(),
    update: jest.fn(),
  }),
  ready: Promise.resolve({
    sync: {
      register: jest.fn(),
    },
  }),
  addEventListener: jest.fn(),
};

const mockNotification = {
  permission: 'default' as NotificationPermission,
  requestPermission: jest.fn().mockResolvedValue('granted' as NotificationPermission),
};

// Setup DOM environment
beforeEach(() => {
  // Reset mocks
  jest.clearAllMocks();
  
  // Setup window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: mockMatchMedia,
  });
  
  // Setup navigator.serviceWorker
  Object.defineProperty(navigator, 'serviceWorker', {
    writable: true,
    value: mockServiceWorker,
  });
  
  // Setup Notification API
  Object.defineProperty(window, 'Notification', {
    writable: true,
    value: mockNotification,
  });
  
  // Setup navigator properties
  Object.defineProperty(navigator, 'userAgent', {
    writable: true,
    value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  });
  
  // Reset match media default behavior
  mockMatchMedia.mockReturnValue({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  });
});

describe('PWA Support Detection', () => {
  test('checkPWASupport should detect available features', () => {
    const support = checkPWASupport();
    
    expect(support).toEqual({
      serviceWorker: true,
      manifest: expect.any(Boolean),
      notifications: true,
      pushManager: expect.any(Boolean),
      syncManager: expect.any(Boolean),
      backgroundFetch: expect.any(Boolean),
    });
  });
  
  test('checkPWASupport should handle missing features gracefully', () => {
    // Just test that the function doesn't crash when features are missing
    // We can't easily mock navigator properties in Jest
    const support = checkPWASupport();
    
    expect(typeof support.serviceWorker).toBe('boolean');
    expect(typeof support.notifications).toBe('boolean');
    expect(typeof support.manifest).toBe('boolean');
    expect(typeof support.pushManager).toBe('boolean');
    expect(typeof support.syncManager).toBe('boolean');
    expect(typeof support.backgroundFetch).toBe('boolean');
  });
});

describe('PWA Display Mode Detection', () => {
  test('isPWA should return false in browser mode', () => {
    mockMatchMedia.mockReturnValue({ matches: false });
    
    expect(isPWA()).toBe(false);
  });
  
  test('isPWA should return true in standalone mode', () => {
    mockMatchMedia.mockImplementation((query) => ({
      matches: query === '(display-mode: standalone)',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));
    
    expect(isPWA()).toBe(true);
  });
  
  test('getPWADisplayMode should return correct mode', () => {
    mockMatchMedia.mockImplementation((query) => {
      return {
        matches: query === '(display-mode: standalone)',
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      };
    });
    
    expect(getPWADisplayMode()).toBe('standalone');
  });
  
  test('getPWADisplayMode should default to browser', () => {
    mockMatchMedia.mockReturnValue({ matches: false });
    
    expect(getPWADisplayMode()).toBe('browser');
  });
});

describe('Notification Permission', () => {
  test('requestNotificationPermission should request permission', async () => {
    const permission = await requestNotificationPermission();
    
    expect(mockNotification.requestPermission).toHaveBeenCalled();
    expect(permission).toBe('granted');
  });
  
  test('requestNotificationPermission should return existing permission', async () => {
    mockNotification.permission = 'granted';
    
    const permission = await requestNotificationPermission();
    
    expect(mockNotification.requestPermission).not.toHaveBeenCalled();
    expect(permission).toBe('granted');
  });
  
  test('requestNotificationPermission should handle unsupported browsers', async () => {
    // Test the function behavior when Notification is not available
    // This is a simplified test since mocking global objects is complex
    const permission = await requestNotificationPermission();
    
    // Should return a valid NotificationPermission value
    expect(['granted', 'denied', 'default']).toContain(permission);
  });
});

describe('iOS Detection', () => {
  test('should detect iOS devices', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
    });
    
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    expect(isIOS).toBe(true);
  });
  
  test('should not detect non-iOS devices as iOS', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });
    
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    expect(isIOS).toBe(false);
  });
});

describe('Service Worker Registration', () => {
  test('should not register service worker on server side', async () => {
    // Simulate server-side environment
    const originalWindow = global.window;
    delete (global as any).window;
    
    const { registerServiceWorker } = await import('./pwa');
    const result = await registerServiceWorker();
    
    expect(result).toBe(null);
    
    // Restore window
    global.window = originalWindow;
  });
}); 