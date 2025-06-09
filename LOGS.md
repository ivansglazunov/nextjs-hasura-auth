# Hasyx Logs System

## Overview

Comprehensive logging system for tracking data changes in Hasura-based applications. The system provides two types of logging:

- **Diffs**: Track individual column changes with differential patches using diff-match-patch
- **States**: Track complete state snapshots for specified columns

Both systems use PostgreSQL triggers and integrate with Hasura Event Triggers for automated processing.

## Architecture

### Database Schema

#### logs.diffs Table
```sql
CREATE TABLE logs.diffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  _schema TEXT NOT NULL,       -- Source schema name
  _table TEXT NOT NULL,        -- Source table name  
  _column TEXT NOT NULL,       -- Source column name
  _id TEXT NOT NULL,           -- Source record identifier
  user_id UUID,                -- User who made the change
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  _value TEXT,                 -- New value before diff calculation
  diff TEXT,                   -- Calculated diff from previous state
  processed BOOLEAN DEFAULT FALSE  -- Whether processed by event trigger
);
```

#### logs.states Table
```sql
CREATE TABLE logs.states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  _schema TEXT NOT NULL,       -- Source schema name
  _table TEXT NOT NULL,        -- Source table name
  _column TEXT NOT NULL,       -- Source column name
  _id TEXT NOT NULL,           -- Source record identifier
  user_id UUID,                -- User who made the change
  created_at TIMESTAMPTZ DEFAULT NOW(),
  state JSONB                  -- State snapshot (null for delete)
);
```

## Configuration

### hasyx.config.json

```json
{
  "logs-diffs": {
    "diffs": [
      {
        "schema": "public",
        "table": "users", 
        "column": "name"
      }
    ]
  },
  "logs-states": {
    "states": [
      {
        "schema": "public",
        "table": "users",
        "columns": ["email", "status"]
      }
    ]
  }
}
```

## CLI Commands

### Apply Configuration

```bash
# Apply diffs configuration
npm run logs-diffs

# Apply states configuration  
npm run logs-states

# Apply both configurations
npm run logs

# Apply event triggers
npm run events
```

### Testing

```bash
# Run all logs tests
npm test logs.test.ts

# Run specific test with debug output
DEBUG="hasyx*" npm test logs.test.ts -- -t "test name"
```

## Diffs System

### Features

- Track individual column changes with differential patches
- Uses diff-match-patch library for creating human-readable diffs
- Preserves original values and calculated diffs
- Prevents unauthorized updates to preserve history integrity
- Automatic processing via Event Triggers

### Workflow

1. **Configuration**: Define tables/columns to track in hasyx.config.json
2. **Trigger Creation**: Database triggers created automatically on configured tables
3. **Data Change**: When data changes, trigger inserts record into logs.diffs with _value
4. **Event Processing**: Hasura Event Trigger calls webhook to process diff
5. **Diff Creation**: API route creates diff patch and updates record with processed=true

### Implementation

#### lib/logs-diffs.ts

```typescript
export async function applyLogsDiffs(hasura: Hasura, config: LogsDiffsConfig)
export async function handleLogsDiffsEventTrigger(payload: HasuraEventPayload)
```

#### Database Triggers

```sql
CREATE OR REPLACE FUNCTION hasyx_record_diff()
RETURNS TRIGGER AS $$
DECLARE
  user_id_val UUID;
  record_id TEXT;
BEGIN
  -- Get user_id from Hasura session variable
  user_id_val := NULLIF(current_setting('hasura.user.id', true), '')::UUID;
  
  -- Record the diff
  INSERT INTO logs.diffs (_schema, _table, _column, _id, user_id, _value)
  VALUES (
    TG_TABLE_SCHEMA,
    TG_TABLE_NAME,
    TG_ARGV[0], -- column name
    record_id,
    user_id_val,
    (row_to_json(NEW)->>TG_ARGV[0])::TEXT
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## States System

### Features

- Track complete state snapshots for multiple columns
- Record state changes including deletes (null state)
- Support for multiple columns per table
- Separate triggers for insert/update and delete operations

### Workflow

1. **Configuration**: Define tables and columns to track in hasyx.config.json
2. **Trigger Creation**: Database triggers created automatically
3. **Data Change**: Triggers insert state snapshots into logs.states
4. **State Recording**: Complete column states stored as JSONB

### Implementation

#### lib/logs-states.ts

```typescript
export async function applyLogsStates(hasura: Hasura, config: LogsStatesConfig)
```

#### Database Triggers

```sql
CREATE OR REPLACE FUNCTION hasyx_record_state_insert_update()
RETURNS TRIGGER AS $$
DECLARE
  user_id_val UUID;
  record_id TEXT;
  state_data JSONB;
  col_name TEXT;
BEGIN
  -- Process each column specified in trigger arguments
  FOR i IN 0..TG_NARGS-1 LOOP
    col_name := TG_ARGV[i];
    state_data := jsonb_build_object(col_name, row_to_json(NEW)->>col_name);
    
    INSERT INTO logs.states (_schema, _table, _column, _id, user_id, state)
    VALUES (TG_TABLE_SCHEMA, TG_TABLE_NAME, col_name, record_id, user_id_val, state_data);
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## Event Triggers

### Diffs Event Trigger

#### Configuration (events/logs-diffs.json)

```json
{
  "name": "logs_diffs_created",
  "table": {
    "schema": "logs",
    "name": "diffs"
  },
  "webhook_path": "/api/events/logs-diffs",
  "insert": {
    "columns": "*"
  },
  "retry_conf": {
    "num_retries": 3,
    "interval_sec": 10,
    "timeout_sec": 60
  }
}
```

#### API Route (app/api/events/logs-diffs/route.ts)

```typescript
export const POST = hasyxEvent(async (payload: HasuraEventPayload) => {
  const result = await handleLogsDiffsEventTrigger(payload);
  return NextResponse.json(result);
});
```

#### Event Handler

The `handleLogsDiffsEventTrigger` function:

1. Validates payload is INSERT to logs.diffs table
2. Extracts _value from the new record
3. Queries for previous values to create diff
4. Uses diff-match-patch to generate diff patch
5. Updates record with diff and processed=true

### Workflow Example

```
User updates users.name: "John" → "John Doe"
    ↓
Database trigger creates logs.diffs record with _value="John Doe"
    ↓  
Hasura Event Trigger calls /api/events/logs-diffs
    ↓
API handler gets previous value "John", creates diff patch
    ↓
Updates logs.diffs record with diff="@@ -1,4 +1,8 @@\n John\n+ Doe\n" and processed=true
```

## Security & Permissions

### Database Protections

- **Diffs**: Updates restricted to diff and processed fields only
- **States**: Read-only after creation
- **User Permissions**: Role-based access (user/admin)

### Trigger Protection

```sql
CREATE OR REPLACE FUNCTION prevent_diffs_update()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Allow updates only to diff and processed fields
    IF (OLD._schema IS DISTINCT FROM NEW._schema OR
        -- ... other core fields check
        OLD._value IS DISTINCT FROM NEW._value) THEN
      RAISE EXCEPTION 'Updates to core diffs fields are not allowed to preserve history integrity. Only diff and processed fields can be updated.';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
```

## Testing

### Test Coverage

#### Diffs System Tests
- ✅ Trigger creation and configuration
- ✅ Data change recording
- ✅ Event trigger processing
- ✅ Diff patch generation
- ✅ Processed field updates

#### States System Tests  
- ✅ Trigger creation for multiple columns
- ✅ State recording on insert/update
- ✅ Delete state handling (null)
- ✅ JSONB state structure

#### Combined System Tests
- ✅ Simultaneous diffs and states operation
- ✅ Configuration integration
- ✅ Cleanup and restoration

### Test Strategy

```typescript
describe('Logs System Tests', () => {
  it('should process diffs event trigger and create diff patches', async () => {
    // 1. Create test data and diff record
    // 2. Simulate event trigger payload  
    // 3. Call handleLogsDiffsEventTrigger
    // 4. Verify diff was created and processed=true
  });
});
```

## Dependencies

```json
{
  "diff-match-patch": "^1.0.5",
  "@types/diff-match-patch": "^1.0.5"
}
```

## Migration

### Migration File Structure

```
migrations/1746999999999-hasyx-logs/
├── up.ts          # Creates logs schema, tables, triggers, permissions
└── down.ts        # Cleanup and rollback
```

### Apply Migration

```bash
npm run migrate logs
```

## Production Considerations

### Performance
- Event triggers process asynchronously
- Database triggers have minimal overhead
- Indexes on common query patterns

### Monitoring
- Use DEBUG="hasyx*" for detailed logging
- Monitor Event Trigger success/failure rates
- Track logs table growth

### Security
- Event triggers protected by HASURA_EVENT_SECRET
- Role-based permissions on logs tables
- Audit trail preservation via trigger protections

### Scalability
- Consider partitioning logs tables for high-volume applications
- Archive old logs data based on retention policies
- Monitor and optimize trigger performance

## Integration

The logs system integrates seamlessly with existing Hasura applications:

- **Zero Code Changes**: No application code modifications required
- **Configuration-Driven**: Everything controlled via hasyx.config.json
- **Hasura Native**: Uses Hasura Event Triggers and permissions
- **Type Safe**: Full TypeScript support with proper interfaces
- **Testable**: Comprehensive test suite included

### CLI Integration

All commands are integrated into the hasyx CLI:

```bash
# Apply specific configurations
npm run logs-diffs
npm run logs-states  
npm run logs

# Apply event triggers
npm run events

# Testing
npm test logs.test.ts
```

The system is production-ready and provides a complete audit trail for your Hasura application data changes.
