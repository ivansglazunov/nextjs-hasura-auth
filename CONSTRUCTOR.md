# 🏗️ Hasyx Query Constructor

Visual GraphQL query builder for Hasyx with real-time results, smart primary key detection, and comprehensive query options.

## 🚀 Quick Start

```typescript
import { HasyxConstructor } from 'hasyx/lib/constructor';

function MyApp() {
  const [query, setQuery] = useState({
    table: 'users',
    where: {},
    returning: ['id', 'name'],
    limit: 50,
    offset: 0,
    order_by: [{ created_at: 'desc' }]
  });

  return (
    <HasyxConstructor 
      value={query}
      onChange={setQuery}
      defaultTable="users"
    />
  );
}
```

## 🧩 Component Architecture

Hasyx Constructor provides flexible components for different integration scenarios:

### Core Components

- **`HasyxConstructor`**: Main query builder interface (left panel)
- **`HasyxConstructorResults`**: Results display with 4 tabs (exp, gql, query, subscription)
- **`HasyxConstructorColumns`**: Two-column layout for constructor page
- **`HasyxConstructorTabs`**: Two-tab layout (Constructor | Results) for modal dialogs
- **`HasyxConstructorButton`**: Button that opens constructor in modal dialog

### Integration Examples

**Standalone Constructor Page (`/hasyx/constructor`):**
```typescript
import { HasyxConstructorColumns } from 'hasyx/lib/constructor';

export default function ConstructorPage() {
  const [state, setState] = useState({...});
  
  return (
    <HasyxConstructorColumns
      value={state}
      onChange={setState}
      defaultTable="users"
    />
  );
}
```

**Modal Dialog Integration:**
```typescript
import { HasyxConstructorButton } from 'hasyx/lib/constructor';

function MyComponent() {
  const [queryState, setQueryState] = useState({...});
  
  return (
    <div>
      {/* Your component content */}
      <HasyxConstructorButton
        value={queryState}
        onChange={setQueryState}
        defaultTable="users"
        icon={<Search className="h-4 w-4" />}
        size="sm"
      />
    </div>
  );
}
```

**As Toolbar Button (Cyto Integration):**
```typescript
import { Cyto } from 'hasyx/lib/cyto';
import { HasyxConstructorButton } from 'hasyx/lib/constructor';

function CytoPage() {
  const [queryState, setQueryState] = useState({...});
  
  return (
    <Cyto 
      buttons={true}
      buttonsChildren={
        <HasyxConstructorButton
          value={queryState}
          onChange={setQueryState}
          defaultTable="users"
        />
      }
    >
      {/* Cyto content */}
    </Cyto>
  );
}
```

## 🔍 Interface Overview

The Constructor page (`/hasyx/constructor`) features a **split-view interface**:

### Left Panel: Query Builder
- **Table Selection**: Inline dropdown with minimal styling
- **Where Conditions**: Smart primary key detection with PK badges
- **Pagination**: Limit and offset controls for data paging
- **Order By**: Multi-field sorting with asc/desc controls
- **Returning Fields**: Auto-populated physical fields, nested relations support
- **Real-time Updates**: Changes immediately reflected in right panel

### Right Panel: Multi-View Tabs
- **`exp`** - Hasyx query options object with pk_columns optimization
- **`gql`** - Generated GraphQL query with variables (query/subscription toggle)
- **`query`** - Live query execution with useQuery
- **`subscription`** - Live subscription with useSubscription

### Modal Dialog Interface
When using `HasyxConstructorButton`, the constructor opens in a responsive modal with:
- **Two-tab layout**: Constructor | Results
- **Responsive sizing**: max-w-6xl, h-[80vh]
- **Backdrop overlay**: Click outside to close
- **Close button**: X button in top-right corner

## 📖 Core Features

### Smart Primary Key Detection

The constructor automatically detects primary key fields (`id`, `uuid`, `pk`, `_id`) and provides intelligent optimizations:

```typescript
// When WHERE contains only primary key with _eq:
{
  table: 'users',
  where: { id: { _eq: 'user-123' } },
  returning: ['id', 'name']
}

// Automatically converts to optimized pk_columns:
{
  table: 'users',
  pk_columns: { id: 'user-123' },  // ← Optimized for single record lookup
  returning: ['id', 'name']
}

// Mixed conditions remain as WHERE:
{
  table: 'users',
  where: { 
    id: { _eq: 'user-123' },
    status: { _eq: 'active' }  // ← Additional condition keeps it as WHERE
  },
  returning: ['id', 'name']
}
```

### Primary Key Visual Indicators

In WHERE condition dropdowns, primary key fields are marked with a **PK badge**:

```
┌─ Add Field ────────────────┐
│ id [PK]                    │  ← Primary key field with badge
│ name                       │
│ email                      │
│ created_at                 │
│ accounts (relation)        │
└────────────────────────────┘
```

### Auto-populated Physical Fields

When selecting a table, all physical (non-relation) fields are automatically added to returning, excluding Hasyx system fields:

```typescript
// Automatically included:
['id', 'name', 'email', 'created_at', 'updated_at', 'status']

// Automatically excluded:
// - Relation fields: ['accounts', 'notifications']
// - Hasyx system fields: ['_hasyx_schema_name', '_hasyx_table_name']
```

### Pagination Controls

```typescript
const queryWithPagination = {
  table: 'users',
  where: { status: { _eq: 'active' } },
  limit: 20,        // Records per page
  offset: 40,       // Skip first N records (page 3: offset = pageSize * (page - 1))
  returning: ['id', 'name', 'email']
};
```

### Multi-field Sorting

```typescript
const queryWithSorting = {
  table: 'users',
  where: { status: { _eq: 'active' } },
  order_by: [
    { created_at: 'desc' },  // Primary sort: newest first
    { name: 'asc' }          // Secondary sort: alphabetical
  ],
  returning: ['id', 'name', 'created_at']
};
```

### Nested Relations

```typescript
const queryWithRelations = {
  table: 'users',
  where: { status: { _eq: 'active' } },
  returning: [
    'id', 'name', 'email',
    {
      accounts: {
        where: { provider: { _eq: 'google' } },
        returning: ['id', 'provider', 'provider_id']
      }
    },
    {
      notifications: {
        returning: ['id', 'title', 'message']
      }
    }
  ]
};
```

## 🎛️ Query Builder Sections

### Table Selection
- Dropdown of all available tables from schema
- Auto-populates physical fields on selection
- Excludes system tables (_mapping, _aggregate, etc.)

### Where Conditions
- Primary key fields marked with **PK badge**
- Smart pk_columns conversion for single ID lookups
- Type-aware operators based on field types
- Visual field organization: physical fields first, then relations

### Pagination Section
```
┌─ Pagination ─────────────────┐
│ Limit: [50    ] Offset: [0  ]│
└──────────────────────────────┘
```

### Order By Section
```
┌─ Order By ───────────────────┐
│ created_at [↓ desc] [×]      │
│ name       [↑ asc ] [×]      │
│ [+ Add Field]                │
└──────────────────────────────┘
```

### Returning Fields
- Auto-populated physical fields
- Manual addition of relations
- Nested relation building
- System field exclusion

## 📊 Result Tabs

### `exp` Tab
Shows the complete Hasyx query options object:

```json
{
  "table": "users",
  "pk_columns": { "id": "user-123" },
  "limit": 20,
  "offset": 40,
  "order_by": [{ "created_at": "desc" }],
  "returning": ["id", "name", "email"]
}
```

### `gql` Tab
Displays generated GraphQL with sub-tabs for operation type:

**Query:**
```graphql
query GetUser($pk: uuid!) {
  users_by_pk(id: $pk) {
    id
    name
    email
  }
}
```

**Variables:**
```json
{ "pk": "user-123" }
```

### `query` Tab
Live execution using `useQuery` hook with loading states and error handling.

### `subscription` Tab
Real-time data streaming using `useSubscription` hook.

## 🔧 Complete State Interface

```typescript
interface ConstructorState {
  table: string;
  where: Record<string, any>;
  returning: (string | NestedReturning)[];
  limit?: number;
  offset?: number;
  order_by?: Array<{ [field: string]: 'asc' | 'desc' }>;
}

interface NestedReturning {
  [relationName: string]: {
    where?: Record<string, any>;
    returning: (string | NestedReturning)[];
  };
}
```

## 🎯 Field Type Support

The constructor supports all Hasura field types with appropriate operators:

### String Fields
- Operators: `_eq`, `_ne`, `_like`, `_ilike`, `_in`, `_is_null`
- UI: Text input, pattern matching support

### Numeric Fields (Int, Float, BigInt)
- Operators: `_eq`, `_ne`, `_gt`, `_gte`, `_lt`, `_lte`, `_in`, `_is_null`
- UI: Number input with validation

### Boolean Fields
- Operators: `_eq`, `_ne`
- UI: True/False dropdown

### DateTime Fields
- Operators: `_eq`, `_ne`, `_gt`, `_gte`, `_lt`, `_lte`, `_in`, `_is_null`
- UI: Text input for ISO strings

### UUID Fields
- Operators: `_eq`, `_ne`, `_in`, `_is_null`
- UI: Text input with UUID validation

### JSONB Fields
- Operators: `_eq`, `_ne`, `_is_null`
- UI: Text input for JSON strings

## 🚀 Schema Integration

### Automatic Schema Loading
- Loads from `/public/hasura-schema.json`
- Extracts tables from `hasyx.tableMappings`
- Parses all fields from GraphQL schema types

### Field Detection Logic
```typescript
function getFieldsFromTable(schema: any, tableName: string): FieldInfo[] {
  // 1. Find GraphQL type with multiple naming strategies
  const possibleTypeNames = [
    tableName,
    tableName.toLowerCase(), 
    tableName.charAt(0).toUpperCase() + tableName.slice(1),
    tableName.split('_').map(part => 
      part.charAt(0).toUpperCase() + part.slice(1)
    ).join('_')
  ];

  // 2. Parse fields from GraphQL schema
  // 3. Map GraphQL types: uuid→UUID, bigint→Int, timestamptz→DateTime
  // 4. Detect relations vs scalar fields
  // 5. Exclude Hasyx system fields (_hasyx_*)
}
```

### Primary Key Detection
```typescript
function getPrimaryKeyField(fields: FieldInfo[]): string | null {
  // Looks for common primary key names: 'id', 'uuid', 'pk', '_id'
  // Returns first non-relation field matching these patterns
}
```

### Smart Query Optimization
```typescript
function shouldUsePkColumns(where: Record<string, any>, primaryKeyField: string | null) {
  // Converts simple primary key lookups to pk_columns for better performance
  // Only when: single field, primary key, _eq operator
}
```

## ⚡ Performance Features

### Efficient Field Sorting
- Physical fields listed first (alphabetically)
- Relation fields listed second (alphabetically) 
- Consistent ordering across all dropdowns

### Smart Auto-population
- Only includes relevant physical fields
- Excludes system fields automatically
- Excludes relation fields from initial selection

### Optimized Queries
- Automatic pk_columns conversion for single record lookups
- Type-safe operator selection
- Real-time validation feedback

## 🎨 UI/UX Design

### Minimal Inline Design
- Table selection integrated with section headers
- Consistent 6px height elements
- Unified border and spacing system
- Clean field management with X buttons

### Visual Organization
- **PK badges** for primary key identification
- **Type indicators** for relation fields
- **Consistent icons**: ↑/↓ for sort, + for add, × for remove
- **Responsive layout**: Works on various screen sizes

### Accessibility
- Keyboard navigation support
- Screen reader compatible
- High contrast visual indicators
- Consistent focus management

---

*Constructor provides a complete visual query building experience with smart optimizations, comprehensive field support, and real-time result viewing.* 