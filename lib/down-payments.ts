import { Hasura } from './hasura';
import Debug from './debug';

const debug = Debug('lib:down-payments');

/**
 * Drop permissions and untrack tables using high-level methods
 */
export async function dropMetadata(hasura: Hasura) {
  debug('🧹 Dropping payments permissions and untracking tables...');

  debug('  🗑️ Dropping permissions...');
  
  const tableNames = ['providers', 'methods', 'plans', 'subscriptions', 'operations', 'user_payment_provider_mappings'];
  const roles = ['public', 'user', 'me', 'admin'];
  const operations = ['select', 'insert', 'update', 'delete'];
  
  // Drop all permissions for all tables and roles
  for (const tableName of tableNames) {
    for (const role of roles) {
      for (const operation of operations) {
        await hasura.deletePermission({
          schema: 'payments',
          table: tableName,
          operation: operation as any,
          role: role
        });
      }
    }
  }
  
  debug('  ✅ Permissions dropped.');
  
  debug('  🗑️ Dropping relationships...');
  
  // Drop relationships from public.users table
  await hasura.deleteRelationship({
    schema: 'public',
    table: 'users',
    name: 'payment_providers'
  });
  
  await hasura.deleteRelationship({
    schema: 'public',
    table: 'users',
    name: 'payment_methods'
  });
  
  await hasura.deleteRelationship({
    schema: 'public',
    table: 'users',
    name: 'payment_operations'
  });
  
  await hasura.deleteRelationship({
    schema: 'public',
    table: 'users',
    name: 'subscription_plans_created'
  });
  
  await hasura.deleteRelationship({
    schema: 'public',
    table: 'users',
    name: 'subscriptions'
  });
  
  await hasura.deleteRelationship({
    schema: 'public',
    table: 'users',
    name: 'payment_provider_mappings'
  });
  
  // Drop relationships from payments.providers
  await hasura.deleteRelationship({
    schema: 'payments',
    table: 'providers',
    name: 'user'
  });
  
  await hasura.deleteRelationship({
    schema: 'payments',
    table: 'providers',
    name: 'methods'
  });
  
  await hasura.deleteRelationship({
    schema: 'payments',
    table: 'providers',
    name: 'subscriptions'
  });
  
  await hasura.deleteRelationship({
    schema: 'payments',
    table: 'providers',
    name: 'operations'
  });
  
  await hasura.deleteRelationship({
    schema: 'payments',
    table: 'providers',
    name: 'user_mappings'
  });
  
  // Drop relationships from payments.methods
  await hasura.deleteRelationship({
    schema: 'payments',
    table: 'methods',
    name: 'user'
  });
  
  await hasura.deleteRelationship({
    schema: 'payments',
    table: 'methods',
    name: 'provider'
  });
  
  await hasura.deleteRelationship({
    schema: 'payments',
    table: 'methods',
    name: 'subscriptions'
  });
  
  await hasura.deleteRelationship({
    schema: 'payments',
    table: 'methods',
    name: 'operations'
  });
  
  // Drop relationships from payments.plans
  await hasura.deleteRelationship({
    schema: 'payments',
    table: 'plans',
    name: 'user'
  });
  
  await hasura.deleteRelationship({
    schema: 'payments',
    table: 'plans',
    name: 'subscriptions'
  });
  
  // Drop relationships from payments.subscriptions
  await hasura.deleteRelationship({
    schema: 'payments',
    table: 'subscriptions',
    name: 'user'
  });
  
  await hasura.deleteRelationship({
    schema: 'payments',
    table: 'subscriptions',
    name: 'method'
  });
  
  await hasura.deleteRelationship({
    schema: 'payments',
    table: 'subscriptions',
    name: 'plan'
  });
  
  await hasura.deleteRelationship({
    schema: 'payments',
    table: 'subscriptions',
    name: 'provider'
  });
  
  await hasura.deleteRelationship({
    schema: 'payments',
    table: 'subscriptions',
    name: 'operations'
  });
  
  // Drop relationships from payments.operations
  await hasura.deleteRelationship({
    schema: 'payments',
    table: 'operations',
    name: 'user'
  });
  
  await hasura.deleteRelationship({
    schema: 'payments',
    table: 'operations',
    name: 'method'
  });
  
  await hasura.deleteRelationship({
    schema: 'payments',
    table: 'operations',
    name: 'provider'
  });
  
  await hasura.deleteRelationship({
    schema: 'payments',
    table: 'operations',
    name: 'subscription'
  });
  
  // Drop relationships from payments.user_payment_provider_mappings
  await hasura.deleteRelationship({
    schema: 'payments',
    table: 'user_payment_provider_mappings',
    name: 'user'
  });
  
  await hasura.deleteRelationship({
    schema: 'payments',
    table: 'user_payment_provider_mappings',
    name: 'provider'
  });
  
  debug('  ✅ Relationships dropped.');

  debug('  🗑️ Untracking tables...');
  
  // Untrack all payment tables
  for (const tableName of tableNames) {
    await hasura.untrackTable({ 
      schema: 'payments', 
      table: tableName 
    });
  }
  
  debug('✅ Tables untracked.');
}

/**
 * Drop payment tables using high-level methods
 */
export async function dropTables(hasura: Hasura) {
  debug('🧹 Dropping payment tables...');
  
  // Drop foreign key constraints first (in reverse dependency order)
  
  // Drop foreign keys from operations table
  await hasura.deleteForeignKey({
    schema: 'payments',
    table: 'operations',
    name: 'operations_user_id_fkey'
  });
  
  await hasura.deleteForeignKey({
    schema: 'payments',
    table: 'operations',
    name: 'operations_method_id_fkey'
  });
  
  await hasura.deleteForeignKey({
    schema: 'payments',
    table: 'operations',
    name: 'operations_provider_id_fkey'
  });
  
  await hasura.deleteForeignKey({
    schema: 'payments',
    table: 'operations',
    name: 'operations_subscription_id_fkey'
  });
  
  // Drop foreign keys from subscriptions table
  await hasura.deleteForeignKey({
    schema: 'payments',
    table: 'subscriptions',
    name: 'subscriptions_user_id_fkey'
  });
  
  await hasura.deleteForeignKey({
    schema: 'payments',
    table: 'subscriptions',
    name: 'subscriptions_method_id_fkey'
  });
  
  await hasura.deleteForeignKey({
    schema: 'payments',
    table: 'subscriptions',
    name: 'subscriptions_plan_id_fkey'
  });
  
  await hasura.deleteForeignKey({
    schema: 'payments',
    table: 'subscriptions',
    name: 'subscriptions_provider_id_fkey'
  });
  
  // Drop foreign keys from user_payment_provider_mappings table
  await hasura.deleteForeignKey({
    schema: 'payments',
    table: 'user_payment_provider_mappings',
    name: 'user_payment_provider_mappings_user_id_fkey'
  });
  
  await hasura.deleteForeignKey({
    schema: 'payments',
    table: 'user_payment_provider_mappings',
    name: 'user_payment_provider_mappings_provider_id_fkey'
  });
  
  // Drop foreign keys from methods table
  await hasura.deleteForeignKey({
    schema: 'payments',
    table: 'methods',
    name: 'methods_user_id_fkey'
  });
  
  await hasura.deleteForeignKey({
    schema: 'payments',
    table: 'methods',
    name: 'methods_provider_id_fkey'
  });
  
  // Drop foreign keys from plans table
  await hasura.deleteForeignKey({
    schema: 'payments',
    table: 'plans',
    name: 'plans_user_id_fkey'
  });
  
  // Drop foreign keys from providers table
  await hasura.deleteForeignKey({
    schema: 'payments',
    table: 'providers',
    name: 'providers_user_id_fkey'
  });
  
  // Drop tables in reverse dependency order
  await hasura.deleteTable({ schema: 'payments', table: 'operations' });
  await hasura.deleteTable({ schema: 'payments', table: 'subscriptions' });
  await hasura.deleteTable({ schema: 'payments', table: 'user_payment_provider_mappings' });
  await hasura.deleteTable({ schema: 'payments', table: 'methods' });
  await hasura.deleteTable({ schema: 'payments', table: 'plans' });
  await hasura.deleteTable({ schema: 'payments', table: 'providers' });
  
  debug('✅ Payment tables dropped successfully.');
}

/**
 * Drop payments schema using high-level methods
 */
export async function dropSchema(hasura: Hasura) {
  debug('🧹 Dropping payments schema...');
  
  await hasura.deleteSchema({ schema: 'payments', cascade: true });
  
  debug('✅ Payments schema dropped successfully.');
}

/**
 * Main migration function to remove payments system
 */
export async function down(customHasura?: Hasura) {
  debug('🚀 Starting Hasura Payments migration DOWN...');
  
  const hasura = customHasura || new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
    secret: process.env.HASURA_ADMIN_SECRET!,
  });
  
  try {
    // First remove metadata (tracking, relationships, permissions)
    await dropMetadata(hasura);

    // Then drop the tables themselves
    await dropTables(hasura);
    
    // Finally drop the schema
    await dropSchema(hasura);

    debug('✨ Hasura Payments migration DOWN completed successfully!');
    return true;
  } catch (error) {
    console.error('❗ Critical error during Payments DOWN migration:', error);
    debug('❌ Payments DOWN Migration failed.');
    return false;
  }
} 