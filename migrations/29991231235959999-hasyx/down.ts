import dotenv from 'dotenv';
import path from 'path';
import { down } from '../../lib/down-hasyx'; // Adjusted path

// Determine project root to load .env from there
const projectRoot = process.cwd();
dotenv.config({ path: path.join(projectRoot, '.env') });

async function run() {
  if (await down()) {
    console.log('✅ Hasyx View migration DOWN completed successfully.');
    process.exit(0);
  } else {
    console.error('❌ Hasyx View migration DOWN failed.');
    process.exit(1);
  }
}

run(); 