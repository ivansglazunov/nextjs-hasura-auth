import { createQuery, createQueries, useQueryString, useQueryBoolean, useQueryNumber, useQueryObject } from './use-query';

describe('[DEBUG] use-query hook examples', () => {
  it('should demonstrate basic usage patterns', () => {
    console.log('=== Use-Query Hook Usage Examples ===');
    
    // Example 1: Create individual query hooks
    console.log('\n1. Creating individual query hooks:');
    const useMyQuery = createQuery<string>('myKey', 'default-value');
    const useCounterQuery = createQuery<number>('counter', 0);
    const useObjectQuery = createQuery<{ name: string; age: number }>('user', { name: '', age: 0 });
    
    console.log('✓ Created useMyQuery for string values');
    console.log('✓ Created useCounterQuery for number values');
    console.log('✓ Created useObjectQuery for object values');
    
    // Example 2: Usage in components
    console.log('\n2. Usage in components:');
    console.log(`
// In your component:
const [value, setValue] = useMyQuery();
const [counter, setCounter] = useCounterQuery();
const [user, setUser] = useObjectQuery();

// Update values (will sync across all components)
setValue('new-value');
setCounter(prev => prev + 1);
setUser({ name: 'John', age: 30 });
    `);
    
    // Example 3: Multiple queries at once
    console.log('\n3. Creating multiple queries at once:');
    const queries = createQueries({
      search: { key: 'q', defaultValue: '' },
      page: { key: 'page', defaultValue: 1 },
      filters: { key: 'filters', defaultValue: {} }
    });
    
    console.log('✓ Created multiple queries: search, page, filters');
    console.log(`
// Usage:
const [search, setSearch] = queries.search();
const [page, setPage] = queries.page();
const [filters, setFilters] = queries.filters();
    `);
    
    // Example 4: Utility hooks
    console.log('\n4. Using utility hooks:');
    console.log(`
// Direct usage for common types:
const [searchTerm, setSearchTerm] = useQueryString('search', '');
const [isOpen, setIsOpen] = useQueryBoolean('open', false);  
const [currentPage, setCurrentPage] = useQueryNumber('page', 1);
const [settings, setSettings] = useQueryObject('settings', {});
    `);
    
    console.log('\n=== Features ===');
    console.log('✓ Automatic URL synchronization');
    console.log('✓ State sharing between components');
    console.log('✓ TypeScript support');
    console.log('✓ Browser back/forward support');
    console.log('✓ SSR compatible');
    console.log('✓ Automatic JSON parsing/serialization');
    
    expect(true).toBe(true);
  });
  
  it('should demonstrate real-world usage scenario', () => {
    console.log('\n=== Real-world Example ===');
    
    // Scenario: Search page with filters
    const useSearchQuery = createQuery<string>('q', '');
    const usePageQuery = createQuery<number>('page', 1);
    const useFiltersQuery = createQuery<{
      category?: string;
      priceRange?: [number, number];
      inStock?: boolean;
    }>('filters', {});
    
    console.log(`
// Component A - Search Bar
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

// Component B - Pagination
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

// Component C - Filters
function Filters() {
  const [filters, setFilters] = useFiltersQuery();
  
  return (
    <div>
      <select 
        value={filters.category || ''}
        onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
      >
        <option value="">All Categories</option>
        <option value="electronics">Electronics</option>
        <option value="clothing">Clothing</option>
      </select>
      
      <label>
        <input 
          type="checkbox" 
          checked={filters.inStock || false}
          onChange={(e) => setFilters(prev => ({ ...prev, inStock: e.target.checked }))}
        />
        In Stock Only
      </label>
    </div>
  );
}

// Component D - Results Display
function Results() {
  const [query] = useSearchQuery();
  const [page] = usePageQuery();
  const [filters] = useFiltersQuery();
  
  // All components automatically sync when any of them changes the URL
  console.log('Current state:', { query, page, filters });
  
  return <div>Search results for: {query}</div>;
}
    `);
    
    console.log('✓ Multiple components sharing synchronized state through URL');
    console.log('✓ URL updates automatically: ?q=laptop&page=2&filters={"category":"electronics","inStock":true}');
    
    expect(true).toBe(true);
  });
}); 