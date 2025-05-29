import dotenv from 'dotenv';
import path from 'path';
import { up } from 'hasyx/lib/up-payments';

// Load environment variables from root .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Run the migration
if (require.main === module) {
  up().catch(e => {
    // Ensure the error is logged with more context if possible
    console.error('Migration UP script failed for 20240801120000-hasyx-payments:', e);
    process.exit(1);
  });
}