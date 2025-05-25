import { Hasura, ColumnType } from './hasura';
import { v4 as uuidv4 } from 'uuid';
import Debug from './debug';

const debug = Debug('hasura:test');

// Mock Hasura client for testing without real server
class MockHasura extends Hasura {
  private mockSchemas: Set<string> = new Set();
  private mockTables: Map<string, Set<string>> = new Map();
  private mockColumns: Map<string, Record<string, any>> = new Map();
  private mockFunctions: Set<string> = new Set();
  private mockTriggers: Set<string> = new Set();
  private mockViews: Set<string> = new Set();
  private mockEventTriggers: Set<string> = new Set();
  private mockConstraints: Set<string> = new Set();

  async sql(sql: string): Promise<any> {
    debug(`Mock SQL: ${sql}`);
    
    // Mock schema creation
    if (sql.includes('CREATE SCHEMA IF NOT EXISTS')) {
      const schemaMatch = sql.match(/CREATE SCHEMA IF NOT EXISTS "([^"]+)"/);
      if (schemaMatch) {
        this.mockSchemas.add(schemaMatch[1]);
      }
      return { result: [['result'], [true]] };
    }
    
    // Mock schema creation (without IF NOT EXISTS)
    if (sql.includes('CREATE SCHEMA') && !sql.includes('IF NOT EXISTS')) {
      const schemaMatch = sql.match(/CREATE SCHEMA "([^"]+)"/);
      if (schemaMatch) {
        this.mockSchemas.add(schemaMatch[1]);
        debug(`Added schema to mock: ${schemaMatch[1]}, total schemas: ${Array.from(this.mockSchemas)}`);
      }
      return { result: [['result'], [true]] };
    }
    
    // Mock schema existence check
    if (sql.includes('SELECT EXISTS') && sql.includes('information_schema.schemata')) {
      const schemaMatch = sql.match(/schema_name = '([^']+)'/);
      if (schemaMatch) {
        const exists = this.mockSchemas.has(schemaMatch[1]);
        debug(`Schema existence check for ${schemaMatch[1]}: ${exists}`);
        return { result: [['exists'], [exists]] };
      }
    }
    
    // Mock table creation
    if (sql.includes('CREATE TABLE')) {
      const tableMatch = sql.match(/CREATE TABLE "([^"]+)"."([^"]+)"/);
      if (tableMatch) {
        const [, schema, table] = tableMatch;
        // Ensure schema exists in mockSchemas
        this.mockSchemas.add(schema);
        if (!this.mockTables.has(schema)) {
          this.mockTables.set(schema, new Set());
        }
        this.mockTables.get(schema)!.add(table);
        
        // Add default columns
        const key = `${schema}.${table}`;
        this.mockColumns.set(key, {
          id: { type: 'uuid', _type: 'uuid' },
          created_at: { type: 'bigint', _type: 'int8' },
          updated_at: { type: 'bigint', _type: 'int8' }
        });
        debug(`Added columns for ${key}: ${JSON.stringify(this.mockColumns.get(key))}`);
      }
      return { result: [['result'], [true]] };
    }
    
    // Mock table existence check
    if (sql.includes('SELECT EXISTS') && sql.includes('information_schema.tables')) {
      const tableMatch = sql.match(/table_schema\s*=\s*'([^']+)'\s*AND\s*table_name\s*=\s*'([^']+)'/);
      if (tableMatch) {
        const [, schema, table] = tableMatch;
        // Only return true if both schema and table exist
        const schemaExists = this.mockTables.has(schema);
        const tableExists = schemaExists && this.mockTables.get(schema)!.has(table);
        return { result: [['exists'], [tableExists]] };
      }
      return { result: [['exists'], [false]] };
    }
    
    // Mock schemas list
    if (sql.includes('SELECT schema_name') && sql.includes('information_schema.schemata')) {
      const schemas = Array.from(this.mockSchemas).map(s => [s]);
      debug(`Returning schemas list: ${JSON.stringify(schemas)}`);
      return { result: [['schema_name'], ...schemas] };
    }
    
    // Mock tables list
    if (sql.includes('SELECT table_name') && sql.includes('information_schema.tables')) {
      const schemaMatch = sql.match(/table_schema\s*=\s*'([^']+)'/);
      if (schemaMatch) {
        const schema = schemaMatch[1];
        const tables = Array.from(this.mockTables.get(schema) || []).map(t => [t]);
        debug(`Returning tables list for schema ${schema}: ${JSON.stringify(tables)}`);
        return { result: [['table_name'], ...tables] };
      }
    }
    
    // Mock columns list
    if (sql.includes('SELECT column_name, data_type, udt_name') && sql.includes('information_schema.columns')) {
      const tableMatch = sql.match(/table_schema\s*=\s*'([^']+)'\s*AND\s*table_name\s*=\s*'([^']+)'/);
      if (tableMatch) {
        const [, schema, table] = tableMatch;
        const key = `${schema}.${table}`;
        const columns = this.mockColumns.get(key) || {};
        debug(`Looking for columns for ${key}, found: ${JSON.stringify(columns)}`);
        debug(`All mock columns: ${JSON.stringify(Array.from(this.mockColumns.entries()))}`);
        const columnRows = Object.entries(columns).map(([name, info]) => [name, info.type, info._type]);
        debug(`Returning columns list for ${key}: ${JSON.stringify(columnRows)}`);
        return { result: [['column_name', 'data_type', 'udt_name'], ...columnRows] };
      }
    }
    
    // Mock column addition
    if (sql.includes('ALTER TABLE') && sql.includes('ADD COLUMN')) {
      const tableMatch = sql.match(/ALTER TABLE "([^"]+)"."([^"]+)"/);
      const columnMatch = sql.match(/ADD COLUMN "([^"]+)" (\w+)/);
      if (tableMatch && columnMatch) {
        const [, schema, table] = tableMatch;
        const [, columnName, columnType] = columnMatch;
        const key = `${schema}.${table}`;
        const columns = this.mockColumns.get(key) || {};
        columns[columnName] = { type: columnType, _type: columnType };
        this.mockColumns.set(key, columns);
        debug(`Added column ${columnName} to ${key}: ${JSON.stringify(columns[columnName])}`);
      }
      return { result: [['result'], [true]] };
    }
    
    // Mock column deletion
    if (sql.includes('ALTER TABLE') && sql.includes('DROP COLUMN')) {
      const tableMatch = sql.match(/ALTER TABLE "([^"]+)"."([^"]+)"/);
      const columnMatch = sql.match(/DROP COLUMN "([^"]+)"/);
      if (tableMatch && columnMatch) {
        const [, schema, table] = tableMatch;
        const [, columnName] = columnMatch;
        const key = `${schema}.${table}`;
        const columns = this.mockColumns.get(key) || {};
        delete columns[columnName];
        this.mockColumns.set(key, columns);
        debug(`Removed column ${columnName} from ${key}`);
      }
      return { result: [['result'], [true]] };
    }
    
    // Mock single column existence check (for deleteColumn)
    if (sql.includes('SELECT column_name') && sql.includes('information_schema.columns') && !sql.includes('data_type')) {
      const match = sql.match(/table_schema\s*=\s*'([^']+)'\s*AND\s*table_name\s*=\s*'([^']+)'\s*AND\s*column_name\s*=\s*'([^']+)'/);
      if (match) {
        const [, schema, table, column] = match;
        const key = `${schema}.${table}`;
        const columns = this.mockColumns.get(key) || {};
        if (columns[column]) {
          return { result: [['column_name'], [column]] };
        } else {
          return { result: [['column_name']] };
        }
      }
    }
    
    // Mock column modification
    if (sql.includes('ALTER TABLE') && sql.includes('ALTER COLUMN') && sql.includes('TYPE')) {
      const match = sql.match(/ALTER TABLE "([^"]+)"."([^"]+)" ALTER COLUMN "([^"]+)" TYPE (\w+)/);
      if (match) {
        const [, schema, table, column, type] = match;
        const key = `${schema}.${table}`;
        const columns = this.mockColumns.get(key) || {};
        if (columns[column]) {
          columns[column] = { type: type.toLowerCase(), _type: type.toLowerCase() };
          this.mockColumns.set(key, columns);
        }
      }
      return { result: [['result'], [true]] };
    }
    
    // Mock column existence check
    if (sql.includes('SELECT column_name, data_type') && sql.includes('WHERE table_schema')) {
      const match = sql.match(/table_schema\s*=\s*'([^']+)'\s*AND\s*table_name\s*=\s*'([^']+)'\s*AND\s*column_name\s*=\s*'([^']+)'/);
      if (match) {
        const [, schema, table, column] = match;
        const key = `${schema}.${table}`;
        const columns = this.mockColumns.get(key) || {};
        if (columns[column]) {
          const columnInfo = columns[column];
          return { result: [['column_name', 'data_type', 'is_nullable', 'column_default'], [column, columnInfo.type, 'YES', null]] };
        } else {
          return { result: [['column_name', 'data_type', 'is_nullable', 'column_default']] };
        }
      }
    }
    
    // Mock function operations
    if (sql.includes('CREATE FUNCTION') || sql.includes('CREATE OR REPLACE FUNCTION')) {
      const match = sql.match(/FUNCTION "([^"]+)"."([^"]+)"/);
      if (match) {
        const [, schema, name] = match;
        this.mockFunctions.add(`${schema}.${name}`);
      }
      return { result: [['result'], [true]] };
    }
    
    // Mock function existence check
    if (sql.includes('SELECT EXISTS') && sql.includes('pg_proc')) {
      const match = sql.match(/n\.nspname = '([^']+)' AND p\.proname = '([^']+)'/);
      if (match) {
        const [, schema, name] = match;
        const exists = this.mockFunctions.has(`${schema}.${name}`);
        return { result: [['exists'], [exists]] };
      }
    }
    
    // Mock trigger operations
    if (sql.includes('CREATE TRIGGER')) {
      const match = sql.match(/CREATE TRIGGER "([^"]+)"/);
      if (match) {
        this.mockTriggers.add(match[1]);
      }
      return { result: [['result'], [true]] };
    }
    
    // Mock trigger existence check
    if (sql.includes('SELECT EXISTS') && sql.includes('pg_trigger')) {
      const match = sql.match(/tgname = '([^']+)'/);
      if (match) {
        const exists = this.mockTriggers.has(match[1]);
        return { result: [['exists'], [exists]] };
      }
    }
    
    // Mock view operations
    if (sql.includes('CREATE VIEW')) {
      const match = sql.match(/CREATE VIEW "([^"]+)"."([^"]+)"/);
      if (match) {
        const [, schema, name] = match;
        this.mockViews.add(`${schema}.${name}`);
      }
      return { result: [['result'], [true]] };
    }
    
    // Mock view existence check
    if (sql.includes('SELECT EXISTS') && sql.includes('information_schema.views')) {
      const match = sql.match(/table_schema = '([^']+)' AND table_name = '([^']+)'/);
      if (match) {
        const [, schema, name] = match;
        const exists = this.mockViews.has(`${schema}.${name}`);
        return { result: [['exists'], [exists]] };
      }
    }
    
    // Mock constraint operations
    if (sql.includes('ALTER TABLE') && sql.includes('ADD CONSTRAINT')) {
      const match = sql.match(/ADD CONSTRAINT "([^"]+)"/);
      if (match) {
        this.mockConstraints.add(match[1]);
      }
      return { result: [['result'], [true]] };
    }
    
    // Mock constraint drop
    if (sql.includes('ALTER TABLE') && sql.includes('DROP CONSTRAINT')) {
      const match = sql.match(/DROP CONSTRAINT IF EXISTS "([^"]+)"/);
      if (match) {
        this.mockConstraints.delete(match[1]);
      }
      return { result: [['result'], [true]] };
    }
    
    // Mock constraint existence check
    if (sql.includes('SELECT EXISTS') && sql.includes('information_schema.table_constraints')) {
      let constraintName = '';
      
      const match1 = sql.match(/constraint_name = '([^']+)'/);
      if (match1) {
        constraintName = match1[1];
      }
      
      const match2 = sql.match(/AND constraint_name = '([^']+)'/);
      if (match2) {
        constraintName = match2[1];
      }
      
      if (constraintName) {
        const exists = this.mockConstraints.has(constraintName);
        return { result: [['exists'], [exists]] };
      }
      
      return { result: [['exists'], [false]] };
    }
    
    // Mock schema deletion
    if (sql.includes('DROP SCHEMA IF EXISTS') && sql.includes('CASCADE')) {
      const match = sql.match(/DROP SCHEMA IF EXISTS "([^"]+)" CASCADE/);
      if (match) {
        const schema = match[1];
        this.mockSchemas.delete(schema);
        this.mockTables.delete(schema);
        for (const key of this.mockColumns.keys()) {
          if (key.startsWith(`${schema}.`)) {
            this.mockColumns.delete(key);
          }
        }
      }
      return { result: [['result'], [true]] };
    }
    
    // Default mock response
    debug(`Unhandled SQL query: ${sql}`);
    return { result: [['result'], [true]] };
  }

  async v1(request: { type: string; args: object }): Promise<any> {
    debug(`Mock v1: ${request.type}`);
    
    // Mock event trigger operations
    if (request.type === 'pg_create_event_trigger') {
      const args = request.args as any;
      this.mockEventTriggers.add(args.name);
      return { message: 'success' };
    }
    
    if (request.type === 'pg_delete_event_trigger') {
      const args = request.args as any;
      this.mockEventTriggers.delete(args.name);
      return { message: 'success' };
    }
    
    // Mock metadata operations
    if (request.type === 'export_metadata') {
      return { version: 3, sources: [] };
    }
    
    if (request.type === 'reload_metadata') {
      return { message: 'success' };
    }
    
    if (request.type === 'get_inconsistent_metadata') {
      return { inconsistent_objects: [] };
    }
    
    // Mock tracking operations
    if (request.type === 'pg_track_table' || request.type === 'pg_untrack_table') {
      return { message: 'success' };
    }
    
    // Mock relationship operations
    if (request.type.includes('relationship')) {
      return { message: 'success' };
    }
    
    // Mock permission operations
    if (request.type.includes('permission')) {
      return { message: 'success' };
    }
    
    // Mock computed field operations
    if (request.type.includes('computed_field')) {
      return { message: 'success' };
    }
    
    // Mock remote schema operations
    if (request.type.includes('remote_schema')) {
      return { message: 'success' };
    }
    
    // Mock cron trigger operations
    if (request.type.includes('cron_trigger')) {
      return { message: 'success' };
    }
    
    return { message: 'success' };
  }
}

// Initialize Mock Hasura client
const hasura = new MockHasura({
  url: 'http://localhost:8080',
  secret: 'mock-secret'
});

describe('Hasura Class Tests', () => {
  
  describe('Schema Operations', () => {
    test('createSchema, defineSchema, deleteSchema', async () => {
      const testSchema = `test_${uuidv4().replace(/-/g, '_')}`;
      debug(`Testing schema operations with ${testSchema}`);
      
      try {
        // Test createSchema
        await hasura.createSchema({ schema: testSchema });
        
        // Verify schema exists
        const schemas = await hasura.schemas();
        expect(schemas).toContain(testSchema);
        
        // Test createSchema fails if exists
        await expect(hasura.createSchema({ schema: testSchema })).rejects.toThrow();
        
        // Delete schema
        await hasura.deleteSchema({ schema: testSchema });
        
        // Test defineSchema (idempotent)
        await hasura.defineSchema({ schema: testSchema });
        await hasura.defineSchema({ schema: testSchema }); // Should not fail
        
        // Verify schema exists
        const schemasAfterDefine = await hasura.schemas();
        expect(schemasAfterDefine).toContain(testSchema);
        
      } finally {
        // Cleanup
        await hasura.deleteSchema({ schema: testSchema });
      }
    });
  });

  describe('Table Operations', () => {
    test('createTable, defineTable, deleteTable, trackTable, untrackTable', async () => {
      const testSchema = `test_${uuidv4().replace(/-/g, '_')}`;
      const testTable = 'test_table';
      debug(`Testing table operations with ${testSchema}.${testTable}`);
      
      try {
        // Create schema first
        await hasura.defineSchema({ schema: testSchema });
        
        // Test createTable
        await hasura.createTable({ schema: testSchema, table: testTable });
        
        // Verify table exists
        const tables = await hasura.tables({ schema: testSchema });
        expect(tables).toContain(testTable);
        
        // Test createTable fails if exists - modify the mock to return wrong type
        const originalMockColumns = (hasura as any).mockColumns;
        const key = `${testSchema}.${testTable}`;
        const currentColumns = originalMockColumns.get(key);
        // Change the id column type to trigger error
        originalMockColumns.set(key, {
          ...currentColumns,
          id: { type: 'text', _type: 'text' }
        });
        
        await expect(hasura.createTable({ schema: testSchema, table: testTable })).rejects.toThrow();
        
        // Restore original columns
        originalMockColumns.set(key, currentColumns);
        
        // Test untrackTable
        await hasura.untrackTable({ schema: testSchema, table: testTable });
        
        // Test trackTable
        await hasura.trackTable({ schema: testSchema, table: testTable });
        
        // Delete table
        await hasura.deleteTable({ schema: testSchema, table: testTable });
        
        // Test defineTable (idempotent)
        await hasura.defineTable({ schema: testSchema, table: testTable });
        await hasura.defineTable({ schema: testSchema, table: testTable }); // Should not fail
        
        // Verify table exists
        const tablesAfterDefine = await hasura.tables({ schema: testSchema });
        expect(tablesAfterDefine).toContain(testTable);
        
      } finally {
        // Cleanup
        await hasura.deleteSchema({ schema: testSchema });
      }
    });
  });

  describe('Column Operations', () => {
    test('defineColumn, deleteColumn, columns', async () => {
      const testSchema = `test_${uuidv4().replace(/-/g, '_')}`;
      const testTable = 'test_table';
      const testColumn = 'test_column';
      debug(`Testing column operations with ${testSchema}.${testTable}.${testColumn}`);
      
      try {
        // Setup
        await hasura.defineSchema({ schema: testSchema });
        await hasura.defineTable({ schema: testSchema, table: testTable });
        
        // Test defineColumn
        await hasura.defineColumn({
          schema: testSchema,
          table: testTable,
          name: testColumn,
          type: ColumnType.TEXT,
          comment: 'Test column'
        });
        
        // Verify column exists
        const columns = await hasura.columns({ schema: testSchema, table: testTable });
        expect(columns[testColumn]).toBeDefined();
        expect(columns[testColumn].type).toBe('text');
        
        // Test defineColumn is idempotent
        await hasura.defineColumn({
          schema: testSchema,
          table: testTable,
          name: testColumn,
          type: ColumnType.TEXT
        });
        
        // Test deleteColumn
        await hasura.deleteColumn({ schema: testSchema, table: testTable, name: testColumn });
        
        // Verify column is deleted
        const columnsAfterDelete = await hasura.columns({ schema: testSchema, table: testTable });
        expect(columnsAfterDelete[testColumn]).toBeUndefined();
        
        // Test deleteColumn is safe (no error if doesn't exist)
        await hasura.deleteColumn({ schema: testSchema, table: testTable, name: testColumn });
        
      } finally {
        // Cleanup
        await hasura.deleteSchema({ schema: testSchema });
      }
    });
  });

  describe('Function Operations', () => {
    test('createFunction, defineFunction, deleteFunction', async () => {
      const testSchema = `test_${uuidv4().replace(/-/g, '_')}`;
      const testFunction = 'test_function';
      const functionDefinition = `()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = EXTRACT(EPOCH FROM NOW()) * 1000;
          RETURN NEW;
        END;
        $$`;
      debug(`Testing function operations with ${testSchema}.${testFunction}`);
      
      try {
        // Setup
        await hasura.defineSchema({ schema: testSchema });
        
        // Test createFunction
        await hasura.createFunction({
          schema: testSchema,
          name: testFunction,
          definition: functionDefinition
        });
        
        // Test createFunction fails if exists
        await expect(hasura.createFunction({
          schema: testSchema,
          name: testFunction,
          definition: functionDefinition
        })).rejects.toThrow();
        
        // Test deleteFunction
        await hasura.deleteFunction({ schema: testSchema, name: testFunction });
        
        // Test defineFunction (idempotent)
        await hasura.defineFunction({
          schema: testSchema,
          name: testFunction,
          definition: functionDefinition
        });
        
        await hasura.defineFunction({
          schema: testSchema,
          name: testFunction,
          definition: functionDefinition
        }); // Should not fail
        
      } finally {
        // Cleanup
        await hasura.deleteSchema({ schema: testSchema });
      }
    });
  });

  describe('Trigger Operations', () => {
    test('createTrigger, defineTrigger, deleteTrigger', async () => {
      const testSchema = `test_${uuidv4().replace(/-/g, '_')}`;
      const testTable = 'test_table';
      const testFunction = 'test_function';
      const testTrigger = 'test_trigger';
      const functionDefinition = `()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = EXTRACT(EPOCH FROM NOW()) * 1000;
          RETURN NEW;
        END;
        $$`;
      debug(`Testing trigger operations with ${testSchema}.${testTable}.${testTrigger}`);
      
      try {
        // Setup
        await hasura.defineSchema({ schema: testSchema });
        await hasura.defineTable({ schema: testSchema, table: testTable });
        await hasura.defineFunction({
          schema: testSchema,
          name: testFunction,
          definition: functionDefinition
        });
        
        // Test createTrigger
        await hasura.createTrigger({
          schema: testSchema,
          table: testTable,
          name: testTrigger,
          timing: 'BEFORE',
          event: 'UPDATE',
          function_name: `${testSchema}.${testFunction}`
        });
        
        // Test createTrigger fails if exists
        await expect(hasura.createTrigger({
          schema: testSchema,
          table: testTable,
          name: testTrigger,
          timing: 'BEFORE',
          event: 'UPDATE',
          function_name: `${testSchema}.${testFunction}`
        })).rejects.toThrow();
        
        // Test deleteTrigger
        await hasura.deleteTrigger({ schema: testSchema, table: testTable, name: testTrigger });
        
        // Test defineTrigger (idempotent)
        await hasura.defineTrigger({
          schema: testSchema,
          table: testTable,
          name: testTrigger,
          timing: 'BEFORE',
          event: 'UPDATE',
          function_name: `${testSchema}.${testFunction}`
        });
        
        await hasura.defineTrigger({
          schema: testSchema,
          table: testTable,
          name: testTrigger,
          timing: 'BEFORE',
          event: 'UPDATE',
          function_name: `${testSchema}.${testFunction}`
        }); // Should not fail
        
      } finally {
        // Cleanup
        await hasura.deleteSchema({ schema: testSchema });
      }
    });
  });

  describe('Foreign Key Operations', () => {
    test('createForeignKey, defineForeignKey, deleteForeignKey', async () => {
      const testSchema = `test_${uuidv4().replace(/-/g, '_')}`;
      const parentTable = 'parent_table';
      const childTable = 'child_table';
      const fkName = 'test_fk';
      debug(`Testing foreign key operations with ${testSchema}.${parentTable}->${childTable}`);
      
      try {
        // Setup
        await hasura.defineSchema({ schema: testSchema });
        await hasura.defineTable({ schema: testSchema, table: parentTable });
        await hasura.defineTable({ schema: testSchema, table: childTable });
        
        // Add parent_id column to child table
        await hasura.defineColumn({
          schema: testSchema,
          table: childTable,
          name: 'parent_id',
          type: ColumnType.UUID
        });
        
        // Test createForeignKey
        await hasura.createForeignKey({
          from: { schema: testSchema, table: childTable, column: 'parent_id' },
          to: { schema: testSchema, table: parentTable, column: 'id' },
          name: fkName
        });
        
        // Test createForeignKey fails if exists
        await expect(hasura.createForeignKey({
          from: { schema: testSchema, table: childTable, column: 'parent_id' },
          to: { schema: testSchema, table: parentTable, column: 'id' },
          name: fkName
        })).rejects.toThrow();
        
        // Test deleteForeignKey
        await hasura.deleteForeignKey({ schema: testSchema, table: childTable, name: fkName });
        
        // Test defineForeignKey (idempotent)
        await hasura.defineForeignKey({
          from: { schema: testSchema, table: childTable, column: 'parent_id' },
          to: { schema: testSchema, table: parentTable, column: 'id' },
          name: fkName
        });
        
        await hasura.defineForeignKey({
          from: { schema: testSchema, table: childTable, column: 'parent_id' },
          to: { schema: testSchema, table: parentTable, column: 'id' },
          name: fkName
        }); // Should not fail
        
      } finally {
        // Cleanup
        await hasura.deleteSchema({ schema: testSchema });
      }
    });
  });

  describe('View Operations', () => {
    test('createView, defineView, deleteView, trackView, untrackView', async () => {
      const testSchema = `test_${uuidv4().replace(/-/g, '_')}`;
      const testTable = 'test_table';
      const testView = 'test_view';
      const viewDefinition = `SELECT id, created_at FROM "${testSchema}"."${testTable}"`;
      debug(`Testing view operations with ${testSchema}.${testView}`);
      
      try {
        // Setup
        await hasura.defineSchema({ schema: testSchema });
        await hasura.defineTable({ schema: testSchema, table: testTable });
        
        // Test createView
        await hasura.createView({
          schema: testSchema,
          name: testView,
          definition: viewDefinition
        });
        
        // Test createView fails if exists
        await expect(hasura.createView({
          schema: testSchema,
          name: testView,
          definition: viewDefinition
        })).rejects.toThrow();
        
        // Test trackView and untrackView
        await hasura.trackView({ schema: testSchema, name: testView });
        await hasura.untrackView({ schema: testSchema, name: testView });
        
        // Test deleteView
        await hasura.deleteView({ schema: testSchema, name: testView });
        
        // Test defineView (idempotent)
        await hasura.defineView({
          schema: testSchema,
          name: testView,
          definition: viewDefinition
        });
        
        await hasura.defineView({
          schema: testSchema,
          name: testView,
          definition: viewDefinition
        }); // Should not fail
        
      } finally {
        // Cleanup
        await hasura.deleteSchema({ schema: testSchema });
      }
    });
  });

  describe('Relationship Operations', () => {
    test('defineObjectRelationshipForeign, defineArrayRelationshipForeign, deleteRelationship', async () => {
      const testSchema = `test_${uuidv4().replace(/-/g, '_')}`;
      const parentTable = 'parent_table';
      const childTable = 'child_table';
      debug(`Testing relationship operations with ${testSchema}`);
      
      try {
        // Setup
        await hasura.defineSchema({ schema: testSchema });
        await hasura.defineTable({ schema: testSchema, table: parentTable });
        await hasura.defineTable({ schema: testSchema, table: childTable });
        
        // Add parent_id column to child table
        await hasura.defineColumn({
          schema: testSchema,
          table: childTable,
          name: 'parent_id',
          type: ColumnType.UUID
        });
        
        // Create foreign key
        await hasura.defineForeignKey({
          from: { schema: testSchema, table: childTable, column: 'parent_id' },
          to: { schema: testSchema, table: parentTable, column: 'id' }
        });
        
        // Test object relationship
        await hasura.defineObjectRelationshipForeign({
          schema: testSchema,
          table: childTable,
          name: 'parent',
          key: 'parent_id'
        });
        
        // Test array relationship
        await hasura.defineArrayRelationshipForeign({
          schema: testSchema,
          table: parentTable,
          name: 'children',
          key: `${childTable}.parent_id`
        });
        
        // Test deleteRelationship
        await hasura.deleteRelationship({
          schema: testSchema,
          table: childTable,
          name: 'parent'
        });
        
        await hasura.deleteRelationship({
          schema: testSchema,
          table: parentTable,
          name: 'children'
        });
        
      } finally {
        // Cleanup
        await hasura.deleteSchema({ schema: testSchema });
      }
    });
  });

  describe('Permission Operations', () => {
    test('definePermission, deletePermission', async () => {
      const testSchema = `test_${uuidv4().replace(/-/g, '_')}`;
      const testTable = 'test_table';
      const testRole = 'user';
      debug(`Testing permission operations with ${testSchema}.${testTable}`);
      
      try {
        // Setup
        await hasura.defineSchema({ schema: testSchema });
        await hasura.defineTable({ schema: testSchema, table: testTable });
        
        // Test definePermission for select
        await hasura.definePermission({
          schema: testSchema,
          table: testTable,
          operation: 'select',
          role: testRole,
          filter: { id: { _eq: 'X-Hasura-User-Id' } },
          aggregate: true
        });
        
        // Test definePermission for insert
        await hasura.definePermission({
          schema: testSchema,
          table: testTable,
          operation: 'insert',
          role: testRole,
          filter: {},
          columns: ['id', 'created_at', 'updated_at']
        });
        
        // Test definePermission for multiple roles
        await hasura.definePermission({
          schema: testSchema,
          table: testTable,
          operation: 'update',
          role: [testRole, 'admin'],
          filter: { id: { _eq: 'X-Hasura-User-Id' } }
        });
        
        // Test deletePermission
        await hasura.deletePermission({
          schema: testSchema,
          table: testTable,
          operation: 'select',
          role: testRole
        });
        
        // Test deletePermission for multiple roles
        await hasura.deletePermission({
          schema: testSchema,
          table: testTable,
          operation: 'update',
          role: [testRole, 'admin']
        });
        
      } finally {
        // Cleanup
        await hasura.deleteSchema({ schema: testSchema });
      }
    });
  });

  describe('Event Trigger Operations', () => {
    test('createEventTrigger, defineEventTrigger, deleteEventTrigger', async () => {
      const testSchema = `test_${uuidv4().replace(/-/g, '_')}`;
      const testTable = 'test_table';
      const testEventTrigger = 'test_event_trigger';
      const webhook = 'https://example.com/webhook';
      debug(`Testing event trigger operations with ${testEventTrigger}`);
      
      try {
        // Setup
        await hasura.defineSchema({ schema: testSchema });
        await hasura.defineTable({ schema: testSchema, table: testTable });
        
        // Test createEventTrigger
        await hasura.createEventTrigger({
          name: testEventTrigger,
          table: { schema: testSchema, name: testTable },
          webhook,
          insert: true,
          update: true,
          headers: [{ name: 'Authorization', value: 'Bearer token' }]
        });
        
        // Test deleteEventTrigger
        await hasura.deleteEventTrigger({ name: testEventTrigger });
        
        // Test defineEventTrigger (idempotent)
        await hasura.defineEventTrigger({
          name: testEventTrigger,
          table: { schema: testSchema, name: testTable },
          webhook,
          insert: true,
          update: true
        });
        
        await hasura.defineEventTrigger({
          name: testEventTrigger,
          table: { schema: testSchema, name: testTable },
          webhook,
          insert: true,
          update: true
        }); // Should not fail
        
      } finally {
        // Cleanup
        await hasura.deleteEventTrigger({ name: testEventTrigger });
        await hasura.deleteSchema({ schema: testSchema });
      }
    });
  });

  describe('Metadata Operations', () => {
    test('exportMetadata, reloadMetadata, getInconsistentMetadata', async () => {
      debug('Testing metadata operations');
      
      // Test exportMetadata
      const metadata = await hasura.exportMetadata();
      expect(metadata).toBeDefined();
      expect(metadata.version).toBeDefined();
      
      // Test reloadMetadata
      const reloadResult = await hasura.reloadMetadata();
      expect(reloadResult).toBeDefined();
      
      // Test getInconsistentMetadata
      const inconsistent = await hasura.getInconsistentMetadata();
      expect(inconsistent).toBeDefined();
      expect(Array.isArray(inconsistent.inconsistent_objects)).toBe(true);
    });
  });

  describe('Utility Operations', () => {
    test('schemas, tables, columns getters', async () => {
      const testSchema = `test_${uuidv4().replace(/-/g, '_')}`;
      const testTable = 'test_table';
      debug(`Testing utility operations with ${testSchema}.${testTable}`);
      
      try {
        // Setup
        await hasura.defineSchema({ schema: testSchema });
        await hasura.defineTable({ schema: testSchema, table: testTable });
        
        // Test schemas getter
        const schemas = await hasura.schemas();
        expect(Array.isArray(schemas)).toBe(true);
        expect(schemas).toContain(testSchema);
        
        // Test tables getter
        const tables = await hasura.tables({ schema: testSchema });
        expect(Array.isArray(tables)).toBe(true);
        expect(tables).toContain(testTable);
        
        // Test columns getter
        const columns = await hasura.columns({ schema: testSchema, table: testTable });
        expect(typeof columns).toBe('object');
        expect(columns.id).toBeDefined();
        expect(columns.created_at).toBeDefined();
        expect(columns.updated_at).toBeDefined();
        
      } finally {
        // Cleanup
        await hasura.deleteSchema({ schema: testSchema });
      }
    });
  });

  describe('Method Signature Tests', () => {
    test('all methods exist and are callable', () => {
      debug('Testing method signatures');
      
      // Schema operations
      expect(typeof hasura.createSchema).toBe('function');
      expect(typeof hasura.defineSchema).toBe('function');
      expect(typeof hasura.deleteSchema).toBe('function');
      
      // Table operations
      expect(typeof hasura.createTable).toBe('function');
      expect(typeof hasura.defineTable).toBe('function');
      expect(typeof hasura.deleteTable).toBe('function');
      expect(typeof hasura.trackTable).toBe('function');
      expect(typeof hasura.untrackTable).toBe('function');
      
      // Column operations
      expect(typeof hasura.defineColumn).toBe('function');
      expect(typeof hasura.deleteColumn).toBe('function');
      
      // Function operations
      expect(typeof hasura.createFunction).toBe('function');
      expect(typeof hasura.defineFunction).toBe('function');
      expect(typeof hasura.deleteFunction).toBe('function');
      
      // Trigger operations
      expect(typeof hasura.createTrigger).toBe('function');
      expect(typeof hasura.defineTrigger).toBe('function');
      expect(typeof hasura.deleteTrigger).toBe('function');
      
      // Foreign key operations
      expect(typeof hasura.createForeignKey).toBe('function');
      expect(typeof hasura.defineForeignKey).toBe('function');
      expect(typeof hasura.deleteForeignKey).toBe('function');
      
      // View operations
      expect(typeof hasura.createView).toBe('function');
      expect(typeof hasura.defineView).toBe('function');
      expect(typeof hasura.deleteView).toBe('function');
      expect(typeof hasura.trackView).toBe('function');
      expect(typeof hasura.untrackView).toBe('function');
      
      // Relationship operations
      expect(typeof hasura.defineObjectRelationshipForeign).toBe('function');
      expect(typeof hasura.defineArrayRelationshipForeign).toBe('function');
      expect(typeof hasura.deleteRelationship).toBe('function');
      
      // Permission operations
      expect(typeof hasura.definePermission).toBe('function');
      expect(typeof hasura.deletePermission).toBe('function');
      
      // Event trigger operations
      expect(typeof hasura.createEventTrigger).toBe('function');
      expect(typeof hasura.defineEventTrigger).toBe('function');
      expect(typeof hasura.deleteEventTrigger).toBe('function');
      
      // Computed field operations
      expect(typeof hasura.defineComputedField).toBe('function');
      expect(typeof hasura.createComputedField).toBe('function');
      expect(typeof hasura.deleteComputedField).toBe('function');
      
      // Remote schema operations
      expect(typeof hasura.defineRemoteSchema).toBe('function');
      expect(typeof hasura.createRemoteSchema).toBe('function');
      expect(typeof hasura.deleteRemoteSchema).toBe('function');
      
      // Remote relationship operations
      expect(typeof hasura.defineRemoteRelationship).toBe('function');
      expect(typeof hasura.createRemoteRelationship).toBe('function');
      expect(typeof hasura.deleteRemoteRelationship).toBe('function');
      
      // Cron trigger operations
      expect(typeof hasura.defineCronTrigger).toBe('function');
      expect(typeof hasura.createCronTrigger).toBe('function');
      expect(typeof hasura.deleteCronTrigger).toBe('function');
      
      // Metadata operations
      expect(typeof hasura.exportMetadata).toBe('function');
      expect(typeof hasura.replaceMetadata).toBe('function');
      expect(typeof hasura.clearMetadata).toBe('function');
      expect(typeof hasura.reloadMetadata).toBe('function');
      expect(typeof hasura.getInconsistentMetadata).toBe('function');
      expect(typeof hasura.dropInconsistentMetadata).toBe('function');
      
      // Utility operations
      expect(typeof hasura.schemas).toBe('function');
      expect(typeof hasura.tables).toBe('function');
      expect(typeof hasura.columns).toBe('function');
      
      // Core operations
      expect(typeof hasura.sql).toBe('function');
      expect(typeof hasura.v1).toBe('function');
      expect(hasura.client).toBeDefined();
    });
  });
}); 