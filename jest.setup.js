// This file is used for Jest test setup

import { TextEncoder, TextDecoder } from 'util';

// Add TextEncoder and TextDecoder for jose library
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Mock React components for tests
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  createElement: jest.fn().mockImplementation((type, props, ...children) => ({
    type, props, children
  })),
}));

// Mock ApolloProvider and other React components
jest.mock('@apollo/client', () => {
  const originalModule = jest.requireActual('@apollo/client');
  return {
    ...originalModule,
    ApolloProvider: ({ children }) => children,
  };
});
