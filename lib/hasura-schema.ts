// lib/hasura-schema.ts
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs-extra'; // Use fs-extra for ensureDirSync
import path from 'path';
import { IntrospectionQuery, getIntrospectionQuery } from 'graphql'; // Use standard introspection query function

dotenv.config();

const HASURA_GRAPHQL_URL = process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL;
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET;
const OUTPUT_DIR = path.resolve(process.cwd(), 'public');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'hasura-schema.json');

if (!HASURA_GRAPHQL_URL) {
  console.error('❌ Error: NEXT_PUBLIC_HASURA_GRAPHQL_URL is not defined in .env');
  process.exit(1);
}

async function fetchSchema() {
  console.log(`🚀 Requesting introspection schema from ${HASURA_GRAPHQL_URL}...`);
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (HASURA_ADMIN_SECRET) {
      headers['X-Hasura-Admin-Secret'] = HASURA_ADMIN_SECRET;
      console.log('🔑 Using Hasura Admin Secret.');
    } else {
       console.warn('⚠️ HASURA_ADMIN_SECRET not found. Requesting schema without admin rights (may be incomplete).');
    }

    const response = await axios.post(
      HASURA_GRAPHQL_URL!, // Add non-null assertion here
      {
        query: getIntrospectionQuery(), // Use the function to get the query string
      },
      { headers }
    );

    if (response.data.errors) {
       throw new Error(`GraphQL error when requesting schema: ${JSON.stringify(response.data.errors)}`);
    }

    if (!response.data || !response.data.data || !response.data.data.__schema) {
        throw new Error('Invalid response from Hasura server. Missing data.__schema.');
    }

    const introspectionResult = response.data; 

    console.log(`💾 Saving schema to ${OUTPUT_PATH}...`);
    fs.ensureDirSync(OUTPUT_DIR);
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(introspectionResult, null, 2)); // Saving complete result

    console.log(`✅ Schema successfully retrieved and saved to ${OUTPUT_PATH}`);
  } catch (error: any) {
    console.error('❌ Error retrieving or saving schema:', error.response?.data || error.message || error);
    process.exit(1);
  }
}

fetchSchema(); 