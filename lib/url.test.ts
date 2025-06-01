import Debug from './debug';
import { url, API_URL } from './url';

const debug = Debug('test:url');

// Experimental DEBUG tests - temporary exploration
describe('DEBUG: Enhanced URL Function Testing', () => {
  beforeEach(() => {
    // Reset testing field before each test
    (url as any)._isClient = undefined;
  });

  it('should test enhanced protocol normalization', () => {
    debug('=== TESTING ENHANCED PROTOCOL NORMALIZATION ===');
    
    const testCases = [
      // HTTP family
      { protocol: 'http', host: 'example.com', path: '/test', expectStart: 'http' },
      { protocol: 'https', host: 'example.com', path: '/test', expectStart: 'http' },
      { protocol: 'HTTP', host: 'example.com', path: '/test', expectStart: 'http' },
      { protocol: 'HTTPS', host: 'example.com', path: '/test', expectStart: 'http' },
      
      // WebSocket family  
      { protocol: 'ws', host: 'example.com', path: '/test', expectStart: 'ws' },
      { protocol: 'wss', host: 'example.com', path: '/test', expectStart: 'ws' },
      { protocol: 'WS', host: 'example.com', path: '/test', expectStart: 'ws' },
      { protocol: 'WSS', host: 'example.com', path: '/test', expectStart: 'ws' },
    ];
    
    // Test with client environment (non-secure)
    (url as any)._isClient = true;
    Object.defineProperty(global, 'window', {
      value: { location: { protocol: 'http:' } },
      writable: true
    });
    
    testCases.forEach(({ protocol, host, path, expectStart }) => {
      const result = url(protocol, host, path);
      debug(`Protocol: ${protocol} -> Result: ${result} (should start with ${expectStart})`);
      
      // Protocol should be normalized to base family in non-secure environment
      if (expectStart === 'http') {
        expect(result).toMatch(/^http:\/\//);
      } else if (expectStart === 'ws') {
        expect(result).toMatch(/^ws:\/\//);
      }
    });
  });

  it('should test secure protocol detection', () => {
    debug('=== TESTING SECURE PROTOCOL DETECTION ===');
    
    // Test server environment (always secure) - key fix: set BEFORE calling url()
    debug('Testing server environment...');
    (url as any)._isClient = false;
    delete (global as any).window;  // Ensure no window
    
    const serverResults = {
      http: url('http', 'example.com', '/test'),
      ws: url('ws', 'example.com', '/test'),
    };
    
    debug(`Server environment - HTTP: ${serverResults.http}`);
    debug(`Server environment - WS: ${serverResults.ws}`);
    
    expect(serverResults.http).toMatch(/^https:\/\//);
    expect(serverResults.ws).toMatch(/^wss:\/\//);
    
    // Test client environment with HTTPS
    debug('Testing client HTTPS environment...');
    (url as any)._isClient = true;
    Object.defineProperty(global, 'window', {
      value: { location: { protocol: 'https:' } },
      writable: true
    });
    
    const clientSecureResults = {
      http: url('http', 'example.com', '/test'),
      ws: url('ws', 'example.com', '/test'),
    };
    
    debug(`Client HTTPS - HTTP: ${clientSecureResults.http}`);
    debug(`Client HTTPS - WS: ${clientSecureResults.ws}`);
    
    expect(clientSecureResults.http).toMatch(/^https:\/\//);
    expect(clientSecureResults.ws).toMatch(/^wss:\/\//);
    
    // Test client environment with HTTP
    debug('Testing client HTTP environment...');
    Object.defineProperty(global, 'window', {
      value: { location: { protocol: 'http:' } },
      writable: true
    });
    
    const clientInsecureResults = {
      http: url('http', 'example.com', '/test'),
      ws: url('ws', 'example.com', '/test'),
    };
    
    debug(`Client HTTP - HTTP: ${clientInsecureResults.http}`);
    debug(`Client HTTP - WS: ${clientInsecureResults.ws}`);
    
    expect(clientInsecureResults.http).toMatch(/^http:\/\//);
    expect(clientInsecureResults.ws).toMatch(/^ws:\/\//);
  });

  it('should test Vercel domain handling', () => {
    debug('=== TESTING VERCEL DOMAIN HANDLING ===');
    
    // Test in non-secure client environment
    (url as any)._isClient = true;
    Object.defineProperty(global, 'window', {
      value: { location: { protocol: 'http:' } },
      writable: true
    });
    
    const vercelTests = [
      { protocol: 'http', host: 'myapp.vercel.app', path: '/api', expected: 'https' },
      { protocol: 'ws', host: 'myapp.vercel.app', path: '/api', expected: 'wss' },
      { protocol: 'https', host: 'another.vercel.app', path: '/test', expected: 'https' },
      { protocol: 'wss', host: 'test.vercel.app', path: '/ws', expected: 'wss' },
    ];
    
    vercelTests.forEach(({ protocol, host, path, expected }) => {
      const result = url(protocol, host, path);
      debug(`Vercel test - Protocol: ${protocol}, Host: ${host} -> Result: ${result}`);
      expect(result).toMatch(new RegExp(`^${expected}://`));
    });
  });

  it('should test environment simulation via _isClient', () => {
    debug('=== TESTING _isClient SIMULATION ===');
    
    // Simulate server environment - key fix: set before calling url()
    debug('Simulating server environment...');
    (url as any)._isClient = false;
    delete (global as any).window;
    
    const serverResult = url('http', 'example.com', '/test');
    debug(`Simulated server: ${serverResult}`);
    expect(serverResult).toMatch(/^https:\/\//);
    
    // Simulate client environment  
    debug('Simulating client environment...');
    (url as any)._isClient = true;
    // Without window.location, should not be secure
    delete (global as any).window;
    
    const clientResult = url('http', 'example.com', '/test');
    debug(`Simulated client (no window): ${clientResult}`);
    expect(clientResult).toMatch(/^http:\/\//);
  });

  it('should debug environment detection logic', () => {
    debug('=== DEBUGGING ENVIRONMENT DETECTION ===');
    
    // Test various scenarios to understand behavior
    const scenarios = [
      { name: 'Real environment', setup: () => { (url as any)._isClient = undefined; } },
      { name: 'Forced server', setup: () => { (url as any)._isClient = false; } },
      { name: 'Forced client', setup: () => { (url as any)._isClient = true; } },
    ];
    
    scenarios.forEach(scenario => {
      debug(`--- ${scenario.name} ---`);
      scenario.setup();
      
      const hasWindow = typeof window !== 'undefined';
      const isClientField = (url as any)._isClient;
      const isClientDetected = typeof window !== 'undefined' || !!(url as any)._isClient;
      
      debug(`  typeof window: ${typeof window}`);
      debug(`  hasWindow: ${hasWindow}`);
      debug(`  _isClient field: ${isClientField}`);
      debug(`  isClient detected: ${isClientDetected}`);
      
      const result = url('http', 'example.com', '/test');
      debug(`  URL result: ${result}`);
    });
  });
});

// Main test suite
describe('Enhanced URL Function', () => {
  beforeEach(() => {
    // Reset testing field before each test
    (url as any)._isClient = undefined;
    // Clean global window
    delete (global as any).window;
  });

  describe('Protocol Normalization', () => {
    it('should normalize HTTP family protocols to http base', () => {
      // Test in non-secure environment to see base normalization
      (url as any)._isClient = true;
      
      expect(url('http', 'example.com', '/path')).toMatch(/^http:/);
      expect(url('https', 'example.com', '/path')).toMatch(/^http:/);
      expect(url('HTTP', 'example.com', '/path')).toMatch(/^http:/);
      expect(url('HTTPS', 'example.com', '/path')).toMatch(/^http:/);
    });

    it('should normalize WebSocket family protocols to ws base', () => {
      // Test in non-secure environment to see base normalization  
      (url as any)._isClient = true;
      
      expect(url('ws', 'example.com', '/path')).toMatch(/^ws:/);
      expect(url('wss', 'example.com', '/path')).toMatch(/^ws:/);
      expect(url('WS', 'example.com', '/path')).toMatch(/^ws:/);
      expect(url('WSS', 'example.com', '/path')).toMatch(/^ws:/);
    });
  });

  describe('Environment-Based Secure Protocol Detection', () => {
    it('should use secure protocols in server environment', () => {
      (url as any)._isClient = false;
      
      const httpResult = url('http', 'example.com', '/path');
      const wsResult = url('ws', 'example.com', '/path');
      
      expect(httpResult).toBe('https://example.com/path');
      expect(wsResult).toBe('wss://example.com/path');
    });

    it('should detect secure client environment', () => {
      (url as any)._isClient = true;
      Object.defineProperty(global, 'window', {
        value: { location: { protocol: 'https:' } },
        writable: true
      });
      
      const httpResult = url('http', 'example.com', '/path');
      const wsResult = url('ws', 'example.com', '/path');
      
      expect(httpResult).toBe('https://example.com/path');
      expect(wsResult).toBe('wss://example.com/path');
    });

    it('should detect insecure client environment', () => {
      (url as any)._isClient = true;
      Object.defineProperty(global, 'window', {
        value: { location: { protocol: 'http:' } },
        writable: true
      });
      
      const httpResult = url('http', 'example.com', '/path');
      const wsResult = url('ws', 'example.com', '/path');
      
      expect(httpResult).toBe('http://example.com/path');
      expect(wsResult).toBe('ws://example.com/path');
    });
  });

  describe('Vercel Domain Handling', () => {
    it('should force secure protocols for Vercel domains', () => {
      // Even in insecure client environment
      (url as any)._isClient = true;
      Object.defineProperty(global, 'window', {
        value: { location: { protocol: 'http:' } },
        writable: true
      });
      
      const httpResult = url('http', 'myapp.vercel.app', '/api');
      const wsResult = url('ws', 'test.vercel.app', '/socket');
      
      expect(httpResult).toBe('https://myapp.vercel.app/api');
      expect(wsResult).toBe('wss://test.vercel.app/socket');
    });
  });

  describe('Backward Compatibility', () => {
    it('should handle basic HTTP URLs', () => {
      const result = url('http', 'example.com', '/path');
      expect(result).toContain('example.com/path');
    });

    it('should handle protocols with colons', () => {
      const result = url('http:', 'example.com', '/path');
      expect(result).toContain('example.com/path');
    });

    it('should handle protocols with ://', () => {
      const result = url('https://', 'example.com', '/path');
      expect(result).toContain('example.com/path');
    });

    it('should remove protocol from host', () => {
      const result = url('http', 'https://example.com', '/path');
      expect(result).toContain('example.com/path');
    });

    it('should handle paths without leading slash', () => {
      const result = url('http', 'example.com', 'path');
      expect(result).toContain('example.com/path');
    });

    it('should handle paths with leading slash', () => {
      const result = url('http', 'example.com', '/path');
      expect(result).toContain('example.com/path');
    });

    it('should remove trailing slashes from host', () => {
      const result = url('http', 'example.com/', '/path');
      expect(result).toContain('example.com/path');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty path', () => {
      const result = url('http', 'example.com', '');
      expect(result).toMatch(/example\.com\/$/);
    });

    it('should handle complex paths with query parameters', () => {
      const result = url('http', 'example.com', '/api/v1/users?id=123');
      expect(result).toContain('/api/v1/users?id=123');
      // Should not double-encode
      expect(result).not.toContain('%3F');
    });

    it('should handle ports in host', () => {
      const result = url('http', 'localhost:3000', '/api');
      expect(result).toContain('localhost:3000/api');
    });

    it('should handle IP addresses', () => {
      const result = url('http', '192.168.1.1:8080', '/test');
      expect(result).toContain('192.168.1.1:8080/test');
    });
  });

  describe('WebSocket Integration', () => {
    it('should create proper WebSocket URLs', () => {
      // Test in insecure environment
      (url as any)._isClient = true;
      Object.defineProperty(global, 'window', {
        value: { location: { protocol: 'http:' } },
        writable: true
      });
      
      const wsResult = url('ws', 'example.com', '/api');
      expect(wsResult).toBe('ws://example.com/api');
      
      const wssResult = url('wss', 'example.com', '/api');
      expect(wssResult).toBe('ws://example.com/api'); // normalized to base
    });

    it('should upgrade WebSocket protocols in secure environment', () => {
      (url as any)._isClient = false; // server
      
      const wsResult = url('ws', 'example.com', '/api');
      const wssResult = url('wss', 'example.com', '/api');
      
      expect(wsResult).toBe('wss://example.com/api');
      expect(wssResult).toBe('wss://example.com/api');
    });
  });
}); 