import { Hasura } from './hasura';

/**
 * Migration Helper Utility
 * 
 * This utility helps ensure that Hasura migrations run smoothly by:
 * 1. Ensuring the default data source exists before running migrations
 * 2. Providing a safe wrapper for migration operations
 */

interface MigrationOptions {
  hasuraUrl: string;
  hasuraSecret: string;
  databaseUrl?: string;
  verbose?: boolean;
}

export class MigrationHelper {
  private hasura: Hasura;
  private verbose: boolean;

  constructor(options: MigrationOptions) {
    const { hasuraUrl, hasuraSecret, verbose = false } = options;
    
    this.hasura = new Hasura({
      url: hasuraUrl,
      secret: hasuraSecret
    });
    
    this.verbose = verbose;
  }

  private log(message: string) {
    if (this.verbose) {
      console.log(`[MigrationHelper] ${message}`);
    }
  }

  /**
   * Ensures that the Hasura environment is ready for migrations
   */
  async prepareMigrationEnvironment(databaseUrl?: string): Promise<void> {
    this.log('🔧 Preparing migration environment...');
    
    try {
      // 1. Check Hasura connectivity
      this.log('1. Checking Hasura connectivity...');
      await this.hasura.exportMetadata();
      this.log('✅ Hasura is accessible');
      
      // 2. Ensure default data source exists
      this.log('2. Ensuring default data source exists...');
      await this.hasura.ensureDefaultSource(databaseUrl);
      this.log('✅ Default data source is ready');
      
      // 3. Verify data source is working
      this.log('3. Verifying data source connectivity...');
      await this.hasura.sql('SELECT 1 as health_check');
      this.log('✅ Data source is working');
      
      this.log('🎉 Migration environment is ready!');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`❌ Failed to prepare migration environment: ${errorMessage}`);
      throw new Error(`Migration environment preparation failed: ${errorMessage}`);
    }
  }

  /**
   * Gets information about available data sources
   */
  async getDataSourceInfo(): Promise<{ sources: any[]; hasDefault: boolean }> {
    try {
      const sources = await this.hasura.listSources();
      const hasDefault = await this.hasura.checkSourceExists('default');
      
      return {
        sources,
        hasDefault
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get data source info: ${errorMessage}`);
    }
  }

  /**
   * Safely executes a migration function with proper error handling
   */
  async runMigration(
    migrationName: string, 
    migrationFn: (hasura: Hasura) => Promise<void>
  ): Promise<void> {
    this.log(`🚀 Running migration: ${migrationName}`);
    
    try {
      // Ensure environment is ready
      await this.prepareMigrationEnvironment();
      
      // Run the migration
      await migrationFn(this.hasura);
      
      this.log(`✅ Migration completed: ${migrationName}`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`❌ Migration failed: ${migrationName} - ${errorMessage}`);
      throw new Error(`Migration "${migrationName}" failed: ${errorMessage}`);
    }
  }

  /**
   * Creates a backup of current metadata before running migrations
   */
  async createMetadataBackup(): Promise<any> {
    this.log('📦 Creating metadata backup...');
    
    try {
      const metadata = await this.hasura.exportMetadata();
      this.log('✅ Metadata backup created');
      return metadata;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`❌ Failed to create metadata backup: ${errorMessage}`);
      throw new Error(`Metadata backup failed: ${errorMessage}`);
    }
  }

  /**
   * Restores metadata from a backup
   */
  async restoreMetadataBackup(backup: any): Promise<void> {
    this.log('🔄 Restoring metadata from backup...');
    
    try {
      await this.hasura.replaceMetadata(backup);
      this.log('✅ Metadata restored from backup');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`❌ Failed to restore metadata backup: ${errorMessage}`);
      throw new Error(`Metadata restore failed: ${errorMessage}`);
    }
  }
}

/**
 * Factory function to create a MigrationHelper from environment variables
 */
export function createMigrationHelper(options: Partial<MigrationOptions> = {}): MigrationHelper {
  const hasuraUrl = options.hasuraUrl || 
                   process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL || 
                   process.env.HASURA_GRAPHQL_ENDPOINT;
  
  const hasuraSecret = options.hasuraSecret || 
                      process.env.HASURA_ADMIN_SECRET;
  
  const databaseUrl = options.databaseUrl || 
                     process.env.DATABASE_URL || 
                     process.env.POSTGRES_URL;

  if (!hasuraUrl || !hasuraSecret) {
    throw new Error(
      'Missing required environment variables: NEXT_PUBLIC_HASURA_GRAPHQL_URL and HASURA_ADMIN_SECRET'
    );
  }

  return new MigrationHelper({
    hasuraUrl,
    hasuraSecret,
    databaseUrl,
    verbose: options.verbose !== false
  });
}

/**
 * Example migration function that demonstrates best practices
 */
export async function exampleMigration(hasura: Hasura): Promise<void> {
  // Create a test schema
  await hasura.defineSchema({ schema: 'migration_test' });
  
  // Create a test table
  await hasura.defineTable({ 
    schema: 'migration_test', 
    table: 'test_table' 
  });
  
  // Add some columns
  await hasura.defineColumn({
    schema: 'migration_test',
    table: 'test_table',
    name: 'name',
    type: 'text' as any,
    comment: 'Test name field'
  });
  
  // Clean up
  await hasura.deleteSchema({ 
    schema: 'migration_test', 
    cascade: true 
  });
} 