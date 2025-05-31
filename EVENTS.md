# Events System Documentation

The Hasyx Events system provides a seamless integration between Hasura Event Triggers and Next.js API routes, allowing you to handle database changes in real-time with automatic synchronization and secure webhook handling.

## Overview

The Events system consists of three main components:

1. **Event Trigger Definitions** - JSON configuration files in the `/events` directory
2. **CLI Commands** - Synchronization tools (`npx hasyx events`)
3. **API Route Handlers** - Next.js routes that process incoming events from Hasura

## Architecture Flow

```
Database Change → Hasura Event Trigger → Webhook → Next.js API Route → Your Handler
```

## Event Trigger Definitions

### Directory Structure

```
/events/
├── users.json           # User table events
├── accounts.json        # Account table events
├── notify.json          # Notification events
└── subscription-billing.json # Billing events
```

### Configuration Format

Each JSON file defines a Hasura Event Trigger:

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

### Configuration Options

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

## CLI Commands

### `npx hasyx events`

Synchronizes local event trigger definitions with Hasura.

**Basic Usage:**
```bash
npx hasyx events
```

**Available Options:**
- `--init` - Create default event trigger definitions in the events directory
- `--clean` - Remove security headers from event definitions (they will be added automatically during sync)

**What the command does:**
1. Loads all `.json` files from `/events` directory
2. Validates each configuration
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

Create specific handlers for different event types:

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

### Event Payload Structure

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

### 2. Handling User Registration Events

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

### 3. Debugging Events

**Enable Debug Logging:**
```bash
DEBUG=events,events-cli npx hasyx events
```

**Check Event Delivery in Hasura Console:**
1. Go to Hasura Console → Data → [Your Table] → Events
2. View event logs and delivery status
3. Check retry attempts and error messages

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

1. **Use specific handlers** for different event types rather than one giant handler
2. **Keep handlers lightweight** - delegate heavy work to background jobs
3. **Always return success response** to prevent unnecessary retries
4. **Use TypeScript** for better payload type safety
5. **Monitor event delivery** in Hasura Console
6. **Test handlers locally** before deploying
7. **Use environment-specific secrets** for security
8. **Log important events** for debugging and monitoring

## Related Documentation

- [Hasura Event Triggers Documentation](https://hasura.io/docs/latest/event-triggers/index/)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [Hasyx CLI Documentation](./README.md#cli-commands) 