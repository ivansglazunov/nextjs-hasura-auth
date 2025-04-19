import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCheckConnection } from './useCheckConnection';
import { checkConnection } from '../apollo';
import debug from '../../debug.js';

// Mock the apollo module
jest.mock('../apollo', () => ({
  getClient: jest.fn(),
  checkConnection: jest.fn(),
}));

// Mock debug
jest.mock('../../debug.js', () => jest.fn());

describe('useCheckConnection', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  test('should return connecting initially', async () => {
    // Delay the resolution of checkConnection
    (checkConnection as jest.Mock).mockImplementation(() => new Promise(resolve => {
      setTimeout(() => resolve(true), 100);
    }));

    const { result } = renderHook(() => useCheckConnection());

    // Initial state should be "connecting"
    expect(result.current).toBe('connecting');
  });

  test('should return connected when connection is successful', async () => {
    // Mock successful connection
    (checkConnection as jest.Mock).mockResolvedValue(true);

    const { result } = renderHook(() => useCheckConnection());

    // Wait for state to update
    await waitFor(() => {
      expect(result.current).toBe('connected');
    });
    
    expect(debug).toHaveBeenCalledWith('hooks:connection', '✅ Connected to Hasura GraphQL endpoint');
  });

  test('should return error when connection fails', async () => {
    // Mock failed connection
    (checkConnection as jest.Mock).mockResolvedValue(false);

    const { result } = renderHook(() => useCheckConnection());

    // Wait for state to update
    await waitFor(() => {
      expect(result.current).toBe('error');
    });
    
    expect(debug).toHaveBeenCalledWith('hooks:connection', '❌ Failed to connect to Hasura GraphQL endpoint');
  });

  test('should return error when connection throws', async () => {
    // Mock error
    (checkConnection as jest.Mock).mockRejectedValue(new Error('Connection error'));

    const { result } = renderHook(() => useCheckConnection());

    // Wait for state to update
    await waitFor(() => {
      expect(result.current).toBe('error');
    });
    
    expect(debug).toHaveBeenCalledWith('hooks:connection', '❌ Connection error:', expect.any(Error));
  });
}); 