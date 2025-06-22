# Events System Documentation

The Hasyx Events system provides a seamless integration between Hasura Event Triggers, Cron Triggers, and Next.js API routes, allowing you to handle database changes in real-time and execute scheduled tasks with automatic synchronization and secure webhook handling.

## Overview

The Events system consists of three main components:

1. **Trigger Definitions** - JSON configuration files in the `/events` directory
2. **CLI Commands** - Synchronization tools (`npx hasyx events`)
3. **API Route Handlers** - Next.js routes that process incoming events from Hasura

## Supported Trigger Types

### Event Triggers (Data Triggers)
Handle database changes in real-time when data is inserted, updated, or deleted.

### Cron Triggers (Scheduled Tasks)
Execute webhook calls on a schedule using cron expressions for recurring tasks.

## Architecture Flow

**Event Triggers:**
```
Database Change → Hasura Event Trigger → Webhook → Next.js API Route → Your Handler
```

**Cron Triggers:**
```
Cron Schedule → Hasura Cron Trigger → Webhook → Next.js API Route → Your Handler
```

## Trigger Definitions

### Directory Structure

```
/events/
├── users.json           # User table events (Event Trigger)
├── accounts.json        # Account table events (Event Trigger)
├── notify.json          # Notification events (Event Trigger)
└── subscription-billing.json # Billing cron task (Cron Trigger)
```

### Event Trigger Configuration Format

Each JSON file can define either a Hasura Event Trigger or a Cron Trigger.

#### Event Trigger Example

```json
{
  "name": "users",
  "table": {
    "schema": "public", 
    "name": "users"
  },
  "webhook_path": "/api/events/users",
  "insert": {
    "columns": "*"
  },
  "update": {
    "columns": "*"
  },
  "delete": {
    "columns": "*"
  },
  "retry_conf": {
    "num_retries": 3,
    "interval_sec": 15,
    "timeout_sec": 60
  },
  "headers": [
    {
      "name": "X-Hasura-Event-Secret",
      "value_from_env": "HASURA_EVENT_SECRET"
    }
  ]
}
```

#### Cron Trigger Example

```json
{
  "name": "subscription_billing_cron",
  "webhook_path": "/api/events/subscription-billing",
  "schedule": "*/10 * * * *",
  "comment": "Process subscription billing every 10 minutes",
  "retry_conf": {
    "num_retries": 3,
    "interval_sec": 15,
    "timeout_sec": 60
  },
  "headers": [
    {
      "name": "X-Hasura-Event-Secret",
      "value_from_env": "HASURA_EVENT_SECRET"
    }
  ],
  "include_in_metadata": true
}
```

### Configuration Options

#### Event Trigger Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique trigger name |
| `table.schema` | string | Yes | Database schema name |
| `table.name` | string | Yes | Table name |
| `webhook` | string | No | Full webhook URL |
| `webhook_path` | string | No | Path only (combined with NEXT_PUBLIC_MAIN_URL) |
| `source` | string | No | Hasura data source (defaults to "default") |
| `insert` | object | No | Insert operation configuration |
| `update` | object | No | Update operation configuration |
| `delete` | object | No | Delete operation configuration |
| `enable_manual` | boolean | No | Enable manual trigger invocation |
| `retry_conf` | object | No | Retry configuration |
| `headers` | array | No | Custom headers for webhook requests |

#### Cron Trigger Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique trigger name |
| `webhook` | string | No | Full webhook URL |
| `webhook_path` | string | No | Path only (combined with NEXT_PUBLIC_MAIN_URL) |
| `schedule` | string | Yes | Cron schedule expression (e.g., `*/10 * * * *`) - [Cron Format](#cron-schedule-format) |
| `payload` | object | No | JSON payload to send with webhook |
| `comment` | string | No | Description of the cron trigger |
| `retry_conf` | object | No | Retry configuration |
| `headers` | array | No | Custom headers for webhook requests |
| `include_in_metadata` | boolean | No | Include trigger in metadata export (defaults to true) |

## CLI Commands

### `npx hasyx events`

Synchronizes local trigger definitions (both Event Triggers and Cron Triggers) with Hasura.

**Basic Usage:**
```bash
npx hasyx events
```

**Available Options:**
- `--init` - Create default trigger definitions in the events directory
- `--clean` - Remove security headers from trigger definitions (they will be added automatically during sync)

**What the command does:**
1. Loads all `.json` files from `/events` directory
2. Validates each configuration (Event Triggers and Cron Triggers)
3. Creates/updates triggers in Hasura
4. Adds security headers automatically
5. Removes triggers that exist in Hasura but not locally

### `npx hasyx events --init`

Creates default event trigger definitions for common tables:

```bash
npx hasyx events --init
```

**Generated files:**
- `events/users.json` - User table events
- `events/accounts.json` - Account table events

### `npx hasyx events --clean`

Removes security headers from event definitions (useful when migrating configurations):

```bash
npx hasyx events --clean
```

**Note:** Security headers are automatically added during synchronization, so you don't need to include them manually in your JSON files.

## API Route Handlers

### Default Handler: `/app/api/events/[name]/route.ts`

The system provides a default handler that processes all events:

```typescript
import { NextResponse } from 'next/server';
import { hasyxEvent, HasuraEventPayload } from 'hasyx/lib/events';

export const POST = hasyxEvent(async (payload: HasuraEventPayload) => {
  const { event, table } = payload;
  const { op, data } = event;
  
  return {
    success: true,
    operation: {
      type: op,
      table: `${table.schema}.${table.name}`,
      trigger: payload.trigger.name,
      data: op === 'INSERT' ? { id: data.new?.id } :
            op === 'UPDATE' ? { id: data.new?.id } :
            op === 'DELETE' ? { id: data.old?.id } : {}
    }
  };
});
```

### Custom Handlers

Create specific handlers for different trigger types:

#### Event Trigger Handler

**`/app/api/events/users/route.ts`**
```typescript
import { hasyxEvent, HasuraEventPayload } from 'hasyx/lib/events';

export const POST = hasyxEvent(async (payload: HasuraEventPayload) => {
  const { event } = payload;
  
  if (event.op === 'INSERT') {
    // Handle new user creation
    const newUser = event.data.new;
    console.log('New user created:', newUser.email);
    
    // Send welcome email, setup user profile, etc.
  }
  
  if (event.op === 'UPDATE') {
    // Handle user updates
    const oldUser = event.data.old;
    const newUser = event.data.new;
    
    // Check for email changes, profile updates, etc.
  }
  
  return { success: true };
});
```

#### Cron Trigger Handler

**`/app/api/events/subscription-billing/route.ts`**
```typescript
import { hasyxEvent, HasuraCronPayload } from 'hasyx/lib/events';

export const POST = hasyxEvent(async (payload: HasuraCronPayload) => {
  // Handle cron trigger execution
  console.log('Processing subscription billing...');
  
  // Perform scheduled task
  try {
    // Process subscription renewals
    // Send billing notifications
    // Update subscription statuses
    
    return { 
      success: true, 
      message: 'Billing processed successfully',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Billing process failed:', error);
    return { 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
});
```

### Payload Structure

#### Event Trigger Payload

The `HasuraEventPayload` interface provides typed access to event data:

```typescript
interface HasuraEventPayload {
  event: {
    session_variables?: Record<string, string>;
    op: 'INSERT' | 'UPDATE' | 'DELETE' | 'MANUAL';
    data: {
      old: any | null;  // Previous row data (UPDATE/DELETE)
      new: any | null;  // New row data (INSERT/UPDATE)
    };
    trace_context?: {
      trace_id: string;
      span_id: string;
    };
  };
  created_at: string;
  id: string;
  delivery_info: {
    max_retries: number;
    current_retry: number;
  };
  trigger: {
    name: string;
  };
  table: {
    schema: string;
    name: string;
  };
}
```

#### Cron Trigger Payload

The `HasuraCronPayload` interface provides typed access to cron trigger data:

```typescript
interface HasuraCronPayload {
  id: string;
  scheduled_time: string;
  created_at: string;
  name: string;
  payload?: any;  // Custom payload defined in trigger
  comment?: string;
}
```

## Security

### HASURA_EVENT_SECRET

The system automatically adds security headers to verify requests come from Hasura:

**Environment Variable:**
```bash
HASURA_EVENT_SECRET=your-secret-key
```

**Automatic Header Addition:**
The CLI automatically adds this header to all event triggers:
```json
{
  "name": "X-Hasura-Event-Secret",
  "value_from_env": "HASURA_EVENT_SECRET"
}
```

### Request Verification

The `hasyxEvent` wrapper automatically verifies incoming requests:

```typescript
export function hasyxEvent(
  handler: (payload: HasuraEventPayload) => Promise<Response | NextResponse | any>
) {
  return async (request: NextRequest, context?: any) => {
    // Automatic verification of X-Hasura-Event-Secret header
    if (!verifyHasuraRequest(Object.fromEntries(request.headers))) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    
    // Parse and validate payload
    const payload: HasuraEventPayload = await request.json();
    
    // Call your handler with validated payload
    return await handler(payload);
  };
}
```

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_HASURA_GRAPHQL_URL` | Hasura GraphQL endpoint | `https://your-app.hasura.app/v1/graphql` |
| `HASURA_ADMIN_SECRET` | Hasura admin secret for CLI operations | `your-admin-secret` |
| `HASURA_EVENT_SECRET` | Secret for verifying webhook requests | `your-event-secret` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_MAIN_URL` | Base URL for webhook construction | `""` |
| `NODE_ENV` | Environment (affects security validation) | `development` |

## Workflow Examples

### 1. Adding a New Event Trigger

**Step 1: Create event definition**
```bash
# Create events/orders.json
{
  "name": "orders",
  "table": {
    "schema": "public",
    "name": "orders"
  },
  "webhook_path": "/api/events/orders",
  "insert": { "columns": "*" },
  "update": { "columns": "*" }
}
```

**Step 2: Synchronize with Hasura**
```bash
npx hasyx events
```

**Step 3: Create API handler**
```typescript
// app/api/events/orders/route.ts
import { hasyxEvent, HasuraEventPayload } from 'hasyx/lib/events';

export const POST = hasyxEvent(async (payload: HasuraEventPayload) => {
  const { event } = payload;
  
  if (event.op === 'INSERT') {
    // Process new order
    await processNewOrder(event.data.new);
  }
  
  return { success: true };
});
```

### 2. Adding a New Cron Trigger

**Step 1: Create cron trigger definition**
```bash
# Create events/daily-reports.json
{
  "name": "daily_reports_cron",
  "webhook_path": "/api/events/daily-reports",
  "schedule": "0 8 * * *",
  "comment": "Generate daily reports at 8 AM",
  "payload": {
    "report_type": "daily",
    "format": "pdf"
  }
}
```

**Step 2: Synchronize with Hasura**
```bash
npx hasyx events
```

**Step 3: Create API handler**
```typescript
// app/api/events/daily-reports/route.ts
import { hasyxEvent, HasuraCronPayload } from 'hasyx/lib/events';

export const POST = hasyxEvent(async (payload: HasuraCronPayload) => {
  console.log('Generating daily reports...');
  
  // Access custom payload
  const { report_type, format } = payload.payload || {};
  
  // Generate and send reports
  await generateDailyReports(report_type, format);
  
  return { success: true, message: 'Reports generated successfully' };
});
```

### 3. Handling User Registration Events

**Event Definition (`events/users.json`):**
```json
{
  "name": "users",
  "table": { "schema": "public", "name": "users" },
  "webhook_path": "/api/events/users",
  "insert": { "columns": "*" }
}
```

**Handler (`app/api/events/users/route.ts`):**
```typescript
import { hasyxEvent } from 'hasyx/lib/events';
import { sendWelcomeEmail } from '@/lib/email';

export const POST = hasyxEvent(async (payload) => {
  if (payload.event.op === 'INSERT') {
    const newUser = payload.event.data.new;
    
    // Send welcome email
    await sendWelcomeEmail(newUser.email, newUser.name);
    
    // Initialize user profile
    // Track analytics event
    // etc.
  }
  
  return { success: true };
});
```

### 4. Debugging Events

**Enable Debug Logging:**
```bash
DEBUG=events,events-cli npx hasyx events
```

**Check Event Delivery in Hasura Console:**
1. Go to Hasura Console → Data → [Your Table] → Events
2. View event logs and delivery status
3. Check retry attempts and error messages

**Check Cron Trigger Status:**
1. Go to Hasura Console → Events → Cron Triggers
2. View trigger status and execution history
3. Check scheduled times and next execution

## Cron Schedule Format

Cron triggers use the standard 5-field cron format:

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of Week (0-6, Sunday=0)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of Month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

### Common Cron Examples

| Schedule | Description |
|----------|-------------|
| `*/10 * * * *` | Every 10 minutes |
| `0 8 * * *` | Daily at 8:00 AM |
| `0 0 * * 0` | Weekly on Sunday at midnight |
| `0 0 1 * *` | Monthly on the 1st at midnight |
| `0 9 * * 1-5` | Weekdays at 9:00 AM |
| `30 14 * * *` | Daily at 2:30 PM |

### Cron Expression Tools

- [Crontab Guru](https://crontab.guru/) - Interactive cron expression builder
- [Cron Expression Generator](https://www.freeformatter.com/cron-expression-generator-quartz.html)

## Troubleshooting

### Common Issues

**1. Event Secret Mismatch**
```
❌ Invalid event secret provided in request
```
**Solution:** Ensure `HASURA_EVENT_SECRET` is set correctly in both your `.env` file and Hasura environment.

**2. Webhook URL Not Accessible**
```
❌ Hasura cannot reach webhook URL
```
**Solution:** 
- Set `NEXT_PUBLIC_MAIN_URL` to your publicly accessible domain
- Ensure your Next.js app is deployed and accessible
- Check firewall/network settings

**3. Event Trigger Not Created**
```
❌ Failed to create event trigger
```
**Solution:**
- Verify `HASURA_ADMIN_SECRET` is correct
- Check that the table exists in your database
- Ensure Hasura has permissions to create triggers

**4. Events Directory Not Found**
```
⚠️ Events directory not found
```
**Solution:**
```bash
npx hasyx events --init
```

**5. Cron Trigger Not Executing**
```
❌ Cron trigger created but not executing
```
**Solution:**
- Verify cron schedule format is correct
- Check if trigger is enabled in Hasura Console
- Ensure webhook URL is accessible from Hasura
- Check Hasura logs for execution errors

**6. Invalid Cron Schedule**
```
❌ Invalid cron expression
```
**Solution:**
- Use the 5-field format: `minute hour day month weekday`
- Test your cron expression using [Crontab Guru](https://crontab.guru/)
- Ensure all fields are within valid ranges

### Debug Commands

**View Hasura Metadata:**
```bash
DEBUG=events npx hasyx events
```

**Clean and Rebuild Triggers:**
```bash
npx hasyx events --clean
npx hasyx events
```

**Test Event Handler Locally:**
```bash
curl -X POST http://localhost:3000/api/events/test \
  -H "Content-Type: application/json" \
  -H "X-Hasura-Event-Secret: your-secret" \
  -d '{"event": {"op": "INSERT", "data": {"new": {"id": 1}}}}'
```

**Test Cron Handler Locally:**
```bash
curl -X POST http://localhost:3000/api/events/subscription-billing \
  -H "Content-Type: application/json" \
  -H "X-Hasura-Event-Secret: your-secret" \
  -d '{"id": "test-123", "scheduled_time": "2024-01-01T08:00:00Z", "created_at": "2024-01-01T08:00:00Z", "name": "test_cron"}'
```

## Advanced Usage

### Manual Event Triggers

Enable manual triggers for testing:

```json
{
  "name": "manual_test",
  "table": { "schema": "public", "name": "users" },
  "webhook_path": "/api/events/manual-test",
  "enable_manual": true
}
```

Trigger manually from Hasura Console or via API.

### Custom Retry Configuration

Configure retry behavior for failed events:

```json
{
  "retry_conf": {
    "num_retries": 5,
    "interval_sec": 30,
    "timeout_sec": 120
  }
}
```

### Multiple Environment Support

Use different webhook URLs for different environments:

```json
{
  "webhook": "https://staging.myapp.com/api/events/users",
  "webhook_path": "/api/events/users"
}
```

### Advanced Cron Trigger Features

#### Custom Payload
Send custom data with cron triggers:

```json
{
  "name": "user_cleanup_cron",
  "schedule": "0 2 * * *",
  "webhook_path": "/api/events/cleanup",
  "payload": {
    "cleanup_type": "inactive_users",
    "days_inactive": 30,
    "batch_size": 100
  }
}
```

#### Environment-Specific Schedules
Use different schedules for different environments:

```json
{
  "name": "backup_cron",
  "schedule": "0 3 * * *",
  "webhook_path": "/api/events/backup",
  "comment": "Daily backup at 3 AM (production schedule)"
}
```

## Integration with Other Systems

### Email Notifications
```typescript
export const POST = hasyxEvent(async (payload) => {
  if (payload.event.op === 'INSERT') {
    await sendEmail({
      to: payload.event.data.new.email,
      template: 'welcome',
      data: payload.event.data.new
    });
  }
  return { success: true };
});
```

### Analytics Tracking
```typescript
export const POST = hasyxEvent(async (payload) => {
  await analytics.track('database_event', {
    operation: payload.event.op,
    table: payload.table.name,
    userId: payload.event.data.new?.user_id
  });
  return { success: true };
});
```

### External API Synchronization
```typescript
export const POST = hasyxEvent(async (payload) => {
  if (payload.event.op === 'UPDATE') {
    // Sync with external CRM
    await crmApi.updateContact(payload.event.data.new);
  }
  return { success: true };
});
```

## Best Practices

### General Practices

1. **Use specific handlers** for different trigger types rather than one giant handler
2. **Keep handlers lightweight** - delegate heavy work to background jobs
3. **Always return success response** to prevent unnecessary retries
4. **Use TypeScript** for better payload type safety
5. **Monitor trigger delivery** in Hasura Console
6. **Test handlers locally** before deploying
7. **Use environment-specific secrets** for security
8. **Log important events** for debugging and monitoring

### Event Trigger Specific

9. **Use minimal column sets** in event triggers to reduce payload size
10. **Filter events at database level** when possible rather than in handlers
11. **Handle both INSERT and UPDATE** when business logic requires it

### Cron Trigger Specific

12. **Use descriptive cron trigger names** that indicate their purpose
13. **Add meaningful comments** to explain schedule and purpose
14. **Consider timezone implications** - Hasura uses UTC
15. **Implement idempotency** in cron handlers for safe retries
16. **Use appropriate retry configurations** for critical scheduled tasks
17. **Monitor cron execution logs** regularly for failures
18. **Test cron schedules** thoroughly before production deployment

## Related Documentation

- [Hasura Event Triggers Documentation](https://hasura.io/docs/latest/event-triggers/index/)
- [Hasura Scheduled Triggers (Cron) Documentation](https://hasura.io/docs/latest/scheduled-triggers/index/)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [Hasyx CLI Documentation](./README.md#cli-commands)
- [Cron Expression Guide](https://crontab.guru/) 