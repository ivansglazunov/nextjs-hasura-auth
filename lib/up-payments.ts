import { Hasura, ColumnType } from './hasura';
import Debug from './debug';

const debug = Debug('lib:up-payments');
const MIGRATION_NAME = '20240801120000-hasyx-payments';

async function createPaymentsSchema(hasura: Hasura) {
  debug('Creating payments schema...');
  await hasura.defineSchema({ schema: 'payments' });
  debug('Payments schema created successfully.');
}

async function createPaymentProviders(hasura: Hasura) {
  debug('Creating payments.providers table...');
  
  await hasura.defineTable({ schema: 'payments', table: 'providers' });
  
  // Define columns
  await hasura.defineColumn({
    schema: 'payments',
    table: 'providers',
    name: 'name',
    type: ColumnType.TEXT,
    comment: 'Provider name'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'providers',
    name: 'type',
    type: ColumnType.TEXT,
    comment: 'Provider type'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'providers',
    name: 'config',
    type: ColumnType.JSONB,
    comment: 'Provider configuration'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'providers',
    name: 'is_test_mode',
    type: ColumnType.BOOLEAN,
    postfix: 'DEFAULT false',
    comment: 'Test mode flag'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'providers',
    name: 'default_return_url',
    type: ColumnType.TEXT,
    comment: 'Default return URL'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'providers',
    name: 'default_webhook_url',
    type: ColumnType.TEXT,
    comment: 'Default webhook URL'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'providers',
    name: 'default_card_webhook_url',
    type: ColumnType.TEXT,
    comment: 'Default card webhook URL'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'providers',
    name: 'user_id',
    type: ColumnType.UUID,
    comment: 'Owner user ID'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'providers',
    name: 'is_active',
    type: ColumnType.BOOLEAN,
    postfix: 'DEFAULT true',
    comment: 'Active status'
  });
  
  // Define foreign key
  await hasura.defineForeignKey({
    from: { schema: 'payments', table: 'providers', column: 'user_id' },
    to: { schema: 'public', table: 'users', column: 'id' },
    on_delete: 'SET NULL',
    on_update: 'SET NULL'
  });
  
  // Define unique constraint
  await hasura.sql(`ALTER TABLE "payments"."providers" ADD CONSTRAINT "providers_name_type_test_mode_unique" UNIQUE ("name", "type", "is_test_mode");`);
  
  debug('payments.providers table created successfully.');
}

async function createPaymentMethods(hasura: Hasura) {
  debug('Creating payments.methods table...');
  
  await hasura.defineTable({ schema: 'payments', table: 'methods' });
  
  // Define columns
  await hasura.defineColumn({
    schema: 'payments',
    table: 'methods',
    name: 'user_id',
    type: ColumnType.UUID,
    postfix: 'NOT NULL',
    comment: 'User ID'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'methods',
    name: 'provider_id',
    type: ColumnType.UUID,
    postfix: 'NOT NULL',
    comment: 'Provider ID'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'methods',
    name: 'external_id',
    type: ColumnType.TEXT,
    comment: 'External provider ID'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'methods',
    name: 'type',
    type: ColumnType.TEXT,
    postfix: 'NOT NULL',
    comment: 'Payment method type'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'methods',
    name: 'details',
    type: ColumnType.JSONB,
    comment: 'Payment method details'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'methods',
    name: 'is_default',
    type: ColumnType.BOOLEAN,
    postfix: 'DEFAULT false',
    comment: 'Default method flag'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'methods',
    name: 'is_recurrent_ready',
    type: ColumnType.BOOLEAN,
    postfix: 'DEFAULT false',
    comment: 'Recurrent payment ready'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'methods',
    name: 'recurrent_details',
    type: ColumnType.JSONB,
    comment: 'Recurrent payment details'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'methods',
    name: 'expires_at',
    type: ColumnType.BIGINT,
    comment: 'Expiration timestamp'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'methods',
    name: 'status',
    type: ColumnType.TEXT,
    postfix: "DEFAULT 'active'",
    comment: 'Method status'
  });
  
  // Define foreign keys
  await hasura.defineForeignKey({
    from: { schema: 'payments', table: 'methods', column: 'user_id' },
    to: { schema: 'public', table: 'users', column: 'id' },
    on_delete: 'CASCADE',
    on_update: 'CASCADE'
  });
  
  await hasura.defineForeignKey({
    from: { schema: 'payments', table: 'methods', column: 'provider_id' },
    to: { schema: 'payments', table: 'providers', column: 'id' },
    on_delete: 'CASCADE',
    on_update: 'RESTRICT'
  });
  
  // Define unique constraint
  await hasura.sql(`ALTER TABLE "payments"."methods" ADD CONSTRAINT "methods_user_provider_external_type_unique" UNIQUE ("user_id", "provider_id", "external_id", "type");`);
  
  debug('payments.methods table created successfully.');
}

async function createPaymentPlans(hasura: Hasura) {
  debug('Creating payments.plans table...');
  
  await hasura.defineTable({ schema: 'payments', table: 'plans' });
  
  // Define columns
  await hasura.defineColumn({
    schema: 'payments',
    table: 'plans',
    name: 'name',
    type: ColumnType.TEXT,
    postfix: 'NOT NULL',
    comment: 'Plan name'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'plans',
    name: 'description',
    type: ColumnType.TEXT,
    comment: 'Plan description'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'plans',
    name: 'price',
    type: ColumnType.NUMERIC,
    postfix: 'NOT NULL',
    comment: 'Plan price'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'plans',
    name: 'currency',
    type: ColumnType.TEXT,
    postfix: 'NOT NULL',
    comment: 'Currency code'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'plans',
    name: 'interval',
    type: ColumnType.TEXT,
    postfix: 'NOT NULL',
    comment: 'Billing interval'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'plans',
    name: 'interval_count',
    type: ColumnType.INTEGER,
    postfix: 'NOT NULL',
    comment: 'Interval count'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'plans',
    name: 'trial_period_days',
    type: ColumnType.INTEGER,
    postfix: 'DEFAULT 0',
    comment: 'Trial period in days'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'plans',
    name: 'active',
    type: ColumnType.BOOLEAN,
    postfix: 'DEFAULT true',
    comment: 'Plan active status'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'plans',
    name: 'features',
    type: ColumnType.JSONB,
    comment: 'Plan features'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'plans',
    name: 'metadata',
    type: ColumnType.JSONB,
    comment: 'Plan metadata'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'plans',
    name: 'user_id',
    type: ColumnType.UUID,
    comment: 'Plan creator user ID'
  });
  
  // Define foreign key
  await hasura.defineForeignKey({
    from: { schema: 'payments', table: 'plans', column: 'user_id' },
    to: { schema: 'public', table: 'users', column: 'id' },
    on_delete: 'SET NULL',
    on_update: 'SET NULL'
  });
  
  // Add constraints
  await hasura.sql(`ALTER TABLE "payments"."plans" ADD CONSTRAINT "plans_price_check" CHECK (price >= 0);`);
  
  debug('payments.plans table created successfully.');
}

async function createPaymentSubscriptions(hasura: Hasura) {
  debug('Creating payments.subscriptions table...');
  
  await hasura.defineTable({ schema: 'payments', table: 'subscriptions' });
  
  // Define columns
  await hasura.defineColumn({
    schema: 'payments',
    table: 'subscriptions',
    name: 'user_id',
    type: ColumnType.UUID,
    postfix: 'NOT NULL',
    comment: 'User ID'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'subscriptions',
    name: 'method_id',
    type: ColumnType.UUID,
    postfix: 'NOT NULL',
    comment: 'Payment method ID'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'subscriptions',
    name: 'plan_id',
    type: ColumnType.UUID,
    comment: 'Plan ID'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'subscriptions',
    name: 'provider_id',
    type: ColumnType.UUID,
    postfix: 'NOT NULL',
    comment: 'Provider ID'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'subscriptions',
    name: 'external_subscription_id',
    type: ColumnType.TEXT,
    comment: 'External subscription ID'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'subscriptions',
    name: 'status',
    type: ColumnType.TEXT,
    postfix: 'NOT NULL',
    comment: 'Subscription status'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'subscriptions',
    name: 'current_period_start',
    type: ColumnType.BIGINT,
    comment: 'Current period start'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'subscriptions',
    name: 'current_period_end',
    type: ColumnType.BIGINT,
    comment: 'Current period end'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'subscriptions',
    name: 'trial_ends_at',
    type: ColumnType.BIGINT,
    comment: 'Trial end timestamp'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'subscriptions',
    name: 'cancel_at_period_end',
    type: ColumnType.BOOLEAN,
    postfix: 'DEFAULT false',
    comment: 'Cancel at period end flag'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'subscriptions',
    name: 'canceled_at',
    type: ColumnType.BIGINT,
    comment: 'Cancellation timestamp'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'subscriptions',
    name: 'ended_at',
    type: ColumnType.BIGINT,
    comment: 'End timestamp'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'subscriptions',
    name: 'object_hid',
    type: ColumnType.TEXT,
    comment: 'Object HID'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'subscriptions',
    name: 'metadata',
    type: ColumnType.JSONB,
    comment: 'Subscription metadata'
  });
  
  // Define foreign keys
  await hasura.defineForeignKey({
    from: { schema: 'payments', table: 'subscriptions', column: 'user_id' },
    to: { schema: 'public', table: 'users', column: 'id' },
    on_delete: 'CASCADE',
    on_update: 'CASCADE'
  });
  
  await hasura.defineForeignKey({
    from: { schema: 'payments', table: 'subscriptions', column: 'method_id' },
    to: { schema: 'payments', table: 'methods', column: 'id' },
    on_delete: 'CASCADE',
    on_update: 'RESTRICT'
  });
  
  await hasura.defineForeignKey({
    from: { schema: 'payments', table: 'subscriptions', column: 'plan_id' },
    to: { schema: 'payments', table: 'plans', column: 'id' },
    on_delete: 'CASCADE',
    on_update: 'SET NULL'
  });
  
  await hasura.defineForeignKey({
    from: { schema: 'payments', table: 'subscriptions', column: 'provider_id' },
    to: { schema: 'payments', table: 'providers', column: 'id' },
    on_delete: 'CASCADE',
    on_update: 'RESTRICT'
  });
  
  debug('payments.subscriptions table created successfully.');
}

async function createPaymentOperations(hasura: Hasura) {
  debug('Creating payments.operations table...');
  
  await hasura.defineTable({ schema: 'payments', table: 'operations' });
  
  // Define columns
  await hasura.defineColumn({
    schema: 'payments',
    table: 'operations',
    name: 'user_id',
    type: ColumnType.UUID,
    postfix: 'NOT NULL',
    comment: 'User ID'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'operations',
    name: 'method_id',
    type: ColumnType.UUID,
    comment: 'Payment method ID'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'operations',
    name: 'provider_id',
    type: ColumnType.UUID,
    postfix: 'NOT NULL',
    comment: 'Provider ID'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'operations',
    name: 'external_operation_id',
    type: ColumnType.TEXT,
    comment: 'External operation ID'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'operations',
    name: 'subscription_id',
    type: ColumnType.UUID,
    comment: 'Subscription ID'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'operations',
    name: 'amount',
    type: ColumnType.NUMERIC,
    postfix: 'NOT NULL',
    comment: 'Operation amount'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'operations',
    name: 'currency',
    type: ColumnType.TEXT,
    postfix: 'NOT NULL',
    comment: 'Currency code'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'operations',
    name: 'status',
    type: ColumnType.TEXT,
    postfix: 'NOT NULL',
    comment: 'Operation status'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'operations',
    name: 'description',
    type: ColumnType.TEXT,
    comment: 'Operation description'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'operations',
    name: 'object_hid',
    type: ColumnType.TEXT,
    comment: 'Object HID'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'operations',
    name: 'provider_request_details',
    type: ColumnType.JSONB,
    comment: 'Provider request details'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'operations',
    name: 'provider_response_details',
    type: ColumnType.JSONB,
    comment: 'Provider response details'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'operations',
    name: 'error_message',
    type: ColumnType.TEXT,
    comment: 'Error message'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'operations',
    name: 'initiated_at',
    type: ColumnType.BIGINT,
    postfix: 'DEFAULT EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000',
    comment: 'Initiation timestamp'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'operations',
    name: 'paid_at',
    type: ColumnType.BIGINT,
    comment: 'Payment timestamp'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'operations',
    name: 'metadata',
    type: ColumnType.JSONB,
    comment: 'Operation metadata'
  });
  
  // Define foreign keys
  await hasura.defineForeignKey({
    from: { schema: 'payments', table: 'operations', column: 'user_id' },
    to: { schema: 'public', table: 'users', column: 'id' },
    on_delete: 'CASCADE',
    on_update: 'CASCADE'
  });
  
  await hasura.defineForeignKey({
    from: { schema: 'payments', table: 'operations', column: 'method_id' },
    to: { schema: 'payments', table: 'methods', column: 'id' },
    on_delete: 'CASCADE',
    on_update: 'SET NULL'
  });
  
  await hasura.defineForeignKey({
    from: { schema: 'payments', table: 'operations', column: 'provider_id' },
    to: { schema: 'payments', table: 'providers', column: 'id' },
    on_delete: 'CASCADE',
    on_update: 'RESTRICT'
  });
  
  await hasura.defineForeignKey({
    from: { schema: 'payments', table: 'operations', column: 'subscription_id' },
    to: { schema: 'payments', table: 'subscriptions', column: 'id' },
    on_delete: 'CASCADE',
    on_update: 'SET NULL'
  });
  
  // Add constraints
  await hasura.sql(`ALTER TABLE "payments"."operations" ADD CONSTRAINT "operations_amount_check" CHECK (amount >= 0);`);
  
  debug('payments.operations table created successfully.');
}

async function createUserPaymentProviderMappings(hasura: Hasura) {
  debug('Creating payments.user_payment_provider_mappings table...');
  
  await hasura.defineTable({ schema: 'payments', table: 'user_payment_provider_mappings' });
  
  // Define columns
  await hasura.defineColumn({
    schema: 'payments',
    table: 'user_payment_provider_mappings',
    name: 'user_id',
    type: ColumnType.UUID,
    postfix: 'NOT NULL',
    comment: 'User ID'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'user_payment_provider_mappings',
    name: 'provider_id',
    type: ColumnType.UUID,
    postfix: 'NOT NULL',
    comment: 'Provider ID'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'user_payment_provider_mappings',
    name: 'provider_customer_key',
    type: ColumnType.TEXT,
    postfix: 'NOT NULL',
    comment: 'Provider customer key'
  });
  
  await hasura.defineColumn({
    schema: 'payments',
    table: 'user_payment_provider_mappings',
    name: 'metadata',
    type: ColumnType.JSONB,
    comment: 'Mapping metadata'
  });
  
  // Define foreign keys
  await hasura.defineForeignKey({
    from: { schema: 'payments', table: 'user_payment_provider_mappings', column: 'user_id' },
    to: { schema: 'public', table: 'users', column: 'id' },
    on_delete: 'CASCADE',
    on_update: 'CASCADE'
  });
  
  await hasura.defineForeignKey({
    from: { schema: 'payments', table: 'user_payment_provider_mappings', column: 'provider_id' },
    to: { schema: 'payments', table: 'providers', column: 'id' },
    on_delete: 'CASCADE',
    on_update: 'CASCADE'
  });
  
  // Define unique constraint
  await hasura.sql(`ALTER TABLE "payments"."user_payment_provider_mappings" ADD CONSTRAINT "user_payment_provider_mappings_unique" UNIQUE ("user_id", "provider_id", "provider_customer_key");`);
  
  debug('payments.user_payment_provider_mappings table created successfully.');
}

async function createIndexes(hasura: Hasura) {
  debug('Creating indexes for payment tables...');
  
  // Add indexes for better performance
  await hasura.sql(`CREATE INDEX IF NOT EXISTS "idx_methods_user_id" ON "payments"."methods" ("user_id");`);
  await hasura.sql(`CREATE INDEX IF NOT EXISTS "idx_operations_user_id" ON "payments"."operations" ("user_id");`);
  await hasura.sql(`CREATE INDEX IF NOT EXISTS "idx_subscriptions_user_id" ON "payments"."subscriptions" ("user_id");`);
  
  debug('Indexes created successfully.');
}

async function trackPaymentTables(hasura: Hasura) {
  debug('Tracking payment tables...');
  
  await hasura.trackTable({ schema: 'payments', table: 'providers' });
  await hasura.trackTable({ schema: 'payments', table: 'methods' });
  await hasura.trackTable({ schema: 'payments', table: 'plans' });
  await hasura.trackTable({ schema: 'payments', table: 'subscriptions' });
  await hasura.trackTable({ schema: 'payments', table: 'operations' });
  await hasura.trackTable({ schema: 'payments', table: 'user_payment_provider_mappings' });
  
  debug('Payment tables tracked successfully.');
}

async function createPaymentRelationships(hasura: Hasura) {
  debug('Creating relationships for payment tables...');
  
  // Relationships for payments.providers
  await hasura.defineObjectRelationshipForeign({
    schema: 'payments',
    table: 'providers',
    name: 'user',
    key: 'user_id'
  });
  
  await hasura.defineArrayRelationshipForeign({
    schema: 'payments',
    table: 'providers',
    name: 'methods',
    key: 'methods.provider_id'
  });
  
  await hasura.defineArrayRelationshipForeign({
    schema: 'payments',
    table: 'providers',
    name: 'subscriptions',
    key: 'subscriptions.provider_id'
  });
  
  await hasura.defineArrayRelationshipForeign({
    schema: 'payments',
    table: 'providers',
    name: 'operations',
    key: 'operations.provider_id'
  });
  
  await hasura.defineArrayRelationshipForeign({
    schema: 'payments',
    table: 'providers',
    name: 'user_mappings',
    key: 'user_payment_provider_mappings.provider_id'
  });

  // Relationships for payments.methods
  await hasura.defineObjectRelationshipForeign({
    schema: 'payments',
    table: 'methods',
    name: 'user',
    key: 'user_id'
  });
  
  await hasura.defineObjectRelationshipForeign({
    schema: 'payments',
    table: 'methods',
    name: 'provider',
    key: 'provider_id'
  });
  
  await hasura.defineArrayRelationshipForeign({
    schema: 'payments',
    table: 'methods',
    name: 'subscriptions',
    key: 'subscriptions.method_id'
  });
  
  await hasura.defineArrayRelationshipForeign({
    schema: 'payments',
    table: 'methods',
    name: 'operations',
    key: 'operations.method_id'
  });

  // Relationships for payments.plans
  await hasura.defineObjectRelationshipForeign({
    schema: 'payments',
    table: 'plans',
    name: 'user',
    key: 'user_id'
  });
  
  await hasura.defineArrayRelationshipForeign({
    schema: 'payments',
    table: 'plans',
    name: 'subscriptions',
    key: 'subscriptions.plan_id'
  });

  // Relationships for payments.subscriptions
  await hasura.defineObjectRelationshipForeign({
    schema: 'payments',
    table: 'subscriptions',
    name: 'user',
    key: 'user_id'
  });
  
  await hasura.defineObjectRelationshipForeign({
    schema: 'payments',
    table: 'subscriptions',
    name: 'method',
    key: 'method_id'
  });
  
  await hasura.defineObjectRelationshipForeign({
    schema: 'payments',
    table: 'subscriptions',
    name: 'plan',
    key: 'plan_id'
  });
  
  await hasura.defineObjectRelationshipForeign({
    schema: 'payments',
    table: 'subscriptions',
    name: 'provider',
    key: 'provider_id'
  });
  
  await hasura.defineArrayRelationshipForeign({
    schema: 'payments',
    table: 'subscriptions',
    name: 'operations',
    key: 'operations.subscription_id'
  });

  // Relationships for payments.operations
  await hasura.defineObjectRelationshipForeign({
    schema: 'payments',
    table: 'operations',
    name: 'user',
    key: 'user_id'
  });
  
  await hasura.defineObjectRelationshipForeign({
    schema: 'payments',
    table: 'operations',
    name: 'method',
    key: 'method_id'
  });
  
  await hasura.defineObjectRelationshipForeign({
    schema: 'payments',
    table: 'operations',
    name: 'provider',
    key: 'provider_id'
  });
  
  await hasura.defineObjectRelationshipForeign({
    schema: 'payments',
    table: 'operations',
    name: 'subscription',
    key: 'subscription_id'
  });

  // Relationships for payments.user_payment_provider_mappings
  await hasura.defineObjectRelationshipForeign({
    schema: 'payments',
    table: 'user_payment_provider_mappings',
    name: 'user',
    key: 'user_id'
  });
  
  await hasura.defineObjectRelationshipForeign({
    schema: 'payments',
    table: 'user_payment_provider_mappings',
    name: 'provider',
    key: 'provider_id'
  });

  // Array relationships from public.users table to new payments schema tables
  await hasura.defineArrayRelationshipForeign({
    schema: 'public',
    table: 'users',
    name: 'payment_providers',
    key: 'providers.user_id'
  });
  
  await hasura.defineArrayRelationshipForeign({
    schema: 'public',
    table: 'users',
    name: 'payment_methods',
    key: 'methods.user_id'
  });
  
  await hasura.defineArrayRelationshipForeign({
    schema: 'public',
    table: 'users',
    name: 'payment_operations',
    key: 'operations.user_id'
  });
  
  await hasura.defineArrayRelationshipForeign({
    schema: 'public',
    table: 'users',
    name: 'subscription_plans_created',
    key: 'plans.user_id'
  });
  
  await hasura.defineArrayRelationshipForeign({
    schema: 'public',
    table: 'users',
    name: 'subscriptions',
    key: 'subscriptions.user_id'
  });
  
  await hasura.defineArrayRelationshipForeign({
    schema: 'public',
    table: 'users',
    name: 'payment_provider_mappings',
    key: 'user_payment_provider_mappings.user_id'
  });
  
  debug('Relationships for payment tables created successfully.');
}

async function applyPaymentPermissions(hasura: Hasura) {
  debug('Applying permissions for payment tables...');

  // Permissions for role 'public' (anonymous)
  // payments.providers - can see providers but not config
  await hasura.definePermission({
    schema: 'payments',
    table: 'providers',
    operation: 'select',
    role: 'public',
    filter: {},
    columns: ['id', 'name', 'type', 'is_test_mode', 'default_return_url', 'default_webhook_url', 'default_card_webhook_url', 'user_id', 'is_active', 'created_at', 'updated_at']
  });

  // Permissions for role 'user'
  // payments.providers
  await hasura.definePermission({
    schema: 'payments',
    table: 'providers',
    operation: 'select',
    role: 'user',
    filter: {},
    columns: ['id', 'name', 'type', 'is_test_mode', 'default_return_url', 'default_webhook_url', 'default_card_webhook_url', 'user_id', 'is_active', 'created_at', 'updated_at']
  });
  
  await hasura.definePermission({
    schema: 'payments',
    table: 'providers',
    operation: 'insert',
    role: 'user',
    filter: { user_id: { _eq: 'X-Hasura-User-Id' } },
    columns: ['name', 'type', 'is_test_mode', 'config', 'default_return_url', 'default_webhook_url', 'default_card_webhook_url', 'is_active']
  });
  
  await hasura.definePermission({
    schema: 'payments',
    table: 'providers',
    operation: 'update',
    role: 'user',
    filter: { user_id: { _eq: 'X-Hasura-User-Id' } },
    columns: ['name', 'config', 'default_return_url', 'default_webhook_url', 'default_card_webhook_url', 'is_active']
  });
  
  await hasura.definePermission({
    schema: 'payments',
    table: 'providers',
    operation: 'delete',
    role: 'user',
    filter: { user_id: { _eq: 'X-Hasura-User-Id' } }
  });

  // payments.methods
  await hasura.definePermission({
    schema: 'payments',
    table: 'methods',
    operation: 'select',
    role: 'user',
    filter: { user_id: { _eq: 'X-Hasura-User-Id' } },
    columns: ['id', 'provider_id', 'external_id', 'type', 'details', 'is_default', 'is_recurrent_ready', 'expires_at', 'status', 'created_at', 'updated_at']
  });
  
  await hasura.definePermission({
    schema: 'payments',
    table: 'methods',
    operation: 'insert',
    role: 'user',
    filter: { user_id: { _eq: 'X-Hasura-User-Id' } },
    columns: ['provider_id', 'external_id', 'type', 'details', 'is_default', 'is_recurrent_ready', 'recurrent_details', 'expires_at', 'status']
  });
  
  await hasura.definePermission({
    schema: 'payments',
    table: 'methods',
    operation: 'update',
    role: 'user',
    filter: { user_id: { _eq: 'X-Hasura-User-Id' } },
    columns: ['details', 'is_default', 'is_recurrent_ready', 'recurrent_details', 'expires_at', 'status']
  });
  
  await hasura.definePermission({
    schema: 'payments',
    table: 'methods',
    operation: 'delete',
    role: 'user',
    filter: { user_id: { _eq: 'X-Hasura-User-Id' } }
  });

  // payments.plans
  await hasura.definePermission({
    schema: 'payments',
    table: 'plans',
    operation: 'select',
    role: 'user',
    filter: { _or: [{ user_id: { _is_null: true }, active: { _eq: true } }, { user_id: { _eq: 'X-Hasura-User-Id' } }] },
    columns: true
  });

  // payments.subscriptions
  await hasura.definePermission({
    schema: 'payments',
    table: 'subscriptions',
    operation: 'select',
    role: 'user',
    filter: { user_id: { _eq: 'X-Hasura-User-Id' } },
    columns: true
  });
  
  await hasura.definePermission({
    schema: 'payments',
    table: 'subscriptions',
    operation: 'insert',
    role: 'user',
    filter: { user_id: { _eq: 'X-Hasura-User-Id' } },
    columns: ['method_id', 'plan_id', 'provider_id', 'status', 'current_period_start', 'current_period_end', 'trial_ends_at', 'object_hid', 'metadata']
  });
  
  await hasura.definePermission({
    schema: 'payments',
    table: 'subscriptions',
    operation: 'update',
    role: 'user',
    filter: { user_id: { _eq: 'X-Hasura-User-Id' } },
    columns: ['method_id', 'cancel_at_period_end', 'metadata']
  });

  // payments.operations
  await hasura.definePermission({
    schema: 'payments',
    table: 'operations',
    operation: 'select',
    role: 'user',
    filter: { user_id: { _eq: 'X-Hasura-User-Id' } },
    columns: ['id', 'method_id', 'provider_id', 'external_operation_id', 'subscription_id', 'amount', 'currency', 'status', 'description', 'object_hid', 'initiated_at', 'paid_at', 'metadata', 'created_at', 'updated_at']
  });
  
  await hasura.definePermission({
    schema: 'payments',
    table: 'operations',
    operation: 'insert',
    role: 'user',
    filter: { user_id: { _eq: 'X-Hasura-User-Id' } },
    columns: ['method_id', 'provider_id', 'subscription_id', 'amount', 'currency', 'status', 'description', 'object_hid', 'initiated_at', 'metadata']
  });

  // payments.user_payment_provider_mappings
  await hasura.definePermission({
    schema: 'payments',
    table: 'user_payment_provider_mappings',
    operation: 'select',
    role: 'user',
    filter: { user_id: { _eq: 'X-Hasura-User-Id' } },
    columns: true
  });
  
  await hasura.definePermission({
    schema: 'payments',
    table: 'user_payment_provider_mappings',
    operation: 'insert',
    role: 'user',
    filter: { user_id: { _eq: 'X-Hasura-User-Id' } },
    columns: ['provider_id', 'provider_customer_key', 'metadata']
  });
  
  await hasura.definePermission({
    schema: 'payments',
    table: 'user_payment_provider_mappings',
    operation: 'update',
    role: 'user',
    filter: { user_id: { _eq: 'X-Hasura-User-Id' } },
    columns: ['provider_customer_key', 'metadata']
  });
  
  await hasura.definePermission({
    schema: 'payments',
    table: 'user_payment_provider_mappings',
    operation: 'delete',
    role: 'user',
    filter: { user_id: { _eq: 'X-Hasura-User-Id' } }
  });

  // Permissions for role 'me' (can see everything including config)
  const tableNames = ['providers', 'methods', 'plans', 'subscriptions', 'operations', 'user_payment_provider_mappings'];
  for (const tableName of tableNames) {
    await hasura.definePermission({
      schema: 'payments',
      table: tableName,
      operation: 'select',
      role: 'me',
      filter: {},
      columns: true
    });
    
    await hasura.definePermission({
      schema: 'payments',
      table: tableName,
      operation: 'insert',
      role: 'me',
      filter: {},
      columns: true
    });
    
    await hasura.definePermission({
      schema: 'payments',
      table: tableName,
      operation: 'update',
      role: 'me',
      filter: {},
      columns: true
    });
    
    await hasura.definePermission({
      schema: 'payments',
      table: tableName,
      operation: 'delete',
      role: 'me',
      filter: {}
    });
  }

  // Permissions for role 'admin' (full access)
  for (const tableName of tableNames) {
    await hasura.definePermission({
      schema: 'payments',
      table: tableName,
      operation: 'select',
      role: 'admin',
      filter: {},
      columns: true
    });
    
    await hasura.definePermission({
      schema: 'payments',
      table: tableName,
      operation: 'insert',
      role: 'admin',
      filter: {},
      columns: true
    });
    
    await hasura.definePermission({
      schema: 'payments',
      table: tableName,
      operation: 'update',
      role: 'admin',
      filter: {},
      columns: true
    });
    
    await hasura.definePermission({
      schema: 'payments',
      table: tableName,
      operation: 'delete',
      role: 'admin',
      filter: {}
    });
  }
  
  debug('Permissions for payment tables applied successfully.');
}

export async function up(customHasura?: Hasura) {
  debug('🚀 Starting Hasura Payments migration UP...');
  
  const hasura = customHasura || new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
    secret: process.env.HASURA_ADMIN_SECRET!,
  });
  
  try {
    await createPaymentsSchema(hasura);
    await createPaymentProviders(hasura);
    await createPaymentMethods(hasura);
    await createPaymentPlans(hasura);
    await createPaymentSubscriptions(hasura);
    await createPaymentOperations(hasura);
    await createUserPaymentProviderMappings(hasura);
    await createIndexes(hasura);
    await trackPaymentTables(hasura);
    await createPaymentRelationships(hasura);
    await applyPaymentPermissions(hasura);
    
    debug('✨ Hasura Payments migration UP completed successfully!');
    return true;
  } catch (error) {
    console.error('❗ Critical error during Payments UP migration:', error);
    debug('❌ Payments UP Migration failed.');
    return false;
  }
} 