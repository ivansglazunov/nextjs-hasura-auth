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
      defaultTable="users"
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

// 3. Nested Relations Support ✅ NEW
const withRelations = {
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

### Real Schema Integration ✅ NEW

```typescript
// Constructor now automatically extracts ALL fields from schema
// Previously only showed id, created_at, updated_at for unknown tables
// Now shows ALL actual fields for ANY table:

// deep_links table: Shows 30+ fields including:
// _deep, _from, _to, _type, _value, _i, id, created_at, updated_at, etc.

// payments_providers table: Shows 24+ fields including:  
// config, name, type, user_id, is_active, is_test_mode, id, etc.

// Schema parsing automatically detects:
// - Scalar fields (for WHERE conditions)
// - Relation fields (for nested RETURNING)
// - Field types (determines available operators)
// - Table mappings (deep.links → deep_links)
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
          defaultTable="users"
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
  "table": "deep_links",
  "where": { "_deep": { "_eq": "some-uuid" }, "_from": { "_eq": "from-uuid" } },
  "returning": ["_deep", "_from", "_to", "_type", "_value", "id"]
}

// gql tab shows:
query QueryDeepLinks($v1: deep_links_bool_exp) {
  deep_links(where: $v1) {
    _deep
    _from
    _to
    _type
    _value
    id
  }
}
// Variables: { "v1": { "_deep": { "_eq": "some-uuid" } } }

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

### Schema-driven Development ✅ ENHANCED

```typescript
// Constructor automatically loads from /public/hasura-schema.json
// Available tables from hasyx.tableMappings (20+ tables)
// ALL fields extracted from GraphQL schema automatically

// Field types determine available operators:
// String fields: _eq, _ne, _like, _ilike, _in, _is_null
// Number/Int fields: _eq, _ne, _gt, _gte, _lt, _lte, _in, _is_null  
// Boolean fields: _eq, _ne
// UUID fields: _eq, _ne, _in, _is_null
// JSONB fields: _eq, _ne, _is_null
// DateTime fields: _eq, _ne, _gt, _gte, _lt, _lte, _in, _is_null

// Schema namespace mapping:
// deep.links → deep_links (GraphQL type: Deep_Links)
// payments.providers → payments_providers (GraphQL type: Payments_Providers)
// public.users → users (GraphQL type: Users)
```

## 🛣️ Development Roadmap

### Phase 1: Core Functionality ✅ COMPLETED
- ✅ Table selection from schema (hasyx.tableMappings)
- ✅ Basic where conditions (_eq, _ne, _like, _ilike, _gt, _lt, _in, _is_null)
- ✅ Field selection (returning)
- ✅ Type-aware operators
- ✅ Real-time query execution
- ✅ Schema integration
- ✅ UI components (cards, selects, inputs)
- ✅ **Multi-view tabs system** - exp, gql, query, subscription
- ✅ **GraphQL generation preview** - See generated queries before execution
- ✅ **Subscription support** - Real-time data streaming
- ✅ **Query/Subscription toggle** - Switch operation types in gql tab
- ✅ **Minimal inline design** - Table selection inline with title
- ✅ **Plus button field selection** - Add fields via dropdown
- ✅ **Recursive relations** - Nested query building for relations
- ✅ **Clean field management** - Remove fields with X button
- ✅ **Real table filtering** - Only actual tables (no _mapping tables)
- ✅ **FIXED: Real schema field parsing** - All fields displayed for all tables
- ✅ **FIXED: Deep links support** - 30+ fields instead of 3
- ✅ **FIXED: Payments providers support** - 24+ fields instead of 3
- ✅ **Performance optimized** - 5 tables parsed in ~8ms

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
- **🚀 BREAKING: Real Schema Field Parsing** - Complete overhaul of field extraction
- **🎯 Fixed: Deep Links Support** - Now shows all 30+ deep_links fields 
- **🎯 Fixed: Payments Providers Support** - Now shows all 24+ payments_providers fields
- **⚡ Performance: 8ms Schema Parsing** - Optimized for large schemas
- **🧪 Testing: 35 Passing Tests** - Comprehensive test coverage
- **🔄 GraphQL Type Mapping** - uuid→UUID, bigint→Int, timestamptz→DateTime, jsonb→JSONB
- **📋 Schema Namespace Resolution** - Automatic deep.links → deep_links mapping
- **🎨 Backward Compatibility** - users/accounts/notifications still work as before
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

// 3. Real Schema Field Parsing ✅ NEW IMPLEMENTATION
function getFieldsFromTable(schema: any, tableName: string): FieldInfo[] {
  // Find GraphQL type for table (with multiple naming strategies)
  const possibleTypeNames = [
    tableName,
    tableName.toLowerCase(),
    tableName.charAt(0).toUpperCase() + tableName.slice(1),
    tableName.split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('_')
  ];
  
  let graphqlType = schema?.data?.__schema?.types?.find((type: any) => 
    possibleTypeNames.includes(type.name)
  );
  
  if (graphqlType?.fields) {
    return graphqlType.fields.map((field: any) => ({
      name: field.name,
      type: mapGraphQLType(field.type), // uuid→UUID, bigint→Int, etc.
      isRelation: isRelationType(field.type),
      targetTable: getTargetTable(field.type)
    }));
  }
  
  // Fallback for unknown tables
  return [
    { name: 'id', type: 'String', isRelation: false },
    { name: 'created_at', type: 'DateTime', isRelation: false },
    { name: 'updated_at', type: 'DateTime', isRelation: false }
  ];
}

// 4. Tabs System ✅ COMPLETED
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
- **ALL fields extracted from GraphQL schema** ✅ NEW
- **Automatic type mapping and relation detection** ✅ NEW
- Field types determine available operators

### Performance ⚡ ENHANCED
- **Real-time query execution in tabs** ✅ 
- **Conditional mounting** - Query/Subscription tabs only mount when active
- **Memoized generation** - GraphQL generation optimized with useMemo
- **Error handling** - Graceful error display in all tabs
- **🚀 NEW: 8ms Schema Parsing** - Parse 5 tables with 100+ fields in under 8ms
- **🚀 NEW: Efficient Field Lookup** - Smart GraphQL type name resolution

### Field Display Fix ✅ MAJOR UPDATE
- **Before**: `deep_links` showed only 3 fields (id, created_at, updated_at)
- **After**: `deep_links` shows 30+ fields (_deep, _from, _to, _type, _value, _i, etc.)
- **Before**: `payments_providers` showed only 3 fields 
- **After**: `payments_providers` shows 24+ fields (config, name, type, user_id, is_active, etc.)
- **Schema Parser**: Real GraphQL schema parsing instead of hardcoded field lists
- **Type Mapping**: Automatic uuid→UUID, bigint→Int, timestamptz→DateTime conversion
- **Relation Detection**: Properly identifies scalar vs relation fields
- **Namespace Support**: Maps deep.links → deep_links, payments.providers → payments_providers

### Testing Coverage ✅ ENHANCED
- ✅ **35 passing tests** (updated after field display fix)
- ✅ Real schema validation (1.1MB+ schema file)
- ✅ Component integration tests
- ✅ Utility function tests
- ✅ **Tab system testing** ✅ 
- ✅ **GraphQL generation testing** ✅
- ✅ **🚀 NEW: Field display fix validation** - Tests for deep_links and payments_providers
- ✅ **🚀 NEW: Performance testing** - Schema parsing speed validation
- ✅ **🚀 NEW: Type mapping tests** - GraphQL type conversion validation

### Browser Support
- Modern browsers with ES2020+
- React 18+ required
- Next.js 15+ integration
- **Radix UI Tabs** for accessible tab navigation

---

*Constructor is part of the Hasyx ecosystem for GraphQL operations with multi-view real-time results and complete schema field support.* 