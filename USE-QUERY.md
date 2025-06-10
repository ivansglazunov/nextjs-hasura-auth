# Use-Query Hook

The `use-query` hook provides a powerful way to synchronize state between multiple components using URL query parameters. This allows you to create shareable URLs and maintain state across browser sessions, page refreshes, and component remounts.

## Features

- ✅ **Automatic URL Synchronization** - State changes are immediately reflected in the URL
- ✅ **Multi-Component State Sharing** - Multiple components automatically sync when any component updates the state
- ✅ **TypeScript Support** - Full type safety for all query parameters
- ✅ **Browser Navigation Support** - Works with browser back/forward buttons
- ✅ **SSR Compatible** - Safe to use in Next.js server-side rendering
- ✅ **JSON Serialization** - Automatically handles objects, arrays, and primitive types
- ✅ **Global State Store** - All components share the same state for each query key

## Installation

The `use-query` hook is available in the `hooks/` directory:

```typescript
import { createQuery, useQueryString, useQueryBoolean } from '@/hooks/use-query';
```

## Basic Usage

### 1. Create Individual Query Hooks

```typescript
// Define hooks at the file level
const useSearchQuery = createQuery<string>('search', '');
const usePageQuery = createQuery<number>('page', 1);
const useFiltersQuery = createQuery<{
  category?: string;
  priceRange?: [number, number];
  inStock?: boolean;
}>('filters', {});

// Use in components
function SearchBar() {
  const [query, setQuery] = useSearchQuery();
  
  return (
    <input 
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Search products..."
    />
  );
}

function Pagination() {
  const [page, setPage] = usePageQuery();
  
  return (
    <div>
      <button onClick={() => setPage(prev => Math.max(1, prev - 1))}>
        Previous
      </button>
      <span>Page {page}</span>
      <button onClick={() => setPage(prev => prev + 1)}>
        Next
      </button>
    </div>
  );
}
```

### 2. Create Multiple Queries at Once

```typescript
const queries = createQueries({
  search: { key: 'q', defaultValue: '' },
  page: { key: 'page', defaultValue: 1 },
  filters: { key: 'filters', defaultValue: {} },
  sort: { key: 'sort', defaultValue: 'name' }
});

// Usage in components
function SearchPage() {
  const [search, setSearch] = queries.search();
  const [page, setPage] = queries.page();
  const [filters, setFilters] = queries.filters();
  const [sort, setSort] = queries.sort();
  
  // All state is automatically synchronized across components
  return (
    <div>
      <SearchInput value={search} onChange={setSearch} />
      <Filters value={filters} onChange={setFilters} />
      <SortSelect value={sort} onChange={setSort} />
      <Pagination page={page} onPageChange={setPage} />
    </div>
  );
}
```

### 3. Utility Hooks for Common Types

For simple use cases, you can use the pre-built utility hooks:

```typescript
function MyComponent() {
  // String values
  const [searchTerm, setSearchTerm] = useQueryString('search', '');
  
  // Boolean values
  const [isOpen, setIsOpen] = useQueryBoolean('sidebar', false);
  
  // Number values
  const [currentPage, setCurrentPage] = useQueryNumber('page', 1);
  
  // Object/array values
  const [settings, setSettings] = useQueryObject('settings', { theme: 'light' });
  
  return (
    <div>
      <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      <button onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? 'Close' : 'Open'} Sidebar
      </button>
      <select value={currentPage} onChange={(e) => setCurrentPage(Number(e.target.value))}>
        <option value={1}>Page 1</option>
        <option value={2}>Page 2</option>
      </select>
    </div>
  );
}
```

## API Reference

### `createQuery<T>(key: string, defaultValue?: T)`

Creates a query hook for the specified URL parameter key.

**Parameters:**
- `key` - The URL parameter key (e.g., 'search', 'page', 'filters')
- `defaultValue` - The default value when the parameter is not present in the URL

**Returns:**
A hook function that returns `[value, setValue]` tuple.

**Example:**
```typescript
const useMyQuery = createQuery<string>('myParam', 'default');
const [value, setValue] = useMyQuery();
```

### `createQueries<T>(schema)`

Creates multiple query hooks at once using a schema definition.

**Parameters:**
- `schema` - Object defining the query hooks to create

**Example:**
```typescript
const queries = createQueries({
  search: { key: 'q', defaultValue: '' },
  page: { key: 'page', defaultValue: 1 }
});

const [search, setSearch] = queries.search();
const [page, setPage] = queries.page();
```

### Utility Hooks

#### `useQueryString(key: string, defaultValue?: string)`
Hook for string values.

#### `useQueryBoolean(key: string, defaultValue?: boolean)`
Hook for boolean values.

#### `useQueryNumber(key: string, defaultValue?: number)`
Hook for number values.

#### `useQueryObject<T>(key: string, defaultValue?: T)`
Hook for object/array values.

## Setter Functions

All query hooks return a setter function that can be used in two ways:

### Direct Value Setting
```typescript
const [value, setValue] = useQueryString('search', '');

// Set directly
setValue('new value');
```

### Functional Updates
```typescript
const [count, setCount] = useQueryNumber('count', 0);

// Update based on previous value
setCount(prev => prev + 1);
```

## URL Behavior

### Parameter Serialization

- **Strings**: Stored as-is in the URL
- **Numbers**: Converted to string, parsed back to number
- **Booleans**: Converted to string, parsed back to boolean
- **Objects/Arrays**: JSON stringified/parsed automatically

### URL Examples

```
# String parameter
?search=laptop

# Number parameter  
?page=2

# Boolean parameter
?open=true

# Object parameter
?filters={"category":"electronics","inStock":true}

# Multiple parameters
?search=laptop&page=2&filters={"category":"electronics"}&open=true
```

### Empty Values

- Empty strings, null, or undefined values remove the parameter from the URL
- This keeps URLs clean and readable

## Real-World Example

Here's a complete example of a search page with filters, pagination, and sorting:

```typescript
// hooks/search-queries.ts
import { createQueries } from './use-query';

export const searchQueries = createQueries({
  search: { key: 'q', defaultValue: '' },
  page: { key: 'page', defaultValue: 1 },
  category: { key: 'category', defaultValue: '' },
  priceMin: { key: 'price_min', defaultValue: 0 },
  priceMax: { key: 'price_max', defaultValue: 1000 },
  inStock: { key: 'in_stock', defaultValue: false },
  sort: { key: 'sort', defaultValue: 'name' }
});

// components/SearchBar.tsx
export function SearchBar() {
  const [search, setSearch] = searchQueries.search();
  
  return (
    <input
      type="text"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      placeholder="Search products..."
      className="w-full p-2 border rounded"
    />
  );
}

// components/Filters.tsx
export function Filters() {
  const [category, setCategory] = searchQueries.category();
  const [priceMin, setPriceMin] = searchQueries.priceMin();
  const [priceMax, setPriceMax] = searchQueries.priceMax();
  const [inStock, setInStock] = searchQueries.inStock();
  
  return (
    <div className="space-y-4">
      <select value={category} onChange={(e) => setCategory(e.target.value)}>
        <option value="">All Categories</option>
        <option value="electronics">Electronics</option>
        <option value="clothing">Clothing</option>
        <option value="books">Books</option>
      </select>
      
      <div className="flex gap-2">
        <input
          type="number"
          value={priceMin}
          onChange={(e) => setPriceMin(Number(e.target.value))}
          placeholder="Min price"
        />
        <input
          type="number"
          value={priceMax}
          onChange={(e) => setPriceMax(Number(e.target.value))}
          placeholder="Max price"
        />
      </div>
      
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={inStock}
          onChange={(e) => setInStock(e.target.checked)}
        />
        In Stock Only
      </label>
    </div>
  );
}

// components/Pagination.tsx
export function Pagination({ totalPages }: { totalPages: number }) {
  const [page, setPage] = searchQueries.page();
  
  return (
    <div className="flex gap-2">
      <button
        onClick={() => setPage(prev => Math.max(1, prev - 1))}
        disabled={page <= 1}
      >
        Previous
      </button>
      
      <span>Page {page} of {totalPages}</span>
      
      <button
        onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
        disabled={page >= totalPages}
      >
        Next
      </button>
    </div>
  );
}

// components/ProductList.tsx
export function ProductList() {
  // All query parameters are automatically available
  const [search] = searchQueries.search();
  const [page] = searchQueries.page();
  const [category] = searchQueries.category();
  const [priceMin] = searchQueries.priceMin();
  const [priceMax] = searchQueries.priceMax();
  const [inStock] = searchQueries.inStock();
  const [sort] = searchQueries.sort();
  
  // Use these values to fetch data
  const { data, loading } = useQuery(GET_PRODUCTS, {
    variables: {
      search,
      page,
      category,
      price_min: priceMin,
      price_max: priceMax,
      in_stock: inStock,
      sort
    }
  });
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div>
      {data?.products?.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

// pages/search.tsx
export default function SearchPage() {
  return (
    <div className="container mx-auto p-4">
      <h1>Product Search</h1>
      
      {/* All components automatically sync through URL */}
      <SearchBar />
      <Filters />
      <ProductList />
      <Pagination totalPages={10} />
    </div>
  );
}
```

## Best Practices

### 1. Choose Meaningful Parameter Names
Use descriptive, URL-friendly parameter names:
```typescript
// Good
const useSearchQuery = createQuery('search', '');
const usePageQuery = createQuery('page', 1);

// Avoid
const useQuery1 = createQuery('q1', '');
const useQuery2 = createQuery('p', 1);
```

### 2. Provide Sensible Defaults
Always provide default values that make sense for your use case:
```typescript
const usePageQuery = createQuery('page', 1); // Start at page 1
const useSearchQuery = createQuery('search', ''); // Empty search
const useFiltersQuery = createQuery('filters', {}); // No filters
```

### 3. Use TypeScript for Complex Objects
Define interfaces for complex query parameters:
```typescript
interface ProductFilters {
  category?: string;
  priceRange?: [number, number];
  inStock?: boolean;
  brands?: string[];
}

const useFiltersQuery = createQuery<ProductFilters>('filters', {});
```

### 4. Keep URLs Clean
Remove empty or default values to keep URLs clean:
```typescript
// The hook automatically removes empty/null/undefined values
setValue(''); // Removes parameter from URL
setValue(null); // Removes parameter from URL
setValue(undefined); // Removes parameter from URL
```

### 5. Group Related Queries
Create query groups for related functionality:
```typescript
// Group search-related queries
export const searchQueries = createQueries({
  search: { key: 'q', defaultValue: '' },
  page: { key: 'page', defaultValue: 1 },
  filters: { key: 'filters', defaultValue: {} }
});

// Group user preferences
export const preferenceQueries = createQueries({
  theme: { key: 'theme', defaultValue: 'light' },
  language: { key: 'lang', defaultValue: 'en' },
  sidebar: { key: 'sidebar', defaultValue: true }
});
```

## Integration with Next.js

The `use-query` hook is fully compatible with Next.js App Router and works seamlessly with:

- **Server-Side Rendering (SSR)** - Safe to use on the server
- **Client-Side Navigation** - Works with Next.js routing
- **Static Site Generation (SSG)** - Compatible with static builds
- **Middleware** - Can be used with Next.js middleware

## Performance Considerations

- **Minimal Re-renders** - Components only re-render when their specific query parameters change
- **Shared State** - All components using the same query key share the same state instance
- **URL Updates** - Uses `replaceState` to avoid cluttering browser history
- **Memory Efficient** - Automatic cleanup of unused query stores

## Troubleshooting

### Common Issues

1. **Query not updating across components**
   - Ensure all components use the same query key
   - Check that the query hook is created at the module level, not inside components

2. **URL not updating**
   - Verify the component is running on the client side
   - Check browser console for any JavaScript errors

3. **Values not persisting on page refresh**
   - Ensure the query hook is initialized before the component mounts
   - Verify the URL contains the expected parameters

4. **TypeScript errors**
   - Provide explicit type parameters: `createQuery<string>('key', 'default')`
   - Ensure default values match the specified type

### Debug Tips

```typescript
// Add logging to debug query updates
const [value, setValue] = useQueryString('search', '');

useEffect(() => {
  console.log('Query value changed:', value);
}, [value]);
```

## Migration from Other State Management

### From useState
```typescript
// Before
const [search, setSearch] = useState('');

// After  
const [search, setSearch] = useQueryString('search', '');
```

### From Zustand
```typescript
// Before
const useStore = create((set) => ({
  search: '',
  setSearch: (search) => set({ search })
}));

// After
const [search, setSearch] = useQueryString('search', '');
```

### From Redux
```typescript
// Before
const search = useSelector(state => state.search);
const dispatch = useDispatch();
const setSearch = (value) => dispatch(setSearchValue(value));

// After
const [search, setSearch] = useQueryString('search', '');
```

The `use-query` hook provides a simple, powerful way to manage shared state through URL parameters, making your application more user-friendly with shareable, bookmarkable URLs. 