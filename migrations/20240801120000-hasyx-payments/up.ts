import { Hasura } from 'hasyx/lib/hasura'; // или правильный путь к вашему Hasura SDK
import Debug from 'hasyx/lib/debug';

const debug = Debug('migration:up-payments');

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
  COMMENT ON COLUMN "public"."payment_methods"."external_id" IS 'ID метода оплаты во внешней системе';
  COMMENT ON COLUMN "public"."payment_methods"."type" IS 'e.g., "card", "ton_wallet", "sbp"';
  COMMENT ON COLUMN "public"."payment_methods"."details" IS 'Частично маскированные данные для отображения';
  COMMENT ON COLUMN "public"."payment_methods"."recurrent_details" IS 'Специфичные для провайдера данные для рекуррентных списаний (могут требовать шифрования)';
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
      "user_id" uuid, -- Для кастомных планов конкретного пользователя
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("id"),
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE SET NULL ON DELETE SET NULL
  );
  COMMENT ON COLUMN "public"."subscription_plans"."interval" IS 'e.g., "day", "week", "month", "year"';
  COMMENT ON COLUMN "public"."subscription_plans"."active" IS 'Можно ли на этот план подписаться сейчас';
  COMMENT ON COLUMN "public"."subscription_plans"."user_id" IS 'Если NULL, план общедоступен. Иначе - кастомный для пользователя.';

  CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL,
      "payment_method_id" uuid NOT NULL,
      "plan_id" uuid,
      "provider_name" text NOT NULL, -- e.g., tbank, internal (для PAYG или ручного управления)
      "external_subscription_id" text, -- ID подписки во внешней системе, если есть
      "status" text NOT NULL, -- e.g., trialing, active, past_due, unpaid, canceled, ended, paused
      "current_period_start" timestamptz,
      "current_period_end" timestamptz,
      "trial_ends_at" timestamptz,
      "cancel_at_period_end" boolean NOT NULL DEFAULT false,
      "canceled_at" timestamptz,
      "ended_at" timestamptz, -- когда подписка фактически закончилась
      "object_hid" text, -- к чему относится подписка
      "metadata" jsonb,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("id"),
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE,
      FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON UPDATE CASCADE ON DELETE RESTRICT,
      FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON UPDATE CASCADE ON DELETE SET NULL
  );
  COMMENT ON COLUMN "public"."subscriptions"."provider_name" IS 'e.g., "dummy", "tbank", "internal"';
  COMMENT ON COLUMN "public"."subscriptions"."external_subscription_id" IS 'ID подписки во внешней системе, если есть';
  COMMENT ON COLUMN "public"."subscriptions"."status" IS 'e.g., "trialing", "active", "past_due", "unpaid", "canceled", "ended", "paused"';

  CREATE TABLE IF NOT EXISTS "public"."payments" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL,
      "payment_method_id" uuid, -- может быть null для разовых платежей без сохранения метода
      "provider_name" text NOT NULL,
      "external_payment_id" text, -- ID платежа во внешней системе, может быть не сразу
      "subscription_id" uuid, -- если платеж связан с подпиской (например, возобновление)
      "amount" numeric NOT NULL CHECK (amount >= 0),
      "currency" text NOT NULL,
      "status" text NOT NULL, -- e.g., pending_initiation, pending_confirmation, succeeded, failed, canceled, refunded
      "description" text,
      "object_hid" text, -- что оплачивается
      "provider_request_details" jsonb,
      "provider_response_details" jsonb,
      "error_message" text,
      "initiated_at" timestamptz DEFAULT now(),
      "paid_at" timestamptz,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("id"),
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE,
      FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON UPDATE CASCADE ON DELETE SET NULL,
      FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON UPDATE CASCADE ON DELETE SET NULL
  );
  COMMENT ON COLUMN "public"."payments"."external_payment_id" IS 'ID платежа во внешней системе, может быть не сразу';
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

const metadataPayload = {
  type: "bulk",
  source: "default", // Убедитесь, что это имя вашего источника данных в Hasura
  args: [
    // Track tables
    {
      type: "pg_track_table",
      args: { schema: "public", name: "payment_methods" }
    },
    {
      type: "pg_track_table",
      args: { schema: "public", name: "subscription_plans" }
    },
    {
      type: "pg_track_table",
      args: { schema: "public", name: "subscriptions" }
    },
    {
      type: "pg_track_table",
      args: { schema: "public", name: "payments" }
    },

    // Relationships for payment_methods
    {
        type: "pg_create_object_relationship",
        args: { table: {schema: "public", name: "payment_methods"}, name: "user", using: { foreign_key_constraint_on: "user_id" } }
    },
    {
        type: "pg_create_array_relationship",
        args: { table: {schema: "public", name: "payment_methods"}, name: "subscriptions", using: { foreign_key_constraint_on: { table: {schema: "public", name: "subscriptions"}, column: "payment_method_id" } } }
    },
    {
        type: "pg_create_array_relationship",
        args: { table: {schema: "public", name: "payment_methods"}, name: "payments", using: { foreign_key_constraint_on: { table: {schema: "public", name: "payments"}, column: "payment_method_id" } } }
    },

    // Relationships for subscription_plans
    {
        type: "pg_create_object_relationship",
        args: { table: {schema: "public", name: "subscription_plans"}, name: "user", using: { foreign_key_constraint_on: "user_id" } }
    },
    {
        type: "pg_create_array_relationship",
        args: { table: {schema: "public", name: "subscription_plans"}, name: "subscriptions", using: { foreign_key_constraint_on: { table: {schema: "public", name: "subscriptions"}, column: "plan_id" } } }
    },

    // Relationships for subscriptions
    {
        type: "pg_create_object_relationship",
        args: { table: {schema: "public", name: "subscriptions"}, name: "user", using: { foreign_key_constraint_on: "user_id" } }
    },
    {
        type: "pg_create_object_relationship",
        args: { table: {schema: "public", name: "subscriptions"}, name: "payment_method", using: { foreign_key_constraint_on: "payment_method_id" } }
    },
    {
        type: "pg_create_object_relationship",
        args: { table: {schema: "public", name: "subscriptions"}, name: "plan", using: { foreign_key_constraint_on: "plan_id" } }
    },
    {
        type: "pg_create_array_relationship",
        args: { table: {schema: "public", name: "subscriptions"}, name: "payments", using: { foreign_key_constraint_on: { table: {schema: "public", name: "payments"}, column: "subscription_id" } } }
    },

    // Relationships for payments
    {
        type: "pg_create_object_relationship",
        args: { table: {schema: "public", name: "payments"}, name: "user", using: { foreign_key_constraint_on: "user_id" } }
    },
    {
        type: "pg_create_object_relationship",
        args: { table: {schema: "public", name: "payments"}, name: "payment_method", using: { foreign_key_constraint_on: "payment_method_id" } }
    },
    {
        type: "pg_create_object_relationship",
        args: { table: {schema: "public", name: "payments"}, name: "subscription", using: { foreign_key_constraint_on: "subscription_id" } }
    },
    
    // --- Permissions for role 'user' ---
    // payment_methods
    {
      type: "pg_create_select_permission",
      args: { table: {schema: "public", name: "payment_methods"}, role: "user", permission: { columns: "*", filter: { "user_id": { "_eq": "X-Hasura-User-Id" } } } }
    },
    {
      type: "pg_create_insert_permission",
      args: { table: {schema: "public", name: "payment_methods"}, role: "user", permission: { check: { "user_id": { "_eq": "X-Hasura-User-Id" } }, set: {"user_id": "X-Hasura-User-Id"}, columns: ["provider_name", "external_id", "type", "details", "is_default", "is_recurrent_ready", "recurrent_details", "expires_at", "status"] } }
    },
    {
      type: "pg_create_update_permission",
      args: { table: {schema: "public", name: "payment_methods"}, role: "user", permission: { filter: { "user_id": { "_eq": "X-Hasura-User-Id" } }, check: null, columns: ["details", "is_default", "is_recurrent_ready", "recurrent_details", "expires_at", "status"] } }
    },
    {
      type: "pg_create_delete_permission",
      args: { table: {schema: "public", name: "payment_methods"}, role: "user", permission: { filter: { "user_id": { "_eq": "X-Hasura-User-Id" } } } }
    },
    // subscription_plans
    {
      type: "pg_create_select_permission",
      args: { table: {schema: "public", name: "subscription_plans"}, role: "user", permission: { columns: "*", filter: { "_or": [{ "user_id": { "_is_null": true } }, { "user_id": { "_eq": "X-Hasura-User-Id" } }] } } }
    },
    // subscriptions
    {
      type: "pg_create_select_permission",
      args: { table: {schema: "public", name: "subscriptions"}, role: "user", permission: { columns: "*", filter: { "user_id": { "_eq": "X-Hasura-User-Id" } } } }
    },
    {
      type: "pg_create_insert_permission", // User can create subscriptions for themselves
      args: { table: {schema: "public", name: "subscriptions"}, role: "user", permission: { check: { "user_id": { "_eq": "X-Hasura-User-Id" } }, set: {"user_id": "X-Hasura-User-Id"}, columns: ["payment_method_id", "plan_id", "provider_name", "status", "current_period_start", "current_period_end", "trial_ends_at", "object_hid", "metadata"] } }
    },
    {
      type: "pg_create_update_permission", // User can update specific fields like cancel_at_period_end
      args: { table: {schema: "public", name: "subscriptions"}, role: "user", permission: { filter: { "user_id": { "_eq": "X-Hasura-User-Id" } }, check: null, columns: ["payment_method_id", "cancel_at_period_end", "metadata"] } }
    },
    // payments
    {
      type: "pg_create_select_permission",
      args: { table: {schema: "public", name: "payments"}, role: "user", permission: { columns: "*", filter: { "user_id": { "_eq": "X-Hasura-User-Id" } } } }
    },
    {
      type: "pg_create_insert_permission",
      args: { table: {schema: "public", name: "payments"}, role: "user", permission: { check: { "user_id": { "_eq": "X-Hasura-User-Id" } }, set: {"user_id": "X-Hasura-User-Id"}, columns: ["payment_method_id", "provider_name", "subscription_id", "amount", "currency", "status", "description", "object_hid", "initiated_at", "metadata"] } }
    },
    // User cannot update or delete payments directly, only through provider actions/webhooks

    // --- Permissions for role 'admin' (full access example) ---
    {
      type: "pg_create_select_permission",
      args: { table: {schema: "public", name: "payment_methods"}, role: "admin", permission: { columns: "*", filter: {} } }
    },
    {
      type: "pg_create_insert_permission",
      args: { table: {schema: "public", name: "payment_methods"}, role: "admin", permission: { check: null, columns: "*" } }
    },
    {
      type: "pg_create_update_permission",
      args: { table: {schema: "public", name: "payment_methods"}, role: "admin", permission: { check: null, columns: "*" } }
    },
    {
      type: "pg_create_delete_permission",
      args: { table: {schema: "public", name: "payment_methods"}, role: "admin", permission: { filter: {} } }
    },
    {
      type: "pg_create_select_permission",
      args: { table: {schema: "public", name: "subscription_plans"}, role: "admin", permission: { columns: "*", filter: {} } }
    },
    {
      type: "pg_create_insert_permission",
      args: { table: {schema: "public", name: "subscription_plans"}, role: "admin", permission: { check: null, columns: "*" } }
    },
    {
      type: "pg_create_update_permission",
      args: { table: {schema: "public", name: "subscription_plans"}, role: "admin", permission: { check: null, columns: "*" } }
    },
    {
      type: "pg_create_delete_permission",
      args: { table: {schema: "public", name: "subscription_plans"}, role: "admin", permission: { filter: {} } }
    },
    {
      type: "pg_create_select_permission",
      args: { table: {schema: "public", name: "subscriptions"}, role: "admin", permission: { columns: "*", filter: {} } }
    },
    {
      type: "pg_create_insert_permission",
      args: { table: {schema: "public", name: "subscriptions"}, role: "admin", permission: { check: null, columns: "*" } }
    },
    {
      type: "pg_create_update_permission",
      args: { table: {schema: "public", name: "subscriptions"}, role: "admin", permission: { check: null, columns: "*" } }
    },
    {
      type: "pg_create_delete_permission",
      args: { table: {schema: "public", name: "subscriptions"}, role: "admin", permission: { filter: {} } }
    },
    {
      type: "pg_create_select_permission",
      args: { table: {schema: "public", name: "payments"}, role: "admin", permission: { columns: "*", filter: {} } }
    },
    {
      type: "pg_create_insert_permission",
      args: { table: {schema: "public", name: "payments"}, role: "admin", permission: { check: null, columns: "*" } }
    },
    {
      type: "pg_create_update_permission",
      args: { table: {schema: "public", name: "payments"}, role: "admin", permission: { check: null, columns: "*" } }
    },
    {
      type: "pg_create_delete_permission",
      args: { table: {schema: "public", name: "payments"}, role: "admin", permission: { filter: {} } }
    }
  ]
};

export async function up() {
  debug(`Starting migration: ${MIGRATION_NAME} - UP`);
  const hasura = new Hasura({
    url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
    secret: process.env.HASURA_ADMIN_SECRET!,
  });

  try {
    debug('Applying SQL schema...');
    await hasura.sql(sqlSchema);
    debug('SQL schema applied successfully.');

    debug('Applying Hasura metadata (tracking tables, relationships, permissions)...');
    await hasura.v1(metadataPayload as any); // Приведение типа, если есть расхождения с SDK
    debug('Hasura metadata applied successfully.');

    debug(`Migration ${MIGRATION_NAME} - UP completed successfully.`);
    return true;
  } catch (error) {
    console.error(`Error during migration ${MIGRATION_NAME} - UP:`, error);
    debug(`Migration ${MIGRATION_NAME} - UP failed.`);
    // Consider re-throwing the error if the migration CLI should stop on failure
    throw error; 
  }
}

// Если вы используете этот файл напрямую с tsx, например: tsx migrations/..../up.ts
if (require.main === module) {
  // Загрузка .env файла, если он есть в корне проекта
  const dotenv = require('dotenv');
  const path = require('path');
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  
  up().catch(e => console.error(e));
} 