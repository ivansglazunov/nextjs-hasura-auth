// codegen.ts
import type { CodegenConfig } from '@graphql-codegen/cli';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables (path to .env file)
dotenv.config();

const config: CodegenConfig = {
  overwrite: true,
  // Specify the path to the schema file that we generate
  schema: './public/hasura-schema.json',
  // Can also specify URL and headers if we want to request schema directly
  // schema: [
  //   {
  //     [process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!]: {
  //       headers: {
  //         'X-Hasura-Admin-Secret': process.env.HASURA_ADMIN_SECRET!,
  //       },
  //     },
  //   },
  // ],
  documents: undefined, // We don't use separate .graphql files for operations
  generates: {
    // Path to the file where types will be generated
    'types/hasura-types.d.ts': {
      plugins: ['typescript'], // Use basic typescript plugin
      config: {
        // TypeScript plugin settings - mapping Hasura/Postgres scalars to TS types
        scalars: {
          uuid: 'string',
          timestamptz: 'number', // Using number for unix timestamps (milliseconds since epoch)
          bigint: 'number', // BIGINT should be number for timestamps
          numeric: 'number',
          jsonb: 'any',
        },
        // avoidOptionals: true, // Make optional fields required (use with caution)
        // maybeValue: 'T | null | undefined', // How to represent nullable types
      },
    },
    // Can add other output files or plugins here
    // For example, for generating operation types:
    // './path/to/graphql.ts': {
    //   preset: 'import-types',
    //   documents: 'src/**/*.graphql', // If we had .graphql files
    //   plugins: ['typescript-operations'],
    //   presetConfig: {
    //     typesPath: './hasura-types.d.ts', // Reference to base types
    //   },
    // },
  },
  hooks: { // Runs after generation
      afterAllFileWrite: ['prettier --write'] // Format generated files
  }
};

module.exports = config;