# 🏗️ Hasyx Query Constructor

Visual GraphQL query builder for Hasyx with real-time results and multi-view tabs.

## 🚀 Quick Start

```typescript
import { HasyxConstructor } from 'hasyx/lib/constructor';

function MyApp() {
  const [query, setQuery] = useState({
    table: 'users',
    where: {},
    returning: ['id', 'name']
  });

  return (
    <HasyxConstructor 
      value={query}
      onChange={setQuery}
    />
  );
}
```

## 🔍 Interface Overview

The Constructor page (`/hasyx/constructor`) features a **split-view interface**:

### Left Panel: Query Builder
- **Table Selection**: Inline with minimal styling
- **Where Conditions**: Add/remove filters with operator selection
- **Returning Fields**: Select fields and nested relations
- **Real-time Updates**: Changes immediately reflected in right panel

### Right Panel: Multi-View Tabs ✨
- **`exp`** - Hasyx query options object
- **`gql`** - Generated GraphQL query with variables
  - Sub-tabs: `query` ↔ `subscription` toggle
- **`query`** - Live query execution with useQuery
- **`subscription`** - Live subscription with useSubscription

## 📖 Practical Usage

### Basic Query Building

```typescript
// 1. Table Selection
const initialState = {
  table: 'users',        // Select from available tables
  where: {},             // Empty conditions
  returning: []          // No fields selected
};

// 2. Add Where Conditions
const withConditions = {
  table: 'users',
  where: {
    name: { _eq: 'John' },           // String equality
    age: { _gt: 18 },                // Number comparison  
    email: { _ilike: '%@gmail.com' }, // String pattern
    is_active: { _eq: true }         // Boolean
  },
  returning: ['id', 'name', 'email']
};

// 3. View in Multiple Formats
// - exp tab: See Hasyx options
// - gql tab: See GraphQL query + variables
// - query tab: Execute with useQuery
// - subscription tab: Execute with useSubscription
```

### Page Integration

```typescript
// app/my-page/page.tsx
export default function QueryPage() {
  const [constructorState, setConstructorState] = useState({
    table: 'users',
    where: {},
    returning: []
  });
  
  return (
    <div className="flex h-screen">
      {/* Left: Constructor */}
      <div className="flex-1">
        <HasyxConstructor 
          value={constructorState}
          onChange={setConstructorState}
        />
      </div>
      
      {/* Right: Multi-view Results */}
      <div className="flex-1">
        {/* Tabs automatically handle different views */}
      </div>
    </div>
  );
}
```

### Tabs Usage Examples

```typescript
// exp tab shows:
{
  "table": "users",
  "where": { "name": { "_eq": "John" } },
  "returning": ["id", "name", "email"]
}

// gql tab shows:
query QueryUsers($v1: users_bool_exp) {
  users(where: $v1) {
    id
    name
    email
  }
}
// Variables: { "v1": { "name": { "_eq": "John" } } }

// query tab: Live data from useQuery
// subscription tab: Streaming data from useSubscription
```

### Integration with Forms

```typescript
function UserFilter() {
  const [filters, setFilters] = useState({
    table: 'users',
    where: {},
    returning: ['id', 'name', 'email']
  });
  
  // Add programmatic filters
  const addStatusFilter = (status: string) => {
    setFilters(prev => ({
      ...prev,
      where: {
        ...prev.where,
        status: { _eq: status }
      }
    }));
  };
  
  return (
    <div>
      <button onClick={() => addStatusFilter('active')}>
        Show Active Users
      </button>
      
      <HasyxConstructor value={filters} onChange={setFilters} />
      {/* Results automatically update in tabs */}
    </div>
  );
}
```

### Schema-driven Development

```typescript
// Constructor automatically loads from /public/hasura-schema.json
// Available tables and fields are populated automatically
// Field types determine available operators:

// String fields: _eq, _ne, _like, _ilike, _in, _is_null
// Number fields: _eq, _ne, _gt, _gte, _lt, _lte, _in, _is_null  
// Boolean fields: _eq, _ne
```

## 🛣️ Development Roadmap

### Phase 1: Core Functionality ✅
- ✅ Table selection from schema (hasyx.tableMappings)
- ✅ Basic where conditions (_eq, _ne, _like, _ilike, _gt, _lt, _in, _is_null)
- ✅ Field selection (returning)
- ✅ Type-aware operators
- ✅ Real-time query execution
- ✅ Schema integration
- ✅ UI components (cards, selects, inputs)
- ✅ **NEW: Multi-view tabs system** - exp, gql, query, subscription
- ✅ **NEW: GraphQL generation preview** - See generated queries before execution
- ✅ **NEW: Subscription support** - Real-time data streaming
- ✅ **NEW: Query/Subscription toggle** - Switch operation types in gql tab
- ✅ **NEW: Minimal inline design** - Table selection inline with title
- ✅ **NEW: Plus button field selection** - Add fields via dropdown
- ✅ **NEW: Recursive relations** - Nested query building for relations
- ✅ **NEW: Clean field management** - Remove fields with X button
- ✅ **NEW: Real table filtering** - Only actual tables (no _mapping tables)

### Phase 2: Essential Operations ❌
- ❌ **Sorting (order_by)** - `{ created_at: 'desc', name: 'asc' }`
- ❌ **Pagination** - `limit: 10, offset: 20`
- ❌ **Complex where logic** - `_and`, `_or` operators
- ❌ **Field search** - filter available fields
- ❌ **Query validation** - real-time validation feedback

### Phase 3: Advanced Queries ❌
- ❌ **Advanced nested relations** - More sophisticated relation handling
- ❌ **Relation filters** - `{ posts: { where: { published: true } } }`
- ❌ **Aggregations** - `count`, `sum`, `avg`, `max`, `min`
- ❌ **Distinct queries** - `distinct_on: ['email']`
- ❌ **Field aliases** - custom field names

### Phase 4: Mutations ❌
- ❌ **Insert operations** - `operation: 'insert', object: {...}`
- ❌ **Update operations** - `operation: 'update', _set: {...}`
- ❌ **Delete operations** - `operation: 'delete'`
- ❌ **Bulk operations** - multiple objects
- ❌ **Upsert support** - `on_conflict` handling

### Phase 5: Professional Features ❌
- ❌ **Query history** - save/load queries
- ❌ **Query templates** - predefined queries
- ❌ **Export options** - save as GraphQL/JSON
- ❌ **Performance** - query optimization hints
- ❌ **Query sharing** - shareable URLs

### Phase 6: Advanced Types ❌
- ❌ **JSON/JSONB fields** - object/array inputs
- ❌ **Enum support** - dropdown for enum values
- ❌ **Custom scalars** - date pickers, etc.
- ❌ **Array operations** - array contains, overlaps
- ❌ **Geographic queries** - spatial operators

## 🎯 Recommended Development Order

### Next Priority (Phase 2):
1. **Sorting** - Most requested feature
2. **Pagination** - Essential for large datasets  
3. **Complex where** - Enables advanced filtering
4. **Query validation** - Better developer experience

### Recent Major Updates ✅:
- **Multi-View Tabs System**: Complete redesign of right panel with 4 specialized views
- **GraphQL Preview**: Real-time GraphQL generation with variables display
- **Subscription Support**: Live data streaming with useSubscription tab
- **Operation Type Switching**: Toggle between query/subscription in gql tab
- **Inline Table Selection**: Space-efficient table picker integrated with title
- **Unified Field Design**: Where and Returning fields as cohesive blocks with separators
- **Minimalist Spacing**: Dramatically reduced padding throughout interface
- **Visual Consistency**: All elements share consistent height and styling
- **Smart Field Selection**: Context-aware field and relation selection
- **Recursive Relations**: Full nested query building support
- **Real Table Filtering**: Clean table list from `hasyx.tableMappings`

### Implementation Strategy:
```typescript
// 1. Current ConstructorState ✅ IMPLEMENTED
interface ConstructorState {
  table: string;
  where: Record<string, any>;
  returning: (string | NestedReturning)[];  // ✅ Supports nested relations
}

// 2. Nested Relations Support ✅ COMPLETED
interface NestedReturning {
  [relationName: string]: {
    where?: Record<string, any>;         // ✅ Relation filtering
    returning: (string | NestedReturning)[]; // ✅ Recursive nesting
  };
}

// 3. Tabs System ✅ COMPLETED
<Tabs defaultValue="exp">
  <TabsList>
    <TabsTrigger value="exp">exp</TabsTrigger>      // Hasyx options
    <TabsTrigger value="gql">gql</TabsTrigger>      // GraphQL + variables
    <TabsTrigger value="query">query</TabsTrigger>  // useQuery execution
    <TabsTrigger value="subscription">subscription</TabsTrigger> // useSubscription
  </TabsList>
</Tabs>
```

## 🔧 Technical Notes

### Schema Requirements
- Hasura schema at `/public/hasura-schema.json`
- **Real tables from `hasyx.tableMappings`** ✅ 
- Field types determine available operators
- **Automatic relation detection** ✅ 

### Performance
- **Real-time query execution in tabs** ✅ 
- **Conditional mounting** - Query/Subscription tabs only mount when active
- **Memoized generation** - GraphQL generation optimized with useMemo
- **Error handling** - Graceful error display in all tabs

### Testing Coverage
- ✅ **35 passing tests** (updated)
- ✅ Real schema validation
- ✅ Component integration tests
- ✅ Utility function tests
- ✅ **Tab system testing** ✅ NEW
- ✅ **GraphQL generation testing** ✅ NEW

### Browser Support
- Modern browsers with ES2020+
- React 18+ required
- Next.js 15+ integration
- **Radix UI Tabs** for accessible tab navigation

---

*Constructor is part of the Hasyx ecosystem for GraphQL operations with multi-view real-time results.* 