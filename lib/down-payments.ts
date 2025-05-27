import { Hasura } from './hasura';
import Debug from './debug';

const debug = Debug('lib:down-payments');

/**
 * Drop computed fields and functions using high-level methods
 */
export async function dropComputedFields(hasura: Hasura) {
  debug('🧹 Dropping computed fields and functions...');

  // Drop computed fields first
  await hasura.deleteComputedField({
    schema: 'payments',
    table: 'subscriptions',
    name: 'computed_next_billing_date'
  });
  
  await hasura.deleteComputedField({
    schema: 'payments',
    table: 'subscriptions',
    name: 'computed_last_billing_date'
  });
  
  await hasura.deleteComputedField({
    schema: 'payments',
    table: 'subscriptions',
    name: 'computed_missed_cycles'
  });

  // Drop functions
  await hasura.deleteFunction({
    schema: 'payments',
    name: 'calculate_next_billing_date'
  });
  
  await hasura.deleteFunction({
    schema: 'payments',
    name: 'get_last_billing_date'
  });
  
  await hasura.deleteFunction({
    schema: 'payments',
    name: 'count_missed_billing_cycles'
  });

  debug('✅ Computed fields and functions dropped.');
}

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
  
  // Drop relationships from payments tables
  const relationshipMappings = [
    { table: 'providers', relationships: ['user', 'methods', 'subscriptions', 'operations', 'user_mappings'] },
    { table: 'methods', relationships: ['user', 'provider', 'subscriptions', 'operations'] },
    { table: 'plans', relationships: ['user', 'subscriptions'] },
    { table: 'subscriptions', relationships: ['user', 'method', 'plan', 'provider', 'operations'] },
    { table: 'operations', relationships: ['user', 'method', 'provider', 'subscription'] },
    { table: 'user_payment_provider_mappings', relationships: ['user', 'provider'] }
  ];
  
  for (const { table, relationships } of relationshipMappings) {
    for (const relationshipName of relationships) {
      await hasura.deleteRelationship({
        schema: 'payments',
        table: table,
        name: relationshipName
      });
    }
  }
  
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
  
  // Drop tables in reverse dependency order using high-level methods
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
    // First remove computed fields and functions
    await dropComputedFields(hasura);

    // Then remove metadata (tracking, relationships, permissions)
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