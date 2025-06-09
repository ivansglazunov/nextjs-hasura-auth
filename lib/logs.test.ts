import { describe, it, expect, afterAll, beforeEach } from '@jest/globals';
import { Hasura, ColumnType } from './hasura';
import { applyLogsDiffs, DiffConfig, LogsDiffsConfig } from './logs-diffs';
import { applyLogsStates, type LogsStatesConfig } from './logs-states';
import { processLogs } from './logs';
import Debug from './debug';

const debug = Debug('logs:test');

// Extended timeout for database operations
jest.setTimeout(120000); // 2 minutes

type StateConfig = {
  schema?: string;
  table: string;
  columns: string[];
};

// Helper function to create a test-specific Hasura instance
const createTestHasura = () => new Hasura({
  url: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!,
  secret: process.env.HASURA_ADMIN_SECRET!,
});

// Test schema name
const TEST_SCHEMA = 'test_logs';

describe('[DEBUG] Logs System Tests', () => {
  beforeEach(async () => {
    debug('Setting up test environment...');
    
    // Ensure test schema exists
    const hasura = createTestHasura();
    await hasura.defineSchema({ schema: TEST_SCHEMA });
    
    // Create test table
    await hasura.defineTable({
      schema: TEST_SCHEMA,
      table: 'test_users',
      id: 'id',
      type: ColumnType.UUID
    });
    
    await hasura.defineColumn({
      schema: TEST_SCHEMA,
      table: 'test_users',
      name: 'name',
      type: ColumnType.TEXT,
      comment: 'User name for testing'
    });
    
    await hasura.defineColumn({
      schema: TEST_SCHEMA,
      table: 'test_users',
      name: 'email',
      type: ColumnType.TEXT,
      comment: 'User email for testing'
    });
    
    await hasura.defineColumn({
      schema: TEST_SCHEMA,
      table: 'test_users',
      name: 'status',
      type: ColumnType.TEXT,
      comment: 'User status for testing'
    });
    
    debug('Test environment setup complete');
  });

  describe('Diffs System', () => {
    it('should create and apply diffs triggers for specified columns', async () => {
      debug('Testing diffs system...');
      
      const testConfig: LogsDiffsConfig = {
        diffs: [
          {
            schema: TEST_SCHEMA,
            table: 'test_users',
            column: 'name'
          },
          {
            schema: TEST_SCHEMA,
            table: 'test_users', 
            column: 'email'
          }
        ]
      };
      
      // Apply diffs configuration
      const hasura = createTestHasura();
      await applyLogsDiffs(hasura, testConfig);
      
      // Verify triggers were created by checking pg_trigger
      const nameTriggersResult = await hasura.sql(`
        SELECT tgname FROM pg_trigger 
        WHERE tgname LIKE 'hasyx_diffs_${TEST_SCHEMA}_test_users_name%'
      `);
      
      const emailTriggersResult = await hasura.sql(`
        SELECT tgname FROM pg_trigger 
        WHERE tgname LIKE 'hasyx_diffs_${TEST_SCHEMA}_test_users_email%'
      `);
      
      expect(nameTriggersResult.result).toBeDefined();
      expect(emailTriggersResult.result).toBeDefined();
      
      debug('✅ Diffs triggers created successfully');
    });
    
    it('should record diffs when data changes', async () => {
      debug('Testing diffs recording...');
      
      const testConfig: LogsDiffsConfig = {
        diffs: [
          {
            schema: TEST_SCHEMA,
            table: 'test_users',
            column: 'name'
          }
        ]
      };
      
      // Apply diffs configuration
      const hasura = createTestHasura();
      await applyLogsDiffs(hasura, testConfig);
      
      // Insert test data
      const insertResult = await hasura.sql(`
        INSERT INTO ${TEST_SCHEMA}.test_users (name, email, status) 
        VALUES ('Test User', 'test@example.com', 'active') 
        RETURNING id
      `);
      
      const userId = insertResult.result[1][0];
      
      // Update the name to trigger diff recording
      await hasura.sql(`
        UPDATE ${TEST_SCHEMA}.test_users 
        SET name = 'Updated User' 
        WHERE id = '${userId}'
      `);
      
      // Check if diffs were recorded
      const diffsResult = await hasura.sql(`
        SELECT _schema, _table, _column, _id, _value 
        FROM logs.diffs 
        WHERE _schema = '${TEST_SCHEMA}' 
        AND _table = 'test_users' 
        AND _column = 'name'
        AND _id = '${userId}'
      `);
      
      expect(diffsResult.result).toBeDefined();
      expect(diffsResult.result.length).toBeGreaterThan(1); // Header + data rows
      
      debug('✅ Diffs recorded successfully');
    });
  });
  
  describe('States System', () => {
    it('should create and apply states triggers for specified columns', async () => {
      debug('Testing states system...');
      
      const testConfig: LogsStatesConfig = {
        states: [
          {
            schema: TEST_SCHEMA,
            table: 'test_users',
            columns: ['name', 'email', 'status']
          }
        ]
      };
      
      // Apply states configuration
      const hasura = createTestHasura();
      await applyLogsStates(hasura, testConfig);
      
      // Verify triggers were created
      const insertUpdateTriggersResult = await hasura.sql(`
        SELECT tgname FROM pg_trigger 
        WHERE tgname LIKE 'hasyx_states_${TEST_SCHEMA}_test_users_iu%'
      `);
      
      const deleteTriggersResult = await hasura.sql(`
        SELECT tgname FROM pg_trigger 
        WHERE tgname LIKE 'hasyx_states_${TEST_SCHEMA}_test_users_d%'
      `);
      
      expect(insertUpdateTriggersResult.result).toBeDefined();
      expect(deleteTriggersResult.result).toBeDefined();
      
      debug('✅ States triggers created successfully');
    });
    
    it('should record states when data changes', async () => {
      debug('Testing states recording...');
      
      const testConfig: LogsStatesConfig = {
        states: [
          {
            schema: TEST_SCHEMA,
            table: 'test_users',
            columns: ['name', 'status']
          }
        ]
      };
      
      // Apply states configuration
      const hasura = createTestHasura();
      await applyLogsStates(hasura, testConfig);
      
      // Insert test data
      const insertResult = await hasura.sql(`
        INSERT INTO ${TEST_SCHEMA}.test_users (name, email, status) 
        VALUES ('Test User', 'test@example.com', 'active') 
        RETURNING id
      `);
      
      const userId = insertResult.result[1][0];
      
      // Check if states were recorded for insert
      const insertStatesResult = await hasura.sql(`
        SELECT _schema, _table, _column, _id, state 
        FROM logs.states 
        WHERE _schema = '${TEST_SCHEMA}' 
        AND _table = 'test_users' 
        AND _id = '${userId}'
        ORDER BY _column, created_at
      `);
      
      expect(insertStatesResult.result).toBeDefined();
      expect(insertStatesResult.result.length).toBeGreaterThan(1); // Header + data rows
      
      // Update the record
      await hasura.sql(`
        UPDATE ${TEST_SCHEMA}.test_users 
        SET name = 'Updated User', status = 'inactive' 
        WHERE id = '${userId}'
      `);
      
      // Check if states were recorded for update
      const updateStatesResult = await hasura.sql(`
        SELECT _schema, _table, _column, _id, state 
        FROM logs.states 
        WHERE _schema = '${TEST_SCHEMA}' 
        AND _table = 'test_users' 
        AND _id = '${userId}'
        ORDER BY _column, created_at
      `);
      
      expect(updateStatesResult.result.length).toBeGreaterThan(insertStatesResult.result.length);
      
      // Delete the record
      await hasura.sql(`
        DELETE FROM ${TEST_SCHEMA}.test_users WHERE id = '${userId}'
      `);
      
      // Check if null states were recorded for delete
      const deleteStatesResult = await hasura.sql(`
        SELECT _schema, _table, _column, _id, state 
        FROM logs.states 
        WHERE _schema = '${TEST_SCHEMA}' 
        AND _table = 'test_users' 
        AND _id = '${userId}'
        AND state IS NULL
      `);
      
      expect(deleteStatesResult.result).toBeDefined();
      expect(deleteStatesResult.result.length).toBeGreaterThan(1); // Header + data rows
      
      debug('✅ States recorded successfully');
    });
  });

  describe('Combined System', () => {
    it('should handle both diffs and states configuration together', async () => {
      debug('Testing combined diffs and states system...');
      
      // Create test configuration objects
      const diffsConfig: LogsDiffsConfig = {
        diffs: [
          {
            schema: TEST_SCHEMA,
            table: 'test_users',
            column: 'name'
          }
        ]
      };
      
      const statesConfig: LogsStatesConfig = {
        states: [
          {
            schema: TEST_SCHEMA,
            table: 'test_users',
            columns: ['email', 'status']
          }
        ]
      };
      
      // Apply both configurations
      const hasura = createTestHasura();
      await applyLogsDiffs(hasura, diffsConfig);
      await applyLogsStates(hasura, statesConfig);
      
      // Insert and modify test data
      const insertResult = await hasura.sql(`
        INSERT INTO ${TEST_SCHEMA}.test_users (name, email, status) 
        VALUES ('Test User', 'test@example.com', 'active') 
        RETURNING id
      `);
      
      const userId = insertResult.result[1][0];
      
      await hasura.sql(`
        UPDATE ${TEST_SCHEMA}.test_users 
        SET name = 'Updated User', email = 'updated@example.com', status = 'inactive'
        WHERE id = '${userId}'
      `);
      
      // Verify both diffs and states were recorded
      const diffsResult = await hasura.sql(`
        SELECT COUNT(*) as count FROM logs.diffs 
        WHERE _schema = '${TEST_SCHEMA}' AND _table = 'test_users' AND _id = '${userId}'
      `);
      
      const statesResult = await hasura.sql(`
        SELECT COUNT(*) as count FROM logs.states 
        WHERE _schema = '${TEST_SCHEMA}' AND _table = 'test_users' AND _id = '${userId}'
      `);
      
      const diffsCount = parseInt(diffsResult.result[1][0]);
      const statesCount = parseInt(statesResult.result[1][0]);
      
      expect(diffsCount).toBeGreaterThan(0);
      expect(statesCount).toBeGreaterThan(0);
      
      debug('✅ Combined system working correctly');
    });
  });

  afterAll(async () => {
    debug('Cleaning up test environment...');
    
    // Re-apply configuration from hasyx.config.json to restore production state
    try {
      await processLogs(createTestHasura());
      debug('Production logs configuration restored');
    } catch (error) {
      debug(`Warning: Could not restore production configuration: ${error}`);
    }
    
    // Clean up test schema
    try {
      await createTestHasura().deleteSchema({ schema: TEST_SCHEMA, cascade: true });
      debug('Test schema cleaned up');
    } catch (error) {
      debug(`Warning: Could not clean up test schema: ${error}`);
    }
    
    debug('Test cleanup complete');
  });
}); 