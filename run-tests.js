// run-tests.js
const { execSync } = require('child_process');

console.log('🧪 Running tests with properly configured environment...');

try {
  // Run tests with appropriate environment variables
  process.env.NODE_ENV = 'test';
  process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL = process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL || 'http://localhost:8080/v1/graphql';
  process.env.HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET || 'test-admin-secret';
  process.env.HASURA_JWT_SECRET = process.env.HASURA_JWT_SECRET || '{"type":"HS256","key":"test-secret-key"}';
  
  console.log('🔍 Running with test environment variables:');
  console.log('- NEXT_PUBLIC_HASURA_GRAPHQL_URL:', process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL);
  console.log('- HASURA_ADMIN_SECRET:', '[HIDDEN]');
  console.log('- HASURA_JWT_SECRET:', '[HIDDEN]');
  
  // Execute tests with Jest
  execSync('npm test', { stdio: 'inherit' });
  
  console.log('✅ Tests completed successfully!');
} catch (error) {
  console.error('❌ Tests failed:', error.message);
  process.exit(1);
} 