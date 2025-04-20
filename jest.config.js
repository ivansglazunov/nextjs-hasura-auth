/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  setupFilesAfterEnv: ['./jest.setup.js'],
  moduleNameMapper: {
    '^jose$': require.resolve('jose'),
    '^@/(.*)$': '<rootDir>/$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  collectCoverageFrom: [
    '**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
  transformIgnorePatterns: [
    '/node_modules/(?!(jose|next-auth|@panva|@babel|uuid|debug)/)',
  ],
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest', {
      jsc: {
        transform: {
          react: {
            runtime: 'automatic'
          },
        },
        parser: {
          syntax: 'typescript',
          tsx: true,
        },
      },
      module: {
        type: 'commonjs',
      },
    }],
  },
}; 