import readline from 'readline';
import fs from 'fs-extra';
import path from 'path';
import spawn from 'cross-spawn';
import Debug from './debug';
import { createRlInterface, askYesNo } from './assist-common';

const debug = Debug('assist:hasyx');

export async function initializeHasyx(rl: readline.Interface): Promise<void> {
  debug('Initializing Hasyx'); console.log('🚀 Initializing Hasyx project...');
  const hasyxLockPath = path.join(process.cwd(), '.hasyx.lock');
  if (fs.existsSync(hasyxLockPath)) {
    console.log('✅ Hasyx project already initialized (found .hasyx.lock).');
    return;
  }
  if (!fs.existsSync(path.join(process.cwd(), 'hasura'))) {
    console.log('Hasyx files not found.');
    if (await askYesNo(rl, 'Do you want to initialize Hasyx in the current directory?', false)) {
      console.log('Running npx hasyx init...');
      const initResult = spawn.sync('npx', ['hasyx', 'init'], { stdio: 'inherit' });
      if (initResult.status !== 0) { console.error('❌ Hasyx initialization failed.'); process.exit(1); }
      console.log('✅ Hasyx initialized successfully.');
    } else {
      console.log('Skipping Hasyx initialization.');
    }
  } else {
    console.log('✅ Hasyx directory found. Assuming already initialized or will be handled by user.');
  }
}

// Main function for standalone execution
async function main() {
  const rl = createRlInterface();
  try {
    await initializeHasyx(rl);
    console.log('✅ Hasyx initialization check complete.');
  } catch (error) {
    console.error('❌ Error during Hasyx initialization:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  main();
} 