import dotenv from 'dotenv';
import { createApolloClient } from './apollo';
import { Hasyx } from './hasyx'; 
import { Generator } from './generator';
import { hashPassword } from './authDbUtils';
import schema from '../public/hasura-schema.json';

// Load environment variables
dotenv.config();

async function createTestUser() {
  const adminClient = new Hasyx(createApolloClient({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
    secret: process.env.HASURA_ADMIN_SECRET!,
  }), Generator(schema));

  const testEmail = 'test@example.com';
  const testPassword = '123456';

  console.log('Creating test user...');

  try {
    // Check if user exists
    const existing = await adminClient.select({
      table: 'users',
      where: { email: { _eq: testEmail } },
      returning: ['id', 'email']
    });

    if (existing) {
      console.log('✅ Test user already exists:', existing.email);
    } else {
      // Create test user
      const hashedPassword = await hashPassword(testPassword);
      
      const newUser = await adminClient.insert({
        table: 'users',
        objects: [{
          email: testEmail,
          password: hashedPassword,
          name: 'Test User',
          is_admin: false,
          hasura_role: 'user'
        }]
      });
      
      console.log('✅ Test user created:', newUser.email);
    }

    console.log('\nTest credentials:');
    console.log('Email:', testEmail);
    console.log('Password:', testPassword);
    
  } catch (error) {
    console.error('❌ Error creating test user:', error);
  }
}

// Run if called directly
if (require.main === module) {
  createTestUser();
} 