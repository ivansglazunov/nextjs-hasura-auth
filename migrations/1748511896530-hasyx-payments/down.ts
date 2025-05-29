import dotenv from 'dotenv';
import path from 'path';
import { down } from 'hasyx/lib/down-payments'; // Adjusted import path

// Load environment variables from root .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Run the migration
if (require.main === module) {
  down().catch(e => {
    console.error('Migration DOWN script failed for 20240801120000-hasyx-payments:', e);
    process.exit(1);
  });
} 