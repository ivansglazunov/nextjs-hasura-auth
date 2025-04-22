import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { describe, beforeAll, test, expect } from '@jest/globals';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

describe('Build process', () => {
  beforeAll(() => {
    // Run only the lib build process
    execSync('npm run build:lib', { stdio: 'inherit' });
  });

  test('should build lib to dist folder', () => {
    // Check if dist folder exists with the compiled files
    expect(existsSync(join(process.cwd()))).toBe(true);
    expect(existsSync(join(process.cwd(), 'lib'))).toBe(true);
    expect(existsSync(join(process.cwd(), 'lib', 'index.js'))).toBe(true);
    expect(existsSync(join(process.cwd(), 'lib', 'index.d.ts'))).toBe(true);
    
    // Check if Apollo client was built
    expect(existsSync(join(process.cwd(), 'lib', 'apollo.js'))).toBe(true);
    expect(existsSync(join(process.cwd(), 'lib', 'apollo.d.ts'))).toBe(true);
  });

  test('should be able to import Apollo client from built library', () => {
    // Import Apollo client specifically
    const apollo = require(join(process.cwd(), 'lib', 'apollo.js'));
    expect(apollo.createApolloClient).toBeDefined();
    expect(typeof apollo.createApolloClient).toBe('function');
    expect(apollo.getClient).toBeDefined();
    expect(typeof apollo.getClient).toBe('function');
  });

  test('should create a working Apollo client from built library', () => {
    const { createApolloClient } = require('./lib/apollo');
    const client = createApolloClient();
    expect(client).toBeDefined();
    expect(client.query).toBeDefined();
  });
}); 