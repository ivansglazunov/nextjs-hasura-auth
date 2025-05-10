import dotenv from 'dotenv';
import path from 'path';
import { up } from '../../lib/up-hasyx'; // Adjusted path

// Determine project root to load .env from there
// This assumes migrations are run from the project root or `process.cwd()` is the project root.
const projectRoot = process.cwd(); 
dotenv.config({ path: path.join(projectRoot, '.env') });

async function run() {
  if (await up()) {
    console.log('✅ Hasyx View migration UP completed successfully.');
    process.exit(0);
  } else {
    console.error('❌ Hasyx View migration UP failed.');
    process.exit(1);
  }
}

run(); 