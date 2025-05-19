import { Hasura } from './hasura';
import Debug from './debug';

const debug = Debug('lib:up-payments');
const MIGRATION_NAME = '20240801120000-hasyx-payments';

const sqlSchema = `
  CREATE SCHEMA IF NOT EXISTS "payments";

  CREATE TABLE IF NOT EXISTS "payments"."providers" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "name" text NOT NULL,
      "type" text NOT NULL, -- e.g., "tbank", "linkcom", "ton_wallet"
      "config" jsonb NOT NULL, -- provider-specific credentials and settings
      "is_test_mode" boolean NOT NULL DEFAULT false,
      "default_return_url" text,
      "default_webhook_url" text,
      "default_card_webhook_url" text,
      "user_id" uuid, -- For admin/system-level providers, can be null or link to a specific admin user
      "is_active" boolean NOT NULL DEFAULT true,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("id"),
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE SET NULL ON DELETE SET NULL,
      UNIQUE ("name", "type", "is_test_mode") -- Ensures unique provider configurations
  );
  COMMENT ON COLUMN "payments"."providers"."type" IS 'e.g., "tbank", "linkcom", "ton_wallet", "btc_node", "eth_node"';
  COMMENT ON COLUMN "payments"."providers"."config" IS 'Provider-specific credentials and settings. Structure depends on the type. Access to this column must be heavily restricted.';
  COMMENT ON COLUMN "payments"."providers"."user_id" IS 'If NULL, the provider is system-wide. Otherwise, it might be specific to a user (e.g. for marketplaces).';

  CREATE TABLE IF NOT EXISTS "payments"."methods" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL,
      "provider_id" uuid NOT NULL, -- Changed from provider_name
      "external_id" text,
      "type" text NOT NULL,
      "details" jsonb,
      "is_default" boolean NOT NULL DEFAULT false,
      "is_recurrent_ready" boolean NOT NULL DEFAULT false,
      "recurrent_details" jsonb,
      "expires_at" timestamptz,
      "status" text NOT NULL DEFAULT 'active',
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("id"),
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE,
      FOREIGN KEY ("provider_id") REFERENCES "payments"."providers"("id") ON UPDATE CASCADE ON DELETE RESTRICT,
      UNIQUE ("user_id", "provider_id", "external_id", "type")
  );
  COMMENT ON COLUMN "payments"."methods"."provider_id" IS 'Reference to the specific provider configuration in payments.providers';
  COMMENT ON COLUMN "payments"."methods"."external_id" IS 'Payment method ID in the external system';
  COMMENT ON COLUMN "payments"."methods"."type" IS 'e.g., "card", "ton_wallet", "sbp"';
  COMMENT ON COLUMN "payments"."methods"."details" IS 'Partially masked data for display';
  COMMENT ON COLUMN "payments"."methods"."recurrent_details" IS 'Provider-specific data for recurrent payments (may require encryption)';
  COMMENT ON COLUMN "payments"."methods"."status" IS 'e.g., "active", "expired", "revoked", "pending_verification"';

  CREATE TABLE IF NOT EXISTS "payments"."plans" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "name" text NOT NULL,
      "description" text,
      "price" numeric NOT NULL CHECK (price >= 0),
      "currency" text NOT NULL,
      "interval" text NOT NULL, -- e.g., day, week, month, year
      "interval_count" integer NOT NULL CHECK (interval_count > 0),
      "trial_period_days" integer NOT NULL DEFAULT 0 CHECK (trial_period_days >= 0),
      "active" boolean NOT NULL DEFAULT true,
      "features" jsonb,
      "metadata" jsonb,
      "user_id" uuid, -- For custom plans for a specific user
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("id"),
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE SET NULL ON DELETE SET NULL
  );
  COMMENT ON COLUMN "payments"."plans"."interval" IS 'e.g., "day", "week", "month", "year"';
  COMMENT ON COLUMN "payments"."plans"."active" IS 'Whether this plan can be subscribed to currently';
  COMMENT ON COLUMN "payments"."plans"."user_id" IS 'If NULL, the plan is publicly available. Otherwise, it is custom for the user.';

  CREATE TABLE IF NOT EXISTS "payments"."subscriptions" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL,
      "method_id" uuid NOT NULL, -- Renamed from payment_method_id
      "plan_id" uuid,
      "provider_id" uuid NOT NULL, -- Changed from provider_name
      "external_subscription_id" text,
      "status" text NOT NULL,
      "current_period_start" timestamptz,
      "current_period_end" timestamptz,
      "trial_ends_at" timestamptz,
      "cancel_at_period_end" boolean NOT NULL DEFAULT false,
      "canceled_at" timestamptz,
      "ended_at" timestamptz,
      "object_hid" text,
      "metadata" jsonb,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("id"),
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE,
      FOREIGN KEY ("method_id") REFERENCES "payments"."methods"("id") ON UPDATE CASCADE ON DELETE RESTRICT,
      FOREIGN KEY ("plan_id") REFERENCES "payments"."plans"("id") ON UPDATE CASCADE ON DELETE SET NULL,
      FOREIGN KEY ("provider_id") REFERENCES "payments"."providers"("id") ON UPDATE CASCADE ON DELETE RESTRICT
  );
  COMMENT ON COLUMN "payments"."subscriptions"."method_id" IS 'Reference to payments.methods';
  COMMENT ON COLUMN "payments"."subscriptions"."provider_id" IS 'Reference to the specific provider configuration in payments.providers';
  COMMENT ON COLUMN "payments"."subscriptions"."external_subscription_id" IS 'Subscription ID in the external system, if any';
  COMMENT ON COLUMN "payments"."subscriptions"."status" IS 'e.g., "trialing", "active", "past_due", "unpaid", "canceled", "ended", "paused"';

  CREATE TABLE IF NOT EXISTS "payments"."operations" ( -- Renamed from "payments"
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL,
      "method_id" uuid, -- Renamed from payment_method_id
      "provider_id" uuid NOT NULL, -- Changed from provider_name
      "external_operation_id" text, -- Renamed from external_payment_id
      "subscription_id" uuid,
      "amount" numeric NOT NULL CHECK (amount >= 0),
      "currency" text NOT NULL,
      "status" text NOT NULL,
      "description" text,
      "object_hid" text,
      "provider_request_details" jsonb,
      "provider_response_details" jsonb,
      "error_message" text,
      "initiated_at" timestamptz DEFAULT now(),
      "paid_at" timestamptz,
      "metadata" jsonb,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("id"),
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE,
      FOREIGN KEY ("method_id") REFERENCES "payments"."methods"("id") ON UPDATE CASCADE ON DELETE SET NULL,
      FOREIGN KEY ("provider_id") REFERENCES "payments"."providers"("id") ON UPDATE CASCADE ON DELETE RESTRICT,
      FOREIGN KEY ("subscription_id") REFERENCES "payments"."subscriptions"("id") ON UPDATE CASCADE ON DELETE SET NULL
  );
  COMMENT ON COLUMN "payments"."operations"."method_id" IS 'Reference to payments.methods, can be null for one-time payments without saving the method';
  COMMENT ON COLUMN "payments"."operations"."provider_id" IS 'Reference to the specific provider configuration in payments.providers';
  COMMENT ON COLUMN "payments"."operations"."external_operation_id" IS 'Operation ID in the external system (e.g. PaymentId, TransactionId), may not be available immediately';
  COMMENT ON COLUMN "payments"."operations"."status" IS 'e.g., "pending_initiation", "pending_user_action", "pending_confirmation", "succeeded", "failed", "canceled", "refunded"';

  -- Indexes
  -- Note: Index names need to be globally unique or unique per schema.
  -- It's good practice to prefix with schema or table name if not already unique.
  CREATE INDEX IF NOT EXISTS "idx_payments_providers_user_id" ON "payments"."providers"("user_id");
  CREATE INDEX IF NOT EXISTS "idx_payments_methods_user_id" ON "payments"."methods"("user_id");
  CREATE INDEX IF NOT EXISTS "idx_payments_methods_provider_external" ON "payments"."methods"("provider_id", "external_id");
  CREATE INDEX IF NOT EXISTS "idx_payments_plans_user_id" ON "payments"."plans"("user_id");
  CREATE INDEX IF NOT EXISTS "idx_payments_subscriptions_user_id" ON "payments"."subscriptions"("user_id");
  CREATE INDEX IF NOT EXISTS "idx_payments_subscriptions_status" ON "payments"."subscriptions"("status");
  CREATE INDEX IF NOT EXISTS "idx_payments_operations_user_id" ON "payments"."operations"("user_id");
  CREATE INDEX IF NOT EXISTS "idx_payments_operations_status" ON "payments"."operations"("status");
  CREATE INDEX IF NOT EXISTS "idx_payments_operations_object_hid" ON "payments"."operations"("object_hid");
  CREATE INDEX IF NOT EXISTS "idx_payments_operations_external_operation_id" ON "payments"."operations"("external_operation_id");

  -- Drop old tables from public schema if they exist (handle with care in real migrations)
  -- This part is tricky for an automated script. Usually, you'd create new tables, migrate data, then drop old.
  -- For now, assuming this script is run on a fresh setup or after manual data migration.
  -- If this were a live system, you would:
  -- 1. Create new tables in payments schema.
  -- 2. Migrate data from public.payment_methods -> payments.methods (transforming provider_name to provider_id requires lookup logic not suitable for pure SQL here).
  -- 3. Same for public.subscriptions and public.payments.
  -- 4. Drop old public tables.
  -- For this script, we'll assume direct creation in the new schema and structure.
  -- We will handle the drop of old tables in the `down` migration or assume they are handled manually for existing data.
`;

const tablesToTrackPayload = [
  { type: "pg_track_table", args: { schema: "payments", name: "providers" } },
  { type: "pg_track_table", args: { schema: "payments", name: "methods" } },
  { type: "pg_track_table", args: { schema: "payments", name: "plans" } },
  { type: "pg_track_table", args: { schema: "payments", name: "subscriptions" } },
  { type: "pg_track_table", args: { schema: "payments", name: "operations" } }
];

const relationshipsPayload = [
  // Relationships for payments.providers
  {
    type: "pg_create_object_relationship",
    args: { table: { schema: "payments", name: "providers" }, name: "user", using: { foreign_key_constraint_on: "user_id" } }
  },
  {
    type: "pg_create_array_relationship",
    args: { table: { schema: "payments", name: "providers" }, name: "methods", using: { foreign_key_constraint_on: { table: { schema: "payments", name: "methods" }, column: "provider_id" } } }
  },
  {
    type: "pg_create_array_relationship",
    args: { table: { schema: "payments", name: "providers" }, name: "subscriptions", using: { foreign_key_constraint_on: { table: { schema: "payments", name: "subscriptions" }, column: "provider_id" } } }
  },
  {
    type: "pg_create_array_relationship",
    args: { table: { schema: "payments", name: "providers" }, name: "operations", using: { foreign_key_constraint_on: { table: { schema: "payments", name: "operations" }, column: "provider_id" } } }
  },

  // Relationships for payments.methods
  {
    type: "pg_create_object_relationship",
    args: { table: { schema: "payments", name: "methods" }, name: "user", using: { foreign_key_constraint_on: "user_id" } }
  },
  {
    type: "pg_create_object_relationship",
    args: { table: { schema: "payments", name: "methods" }, name: "provider", using: { foreign_key_constraint_on: "provider_id" } }
  },
  {
    type: "pg_create_array_relationship",
    args: { table: { schema: "payments", name: "methods" }, name: "subscriptions", using: { foreign_key_constraint_on: { table: { schema: "payments", name: "subscriptions" }, column: "method_id" } } }
  },
  {
    type: "pg_create_array_relationship",
    args: { table: { schema: "payments", name: "methods" }, name: "operations", using: { foreign_key_constraint_on: { table: { schema: "payments", name: "operations" }, column: "method_id" } } }
  },

  // Relationships for payments.plans
  {
    type: "pg_create_object_relationship",
    args: { table: { schema: "payments", name: "plans" }, name: "user", using: { foreign_key_constraint_on: "user_id" } }
  },
  {
    type: "pg_create_array_relationship",
    args: { table: { schema: "payments", name: "plans" }, name: "subscriptions", using: { foreign_key_constraint_on: { table: { schema: "payments", name: "subscriptions" }, column: "plan_id" } } }
  },

  // Relationships for payments.subscriptions
  {
    type: "pg_create_object_relationship",
    args: { table: { schema: "payments", name: "subscriptions" }, name: "user", using: { foreign_key_constraint_on: "user_id" } }
  },
  {
    type: "pg_create_object_relationship",
    args: { table: { schema: "payments", name: "subscriptions" }, name: "method", using: { foreign_key_constraint_on: "method_id" } }
  },
  {
    type: "pg_create_object_relationship",
    args: { table: { schema: "payments", name: "subscriptions" }, name: "plan", using: { foreign_key_constraint_on: "plan_id" } }
  },
  {
    type: "pg_create_object_relationship",
    args: { table: { schema: "payments", name: "subscriptions" }, name: "provider", using: { foreign_key_constraint_on: "provider_id" } }
  },
  {
    type: "pg_create_array_relationship",
    args: { table: { schema: "payments", name: "subscriptions" }, name: "operations", using: { foreign_key_constraint_on: { table: { schema: "payments", name: "operations" }, column: "subscription_id" } } }
  },

  // Relationships for payments.operations
  {
    type: "pg_create_object_relationship",
    args: { table: { schema: "payments", name: "operations" }, name: "user", using: { foreign_key_constraint_on: "user_id" } }
  },
  {
    type: "pg_create_object_relationship",
    args: { table: { schema: "payments", name: "operations" }, name: "method", using: { foreign_key_constraint_on: "method_id" } }
  },
  {
    type: "pg_create_object_relationship",
    args: { table: { schema: "payments", name: "operations" }, name: "provider", using: { foreign_key_constraint_on: "provider_id" } }
  },
  {
    type: "pg_create_object_relationship",
    args: { table: { schema: "payments", name: "operations" }, name: "subscription", using: { foreign_key_constraint_on: "subscription_id" } }
  },

  // Array relationships from public.users table to new payments schema tables
  {
    type: "pg_create_array_relationship",
    args: { table: { schema: "public", name: "users" }, name: "payment_providers", using: { foreign_key_constraint_on: { table: { schema: "payments", name: "providers" }, column: "user_id" } } }
  },
  {
    type: "pg_create_array_relationship",
    args: { table: { schema: "public", name: "users" }, name: "payment_methods", using: { foreign_key_constraint_on: { table: { schema: "payments", name: "methods" }, column: "user_id" } } }
  },
  {
    type: "pg_create_array_relationship",
    args: { table: { schema: "public", name: "users" }, name: "payment_operations", using: { foreign_key_constraint_on: { table: { schema: "payments", name: "operations" }, column: "user_id" } } }
  },
  {
    type: "pg_create_array_relationship",
    args: { table: { schema: "public", name: "users" }, name: "subscription_plans_created", using: { foreign_key_constraint_on: { table: { schema: "payments", name: "plans" }, column: "user_id" } } }
  },
  {
    type: "pg_create_array_relationship",
    args: { table: { schema: "public", name: "users" }, name: "subscriptions", using: { foreign_key_constraint_on: { table: { schema: "payments", name: "subscriptions" }, column: "user_id" } } }
  }
];

const permissionsPayload = [
  // --- Permissions for role 'user' ---
  // payments.providers (users typically cannot see or manage these directly, only admins or backend)
  // If users were to have their own provider configs, select would be X-Hasura-User-Id

  // payments.methods
  {
    type: "pg_create_select_permission",
    args: { table: { schema: "payments", name: "methods" }, role: "user", permission: { columns: ["id", "provider_id", "external_id", "type", "details", "is_default", "is_recurrent_ready", "expires_at", "status", "created_at", "updated_at"], filter: { "user_id": { "_eq": "X-Hasura-User-Id" } } } }
  },
  {
    type: "pg_create_insert_permission",
    args: { table: { schema: "payments", name: "methods" }, role: "user", permission: { check: { "user_id": { "_eq": "X-Hasura-User-Id" } }, set: { "user_id": "X-Hasura-User-Id" }, columns: ["provider_id", "external_id", "type", "details", "is_default", "is_recurrent_ready", "recurrent_details", "expires_at", "status"] } }
  },
  {
    type: "pg_create_update_permission",
    args: { table: { schema: "payments", name: "methods" }, role: "user", permission: { filter: { "user_id": { "_eq": "X-Hasura-User-Id" } }, check: {}, columns: ["details", "is_default", "is_recurrent_ready", "recurrent_details", "expires_at", "status"] } }
  },
  {
    type: "pg_create_delete_permission",
    args: { table: { schema: "payments", name: "methods" }, role: "user", permission: { filter: { "user_id": { "_eq": "X-Hasura-User-Id" } } } }
  },

  // payments.plans
  {
    type: "pg_create_select_permission",
    args: { table: { schema: "payments", name: "plans" }, role: "user", permission: { columns: "*", filter: { "_or": [{ "user_id": { "_is_null": true }, "active": {"_eq": true} }, { "user_id": { "_eq": "X-Hasura-User-Id" }, "active": {"_eq": true} }] } } }
  },
  // Users generally don't create/update/delete public plans. Custom plans for users might be managed by admin or specific logic.

  // payments.subscriptions
  {
    type: "pg_create_select_permission",
    args: { table: { schema: "payments", name: "subscriptions" }, role: "user", permission: { columns: "*", filter: { "user_id": { "_eq": "X-Hasura-User-Id" } } } }
  },
  {
    type: "pg_create_insert_permission",
    args: { table: { schema: "payments", name: "subscriptions" }, role: "user", permission: { check: { "user_id": { "_eq": "X-Hasura-User-Id" } }, set: { "user_id": "X-Hasura-User-Id" }, columns: ["method_id", "plan_id", "provider_id", "status", "current_period_start", "current_period_end", "trial_ends_at", "object_hid", "metadata"] } }
  },
  {
    type: "pg_create_update_permission",
    args: { table: { schema: "payments", name: "subscriptions" }, role: "user", permission: { filter: { "user_id": { "_eq": "X-Hasura-User-Id" } }, check: { "user_id": { "_eq": "X-Hasura-User-Id" } }, columns: ["method_id", "cancel_at_period_end", "metadata"] } } // User can change payment method or cancel
  },

  // payments.operations
  {
    type: "pg_create_select_permission",
    args: { table: { schema: "payments", name: "operations" }, role: "user", permission: { columns: ["id", "method_id", "provider_id", "external_operation_id", "subscription_id", "amount", "currency", "status", "description", "object_hid", "initiated_at", "paid_at", "metadata", "created_at", "updated_at"], filter: { "user_id": { "_eq": "X-Hasura-User-Id" } } } }
  },
  {
    type: "pg_create_insert_permission",
    args: { table: { schema: "payments", name: "operations" }, role: "user", permission: { check: { "user_id": { "_eq": "X-Hasura-User-Id" } }, set: { "user_id": "X-Hasura-User-Id" }, columns: ["method_id", "provider_id", "subscription_id", "amount", "currency", "status", "description", "object_hid", "initiated_at", "metadata"] } },
  },
  // User cannot update or delete operations directly; this is done via provider actions/webhooks processed by the backend.

  // --- Permissions for role 'admin' (example, likely needs more granularity) ---
  // Full access to all tables in 'payments' schema for 'admin' role
  ...(["providers", "methods", "plans", "subscriptions", "operations"].flatMap(tableName => [
    { type: "pg_create_select_permission", args: { table: { schema: "payments", name: tableName }, role: "admin", permission: { columns: "*", filter: {} } } },
    { type: "pg_create_insert_permission", args: { table: { schema: "payments", name: tableName }, role: "admin", permission: { check: {}, columns: "*" } } },
    { type: "pg_create_update_permission", args: { table: { schema: "payments", name: tableName }, role: "admin", permission: { filter: {}, check: {}, columns: "*" } } },
    { type: "pg_create_delete_permission", args: { table: { schema: "payments", name: tableName }, role: "admin", permission: { filter: {} } } }
  ]))
];

async function applySQLSchema(hasura: Hasura) {
  debug('Applying SQL schema for payments...');
  // IMPORTANT: If old tables (e.g. public.payment_methods) exist and contain data,
  // this script as-is will NOT migrate that data. Data migration needs separate handling.
  // This SQL assumes we are creating afresh in the `payments` schema.
  // Dropping old public tables should be done carefully after data migration.
  await hasura.sql(sqlSchema, 'default', false); // cascade = false, as we are creating schema and tables within it.
  debug('SQL schema for payments applied successfully.');
}

async function trackPaymentTables(hasura: Hasura) {
  debug('Tracking payment tables in "payments" schema...');
  const trackArgs = tablesToTrackPayload.map(payload => ({ ...payload, source: "default" }));
  await hasura.v1({ type: "bulk", args: trackArgs });
  debug('Payment tables in "payments" schema tracked successfully.');
}

async function createPaymentRelationships(hasura: Hasura) {
  debug('Creating relationships for payment tables in "payments" schema...');
  const relationshipArgs = relationshipsPayload.map(payload => ({ ...payload, source: "default" }));
  await hasura.v1({ type: "bulk", args: relationshipArgs });
  debug('Relationships for payment tables in "payments" schema created successfully.');
}

async function applyPaymentPermissions(hasura: Hasura) {
  debug('Applying permissions for payment tables in "payments" schema...');
  const permissionArgs = permissionsPayload.map(payload => ({ ...payload, source: "default" }));
  await hasura.v1({ type: "bulk", args: permissionArgs });
  debug('Permissions for payment tables in "payments" schema applied successfully.');
}

export async function up(customHasura?: Hasura) {
  debug(`Starting migration: ${MIGRATION_NAME} - UP (with new payments schema)`);
  const hasura = customHasura || new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
    secret: process.env.HASURA_ADMIN_SECRET!,
  });

  try {
    // Note: The order here is crucial.
    // 1. Create schema and tables.
    // 2. Track tables.
    // 3. Create relationships.
    // 4. Apply permissions.

    // Before applying the new schema, if there are old tables in 'public' schema
    // like 'public.payment_methods', 'public.subscriptions', 'public.payments', 'public.subscription_plans'
    // they need to be UNTRACKED first if they were tracked.
    // This script doesn't automatically untrack old public tables.
    // This is a significant schema change. For a live system, a more detailed plan involving:
    //    a. Untracking old public tables.
    //    b. (Optional) Renaming old public tables (e.g., to _old suffix).
    //    c. Applying this new schema.
    //    d. Migrating data from _old tables to new payments.schema tables (complex, requires mapping provider_name to provider_id).
    //    e. Dropping _old tables.
    // This script assumes a cleaner state or that data migration is handled outside.

    await applySQLSchema(hasura);
    await trackPaymentTables(hasura);
    await createPaymentRelationships(hasura);
    await applyPaymentPermissions(hasura);

    debug(`Migration ${MIGRATION_NAME} - UP (with new payments schema) completed successfully.`);
    return true;
  } catch (error) {
    console.error('Error during migration ' + MIGRATION_NAME + ' - UP (new payments schema):', error);
    debug('Migration ' + MIGRATION_NAME + ' - UP (new payments schema) failed.');
    throw error;
  }
} 