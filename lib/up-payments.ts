import { Hasura } from './hasura';
import Debug from './debug';

const debug = Debug('lib:up-payments'); // Changed debug namespace
const MIGRATION_NAME = '20240801120000-hasyx-payments';

const sqlSchema = `
  CREATE TABLE IF NOT EXISTS "public"."payment_methods" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL,
      "provider_name" text NOT NULL,
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
      UNIQUE ("user_id", "provider_name", "external_id", "type")
  );
  COMMENT ON COLUMN "public"."payment_methods"."provider_name" IS 'e.g., "dummy", "tbank", "linkcom", "ton_api"';
  COMMENT ON COLUMN "public"."payment_methods"."external_id" IS 'Payment method ID in the external system';
  COMMENT ON COLUMN "public"."payment_methods"."type" IS 'e.g., "card", "ton_wallet", "sbp"';
  COMMENT ON COLUMN "public"."payment_methods"."details" IS 'Partially masked data for display';
  COMMENT ON COLUMN "public"."payment_methods"."recurrent_details" IS 'Provider-specific data for recurrent payments (may require encryption)';
  COMMENT ON COLUMN "public"."payment_methods"."status" IS 'e.g., "active", "expired", "revoked"';

  CREATE TABLE IF NOT EXISTS "public"."subscription_plans" (
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
  COMMENT ON COLUMN "public"."subscription_plans"."interval" IS 'e.g., "day", "week", "month", "year"';
  COMMENT ON COLUMN "public"."subscription_plans"."active" IS 'Whether this plan can be subscribed to currently';
  COMMENT ON COLUMN "public"."subscription_plans"."user_id" IS 'If NULL, the plan is publicly available. Otherwise, it is custom for the user.';

  CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL,
      "payment_method_id" uuid NOT NULL,
      "plan_id" uuid,
      "provider_name" text NOT NULL, -- e.g., tbank, internal (for PAYG or manual management)
      "external_subscription_id" text, -- Subscription ID in the external system, if any
      "status" text NOT NULL, -- e.g., trialing, active, past_due, unpaid, canceled, ended, paused
      "current_period_start" timestamptz,
      "current_period_end" timestamptz,
      "trial_ends_at" timestamptz,
      "cancel_at_period_end" boolean NOT NULL DEFAULT false,
      "canceled_at" timestamptz,
      "ended_at" timestamptz, -- when the subscription actually ended
      "object_hid" text, -- what the subscription is for
      "metadata" jsonb,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("id"),
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE,
      FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON UPDATE CASCADE ON DELETE RESTRICT,
      FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON UPDATE CASCADE ON DELETE SET NULL
  );
  COMMENT ON COLUMN "public"."subscriptions"."provider_name" IS 'e.g., "dummy", "tbank", "internal"';
  COMMENT ON COLUMN "public"."subscriptions"."external_subscription_id" IS 'Subscription ID in the external system, if any';
  COMMENT ON COLUMN "public"."subscriptions"."status" IS 'e.g., "trialing", "active", "past_due", "unpaid", "canceled", "ended", "paused"';

  CREATE TABLE IF NOT EXISTS "public"."payments" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL,
      "payment_method_id" uuid, -- can be null for one-time payments without saving the method
      "provider_name" text NOT NULL,
      "external_payment_id" text, -- Payment ID in the external system, may not be available immediately
      "subscription_id" uuid, -- if the payment is related to a subscription (e.g., renewal)
      "amount" numeric NOT NULL CHECK (amount >= 0),
      "currency" text NOT NULL,
      "status" text NOT NULL, -- e.g., pending_initiation, pending_confirmation, succeeded, failed, canceled, refunded
      "description" text,
      "object_hid" text, -- what is being paid for
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
      FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON UPDATE CASCADE ON DELETE SET NULL,
      FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON UPDATE CASCADE ON DELETE SET NULL
  );
  COMMENT ON COLUMN "public"."payments"."external_payment_id" IS 'Payment ID in the external system, may not be available immediately';
  COMMENT ON COLUMN "public"."payments"."status" IS 'e.g., "pending_initiation", "pending_confirmation", "succeeded", "failed", "canceled", "refunded"';

  -- Indexes
  CREATE INDEX IF NOT EXISTS "idx_payment_methods_user_id" ON "public"."payment_methods"("user_id");
  CREATE INDEX IF NOT EXISTS "idx_payment_methods_provider_external" ON "public"."payment_methods"("provider_name", "external_id");
  CREATE INDEX IF NOT EXISTS "idx_subscription_plans_user_id" ON "public"."subscription_plans"("user_id");
  CREATE INDEX IF NOT EXISTS "idx_subscriptions_user_id" ON "public"."subscriptions"("user_id");
  CREATE INDEX IF NOT EXISTS "idx_subscriptions_status" ON "public"."subscriptions"("status");
  CREATE INDEX IF NOT EXISTS "idx_payments_user_id" ON "public"."payments"("user_id");
  CREATE INDEX IF NOT EXISTS "idx_payments_status" ON "public"."payments"("status");
  CREATE INDEX IF NOT EXISTS "idx_payments_object_hid" ON "public"."payments"("object_hid");
  CREATE INDEX IF NOT EXISTS "idx_payments_external_payment_id" ON "public"."payments"("external_payment_id");
`;

const tablesToTrackPayload = [
  { type: "pg_track_table", args: { schema: "public", name: "payment_methods" } },
  { type: "pg_track_table", args: { schema: "public", name: "subscription_plans" } },
  { type: "pg_track_table", args: { schema: "public", name: "subscriptions" } },
  { type: "pg_track_table", args: { schema: "public", name: "payments" } }
];

const relationshipsPayload = [
  // Relationships for payment_methods
  {
    type: "pg_create_object_relationship",
    args: { table: { schema: "public", name: "payment_methods" }, name: "user", using: { foreign_key_constraint_on: "user_id" } }
  },
  {
    type: "pg_create_array_relationship",
    args: { table: { schema: "public", name: "payment_methods" }, name: "subscriptions", using: { foreign_key_constraint_on: { table: { schema: "public", name: "subscriptions" }, column: "payment_method_id" } } }
  },
  {
    type: "pg_create_array_relationship",
    args: { table: { schema: "public", name: "payment_methods" }, name: "payments", using: { foreign_key_constraint_on: { table: { schema: "public", name: "payments" }, column: "payment_method_id" } } }
  },
  // Relationships for subscription_plans
  {
    type: "pg_create_object_relationship",
    args: { table: { schema: "public", name: "subscription_plans" }, name: "user", using: { foreign_key_constraint_on: "user_id" } }
  },
  {
    type: "pg_create_array_relationship",
    args: { table: { schema: "public", name: "subscription_plans" }, name: "subscriptions", using: { foreign_key_constraint_on: { table: { schema: "public", name: "subscriptions" }, column: "plan_id" } } }
  },
  // Relationships for subscriptions
  {
    type: "pg_create_object_relationship",
    args: { table: { schema: "public", name: "subscriptions" }, name: "user", using: { foreign_key_constraint_on: "user_id" } }
  },
  {
    type: "pg_create_object_relationship",
    args: { table: { schema: "public", name: "subscriptions" }, name: "payment_method", using: { foreign_key_constraint_on: "payment_method_id" } }
  },
  {
    type: "pg_create_object_relationship",
    args: { table: { schema: "public", name: "subscriptions" }, name: "plan", using: { foreign_key_constraint_on: "plan_id" } }
  },
  {
    type: "pg_create_array_relationship",
    args: { table: { schema: "public", name: "subscriptions" }, name: "payments", using: { foreign_key_constraint_on: { table: { schema: "public", name: "payments" }, column: "subscription_id" } } }
  },
  // Relationships for payments
  {
    type: "pg_create_object_relationship",
    args: { table: { schema: "public", name: "payments" }, name: "user", using: { foreign_key_constraint_on: "user_id" } }
  },
  {
    type: "pg_create_object_relationship",
    args: { table: { schema: "public", name: "payments" }, name: "payment_method", using: { foreign_key_constraint_on: "payment_method_id" } }
  },
  {
    type: "pg_create_object_relationship",
    args: { table: { schema: "public", name: "payments" }, name: "subscription", using: { foreign_key_constraint_on: "subscription_id" } }
  },
  // Array relationships from users table
  {
    type: "pg_create_array_relationship",
    args: { table: { schema: "public", name: "users" }, name: "payment_methods", using: { foreign_key_constraint_on: { table: { schema: "public", name: "payment_methods" }, column: "user_id" } } }
  },
  {
    type: "pg_create_array_relationship",
    args: { table: { schema: "public", name: "users" }, name: "payments", using: { foreign_key_constraint_on: { table: { schema: "public", name: "payments" }, column: "user_id" } } }
  },
  {
    type: "pg_create_array_relationship",
    args: { table: { schema: "public", name: "users" }, name: "subscription_plans_created", using: { foreign_key_constraint_on: { table: { schema: "public", name: "subscription_plans" }, column: "user_id" } } } // Renamed to avoid conflict if users subscribe to plans
  },
  {
    type: "pg_create_array_relationship",
    args: { table: { schema: "public", name: "users" }, name: "subscriptions", using: { foreign_key_constraint_on: { table: { schema: "public", name: "subscriptions" }, column: "user_id" } } }
  }
];

const permissionsPayload = [
  // --- Permissions for role 'user' ---
  // payment_methods
  {
    type: "pg_create_select_permission",
    args: { table: { schema: "public", name: "payment_methods" }, role: "user", permission: { columns: "*", filter: { "user_id": { "_eq": "X-Hasura-User-Id" } } } }
  },
  {
    type: "pg_create_insert_permission",
    args: { table: { schema: "public", name: "payment_methods" }, role: "user", permission: { check: { "user_id": { "_eq": "X-Hasura-User-Id" } }, set: { "user_id": "X-Hasura-User-Id" }, columns: ["provider_name", "external_id", "type", "details", "is_default", "is_recurrent_ready", "recurrent_details", "expires_at", "status"] } }
  },
  {
    type: "pg_create_update_permission",
    args: { table: { schema: "public", name: "payment_methods" }, role: "user", permission: { filter: { "user_id": { "_eq": "X-Hasura-User-Id" } }, check: {}, columns: ["details", "is_default", "is_recurrent_ready", "recurrent_details", "expires_at", "status"] } }
  },
  {
    type: "pg_create_delete_permission",
    args: { table: { schema: "public", name: "payment_methods" }, role: "user", permission: { filter: { "user_id": { "_eq": "X-Hasura-User-Id" } } } }
  },
  // subscription_plans
  {
    type: "pg_create_select_permission",
    args: { table: { schema: "public", name: "subscription_plans" }, role: "user", permission: { columns: "*", filter: { "_or": [{ "user_id": { "_is_null": true } }, { "user_id": { "_eq": "X-Hasura-User-Id" } }] } } }
  },
  // subscriptions
  {
    type: "pg_create_select_permission",
    args: { table: { schema: "public", name: "subscriptions" }, role: "user", permission: { columns: "*", filter: { "user_id": { "_eq": "X-Hasura-User-Id" } } } }
  },
  {
    type: "pg_create_insert_permission", // User can create subscriptions for themselves
    args: { table: { schema: "public", name: "subscriptions" }, role: "user", permission: { check: { "user_id": { "_eq": "X-Hasura-User-Id" } }, set: { "user_id": "X-Hasura-User-Id" }, columns: ["payment_method_id", "plan_id", "provider_name", "status", "current_period_start", "current_period_end", "trial_ends_at", "object_hid", "metadata"] } }
  },
  {
    type: "pg_create_update_permission", // User can update specific fields like cancel_at_period_end
    args: { table: { schema: "public", name: "subscriptions" }, role: "user", permission: { filter: { "user_id": { "_eq": "X-Hasura-User-Id" } }, check: {}, columns: ["payment_method_id", "cancel_at_period_end", "metadata"] } }
  },
  // payments
  {
    type: "pg_create_select_permission",
    args: { table: { schema: "public", name: "payments" }, role: "user", permission: { columns: "*", filter: { "user_id": { "_eq": "X-Hasura-User-Id" } } } }
  },
  {
    type: "pg_create_insert_permission",
    args: { table: { schema: "public", name: "payments" }, role: "user", permission: { check: { "user_id": { "_eq": "X-Hasura-User-Id" } }, set: { "user_id": "X-Hasura-User-Id" }, columns: ["payment_method_id", "provider_name", "subscription_id", "amount", "currency", "status", "description", "object_hid", "initiated_at", "metadata"] } }
  },
  // User cannot update or delete payments directly, only through provider actions/webhooks

  // --- Permissions for role 'admin' (full access example) ---
  {
    type: "pg_create_select_permission",
    args: { table: { schema: "public", name: "payment_methods" }, role: "admin", permission: { columns: "*", filter: {} } }
  },
  {
    type: "pg_create_insert_permission",
    args: { table: { schema: "public", name: "payment_methods" }, role: "admin", permission: { check: {}, columns: "*" } }
  },
  {
    type: "pg_create_update_permission",
    args: { table: { schema: "public", name: "payment_methods" }, role: "admin", permission: { filter: {}, check: {}, columns: "*" } }
  },
  {
    type: "pg_create_delete_permission",
    args: { table: { schema: "public", name: "payment_methods" }, role: "admin", permission: { filter: {} } }
  },
  {
    type: "pg_create_select_permission",
    args: { table: { schema: "public", name: "subscription_plans" }, role: "admin", permission: { columns: "*", filter: {} } }
  },
  {
    type: "pg_create_insert_permission",
    args: { table: { schema: "public", name: "subscription_plans" }, role: "admin", permission: { check: {}, columns: "*" } }
  },
  {
    type: "pg_create_update_permission",
    args: { table: { schema: "public", name: "subscription_plans" }, role: "admin", permission: { filter: {}, check: {}, columns: "*" } }
  },
  {
    type: "pg_create_delete_permission",
    args: { table: { schema: "public", name: "subscription_plans" }, role: "admin", permission: { filter: {} } }
  },
  {
    type: "pg_create_select_permission",
    args: { table: { schema: "public", name: "subscriptions" }, role: "admin", permission: { columns: "*", filter: {} } }
  },
  {
    type: "pg_create_insert_permission",
    args: { table: { schema: "public", name: "subscriptions" }, role: "admin", permission: { check: {}, columns: "*" } }
  },
  {
    type: "pg_create_update_permission",
    args: { table: { schema: "public", name: "subscriptions" }, role: "admin", permission: { filter: {}, check: {}, columns: "*" } }
  },
  {
    type: "pg_create_delete_permission",
    args: { table: { schema: "public", name: "subscriptions" }, role: "admin", permission: { filter: {} } }
  },
  {
    type: "pg_create_select_permission",
    args: { table: { schema: "public", name: "payments" }, role: "admin", permission: { columns: "*", filter: {} } }
  },
  {
    type: "pg_create_insert_permission",
    args: { table: { schema: "public", name: "payments" }, role: "admin", permission: { check: {}, columns: "*" } }
  },
  {
    type: "pg_create_update_permission",
    args: { table: { schema: "public", name: "payments" }, role: "admin", permission: { filter: {}, check: {}, columns: "*" } }
  },
  {
    type: "pg_create_delete_permission",
    args: { table: { schema: "public", name: "payments" }, role: "admin", permission: { filter: {} } }
  }
];

async function applySQLSchema(hasura: Hasura) {
  debug('Applying SQL schema for payments...');
  await hasura.sql(sqlSchema, 'default', true); // cascade = true
  debug('SQL schema for payments applied successfully.');
}

async function trackPaymentTables(hasura: Hasura) {
  debug('Tracking payment tables...');
  const trackArgs = tablesToTrackPayload.map(payload => ({ ...payload, source: "default" }));
  await hasura.v1({ type: "bulk", args: trackArgs });
  debug('Payment tables tracked successfully.');
}

async function createPaymentRelationships(hasura: Hasura) {
  debug('Creating relationships for payment tables...');
  const relationshipArgs = relationshipsPayload.map(payload => ({ ...payload, source: "default" }));
  await hasura.v1({ type: "bulk", args: relationshipArgs });
  debug('Relationships for payment tables created successfully.');
}

async function applyPaymentPermissions(hasura: Hasura) {
  debug('Applying permissions for payment tables...');
  const permissionArgs = permissionsPayload.map(payload => ({ ...payload, source: "default" }));
  await hasura.v1({ type: "bulk", args: permissionArgs });
  debug('Permissions for payment tables applied successfully.');
}

export async function up(customHasura?: Hasura) {
  debug(`Starting migration: ${MIGRATION_NAME} - UP`);
  const hasura = customHasura || new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
    secret: process.env.HASURA_ADMIN_SECRET!,
  });

  try {
    await applySQLSchema(hasura);
    await trackPaymentTables(hasura);
    await createPaymentRelationships(hasura);
    await applyPaymentPermissions(hasura);

    debug(`Migration ${MIGRATION_NAME} - UP completed successfully.`);
    return true;
  } catch (error) {
    console.error('Error during migration ' + MIGRATION_NAME + ' - UP:', error);
    debug('Migration ' + MIGRATION_NAME + ' - UP failed.');
    throw error;
  }
} 