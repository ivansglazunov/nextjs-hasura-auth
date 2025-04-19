import React from 'react';
import { render, screen } from '@/lib/test-utils';
import { HasuraCard } from './card';
import { useCheckConnection } from '@/lib/hooks/useCheckConnection';

// Mock the useCheckConnection hook
jest.mock('@/lib/hooks/useCheckConnection');

describe('HasuraCard component', () => {
  beforeEach(() => {
    // Reset mock before each test
    jest.clearAllMocks();
  });

  test('renders with connecting status', () => {
    // Mock the hook to return 'connecting'
    (useCheckConnection as jest.Mock).mockReturnValue('connecting');
    
    render(<HasuraCard />);
    
    // Should show Hasura title
    expect(screen.getByText('Hasura')).toBeInTheDocument();
    
    // Should show Connecting status
    expect(screen.getAllByText('Connecting').length).toBeGreaterThan(0);
  });

  test('renders with connected status', () => {
    // Mock the hook to return 'connected'
    (useCheckConnection as jest.Mock).mockReturnValue('connected');
    
    render(<HasuraCard />);
    
    // Should show Connected status
    expect(screen.getAllByText('Connected').length).toBeGreaterThan(0);
  });

  test('renders with error status', () => {
    // Mock the hook to return 'error'
    (useCheckConnection as jest.Mock).mockReturnValue('error');
    
    render(<HasuraCard />);
    
    // Should show Error status
    expect(screen.getAllByText('Error').length).toBeGreaterThan(0);
  });

  test('highlights missing environment variables', () => {
    // Mock the hook
    (useCheckConnection as jest.Mock).mockReturnValue('connected');
    
    // Save the original env value
    const originalEnv = process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL;
    
    // Mock missing env variable
    process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL = '';
    
    render(<HasuraCard />);
    
    // Input should have error class
    const input = screen.getByLabelText('NEXT_PUBLIC_HASURA_GRAPHQL_URL');
    expect(input).toHaveClass('border-red-700');
    
    // Restore original value
    process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL = originalEnv;
  });
}); 