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
    const { createClient, getClient } = require('./dist/lib/apollo');
    
    expect(createClient).toBeDefined();
    expect(typeof createClient).toBe('function');
    
    expect(getClient).toBeDefined();
    expect(typeof getClient).toBe('function');
  });

  test('should create a working client from the built module', () => {
    // Import from the built dist directory
    const { createClient } = require('./dist/lib/apollo');
    
    const client = createClient();
    expect(client).toBeDefined();
    expect(client.query).toBeDefined();
    expect(typeof client.query).toBe('function');
  });
}); 