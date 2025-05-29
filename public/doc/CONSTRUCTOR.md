# 🏗️ Hasyx Query Constructor

Visual GraphQL query builder for Hasyx with real-time results.

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

// 3. Real-time Query Execution
const { data, loading, error } = useQuery({
  table: query.table,
  where: query.where,
  returning: query.returning
});
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
  
  const { data } = useQuery(constructorState);
  
  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Left: Constructor */}
      <HasyxConstructor 
        value={constructorState}
        onChange={setConstructorState}
      />
      
      {/* Right: Results */}
      <div>
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </div>
    </div>
  );
}
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
- ✅ **NEW: Minimal padding design** - Reduced spacing throughout interface
- ✅ **NEW: Plus button field selection** - Add fields via dropdown
- ✅ **NEW: Recursive relations** - Nested query building for relations
- ✅ **NEW: Clean field management** - Remove fields with X button
- ✅ **NEW: Real table filtering** - Only actual tables (no _mapping tables)

### Phase 2: Essential Operations ❌
- ❌ **Sorting (order_by)** - `{ created_at: 'desc', name: 'asc' }`
- ❌ **Pagination** - `limit: 10, offset: 20`
- ❌ **Complex where logic** - `_and`, `_or` operators
- ❌ **Subscription mode** - switch query/subscription
- ❌ **Field search** - filter available fields

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
- ❌ **Validation** - real-time query validation
- ❌ **Performance** - query optimization hints

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
4. **Subscription toggle** - Real-time data

### Recent Improvements ✅:
- **Unified Field Design**: Where and Returning fields now appear as single cohesive blocks with separators [fieldname|operator|input|delete]
- **Circular Plus Buttons**: Strictly circular + buttons without dropdown arrows using `[&>svg]:hidden` to hide default SelectTrigger arrows
- **Minimalist Spacing**: Dramatically reduced padding and margins throughout interface (text-xs, p-1, p-2, mb-1)
- **Visual Consistency**: All interface elements now share consistent height (h-5, h-6) and rounded corner treatment
- **Improved Header Layout**: Where and Returning sections use flex justify-between with labels left, + buttons right
- **Enhanced Where Conditions**: Both regular fields and relations available in where conditions dropdown
- **Full-Width Elements**: All field blocks now use w-full with delete buttons consistently positioned on the right
- **Smart Field Selection**: Plus button reveals only relevant fields for selected table, including both regular fields and relations
- **Recursive Relations**: Full support for nested query building with relation conditions and field selection
- **Real Table Filtering**: Extracts only actual tables from `hasyx.tableMappings`, filtering out internal and mapping tables
- **Clean UI Labels**: Simplified "Where Conditions" → "Where", "Returning Fields" → "Returning"

### Implementation Strategy:
```typescript
// 1. Add to ConstructorState
interface ConstructorState {
  table: string;
  where: Record<string, any>;
  returning: (string | NestedReturning)[];  // ✅ UPDATED: Now supports nested relations
  order_by?: Array<{ [field: string]: 'asc' | 'desc' }>; // NEW
  limit?: number;    // NEW
  offset?: number;   // NEW
}

// 2. Nested Relations Support ✅ COMPLETED
interface NestedReturning {
  [relationName: string]: {
    where?: Record<string, any>;         // ✅ Relation filtering
    returning: (string | NestedReturning)[]; // ✅ Recursive nesting
  };
}

// 3. UI Components ✅ COMPLETED
<Card>
  <CardContent>
    <Label>Where</Label>
    <Select> {/* Plus button for adding fields */}
      <Plus className="h-3 w-3" />
    </Select>
  </CardContent>
</Card>
```

## 🔧 Technical Notes

### Schema Requirements
- Hasura schema at `/public/hasura-schema.json`
- **Real tables from `hasyx.tableMappings`** ✅ NEW
- Field types determine available operators
- **Automatic relation detection** ✅ NEW

### Performance
- Real-time queries on every change
- Debounce recommended for production
- Consider query caching
- **Minimal re-renders with optimized state management** ✅ NEW

### Testing Coverage
- ✅ **35 passing tests** (updated)
- ✅ Real schema validation
- ✅ Component integration tests
- ✅ Utility function tests
- ✅ **Recursive relation testing** ✅ NEW

### Browser Support
- Modern browsers with ES2020+
- React 18+ required
- Next.js 15+ integration

---

*Constructor is part of the Hasyx ecosystem for GraphQL operations.* 