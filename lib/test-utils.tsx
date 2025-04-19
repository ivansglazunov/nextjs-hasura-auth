import React, { ReactElement } from 'react';
import { render, RenderOptions, screen } from '@testing-library/react';
import { ApolloProvider, ApolloClient, InMemoryCache } from '@apollo/client';
import { createClient } from './apollo';

// Create a mock Apollo client for testing
const createMockClient = () => {
  return new ApolloClient({
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'no-cache',
      },
      query: {
        fetchPolicy: 'no-cache',
      },
    },
  });
};

/**
 * Custom renderer that wraps the component with necessary providers
 */
const customRender = (
  ui: ReactElement,
  {
    apolloClient = createMockClient(),
    ...renderOptions
  } = {}
) => {
  const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
    return (
      <ApolloProvider client={apolloClient}>
        {children}
      </ApolloProvider>
    );
  };
  
  return render(ui, { wrapper: AllTheProviders, ...renderOptions });
};

// re-export everything from testing-library
export * from '@testing-library/react';

// override render method
export { customRender as render, screen }; 