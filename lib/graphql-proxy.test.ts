import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

describe('[DEBUG] closeConnections validation', () => {
  it('should handle invalid WebSocket close codes correctly', () => {
    // Mock WebSocket objects
    const mockClient = {
      readyState: 1, // OPEN
      close: jest.fn()
    };
    
    const mockHasuraWs = {
      readyState: 1, // OPEN  
      close: jest.fn()
    };
    
    // Simulate the closeConnections function logic
    const closeConnections = (code: number | string = 1000, reason = 'Closing connection') => {
      let closeCode: number;
      
      if (typeof code === 'number') {
        // Validate that the code is in the valid range for WebSocket close codes
        if (code >= 1000 && code <= 4999) {
          closeCode = code;
        } else {
          closeCode = 1000; // Default close code for normal closure
        }
      } else if (typeof code === 'string') {
        const parsedCode = parseInt(code, 10);
        if (!isNaN(parsedCode) && parsedCode >= 1000 && parsedCode <= 4999) {
          closeCode = parsedCode;
        } else {
          closeCode = 1000; // Default close code for normal closure
        }
      } else {
        closeCode = 1000; // Default close code for normal closure
      }
      
      const closeReason = typeof reason === 'string' ? reason : 'Closing connection';
      
      mockClient.close(closeCode, closeReason);
      mockHasuraWs.close(closeCode, closeReason);
      
      return { closeCode, closeReason };
    };
    
    // Test various invalid codes
    const testCases = [
      { input: undefined, expected: 1000 },
      { input: null, expected: 1000 },
      { input: 'invalid', expected: 1000 },
      { input: 999, expected: 1000 }, // Below valid range
      { input: 5000, expected: 1000 }, // Above valid range
      { input: 1001, expected: 1001 }, // Valid code
      { input: '1002', expected: 1002 }, // Valid string code
      { input: '999', expected: 1000 }, // Invalid string code
      { input: 'abc', expected: 1000 }, // Non-numeric string
    ];
    
    testCases.forEach(({ input, expected }) => {
      jest.clearAllMocks();
      const result = closeConnections(input as any, 'test reason');
      
      expect(result.closeCode).toBe(expected);
      expect(mockClient.close).toHaveBeenCalledWith(expected, 'test reason');
      expect(mockHasuraWs.close).toHaveBeenCalledWith(expected, 'test reason');
    });
  });
}); 