import { describe, test, expect, beforeAll } from '@jest/globals';
import { execSync } from 'child_process';
import { join } from 'path';
import dotenv from 'dotenv';

// Load .env for the test
dotenv.config();

describe('Apollo client build', () => {
  beforeAll(() => {
    // Build the library
    execSync('npm run build:lib', { stdio: 'inherit' });
  });

  test('should be able to import the built Apollo client', () => {
    // Import from the built dist directory
    const { createApolloClient, getClient } = require('./dist/lib/apollo');
    
    expect(createApolloClient).toBeDefined();
    expect(typeof createApolloClient).toBe('function');
    
    expect(getClient).toBeDefined();
    expect(typeof getClient).toBe('function');
  });

  test('should create a working client from the built module', () => {
    // Import from the built dist directory
    const { createApolloClient } = require('./dist/lib/apollo');
    
    const client = createApolloClient();
    expect(client).toBeDefined();
    expect(client.query).toBeDefined();
    expect(typeof client.query).toBe('function');
  });
}); 