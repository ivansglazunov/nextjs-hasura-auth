import readline from 'readline';
import Debug from './debug';
import { createRlInterface, askYesNo } from './assist-common';
import spawn from 'cross-spawn';
import fs from 'fs-extra';
import path from 'path';

const debug = Debug('assist:commit');

export async function commitChanges(rl: readline.Interface, options: { commitMessage?: string, skipCommit?: boolean }): Promise<void> {
  if (options.skipCommit) {
    debug('Skipping commit due to options.');
    console.log('⏭️ Skipping commit.');
    return;
  }
  debug('Committing changes'); console.log('💾 Committing changes...');

  const gitStatus = spawn.sync('git', ['status', '--porcelain'], { encoding: 'utf-8' });
  if (!gitStatus.stdout.trim()) {
    console.log('✅ No changes to commit.');
    return;
  }

  if (await askYesNo(rl, 'Do you want to commit the changes?', false)) {
    spawn.sync('git', ['add', '.'], { stdio: 'inherit' });
    const message = options.commitMessage || 'feat: initial project setup by hasyx-assist';
    const commitResult = spawn.sync('git', ['commit', '-m', message], { stdio: 'inherit' });
    if (commitResult.status !== 0) {
      console.error('❌ Failed to commit changes.');
      if (!await askYesNo(rl, 'Continue without committing?', false)) {
        process.exit(1);
      }
    } else {
      console.log('✅ Changes committed.');
      if (await askYesNo(rl, 'Do you want to push the changes?', false)) {
        const pushResult = spawn.sync('git', ['push'], { stdio: 'inherit' });
        if (pushResult.status !== 0) console.error('❌ Failed to push changes.');
        else console.log('✅ Changes pushed.');
      }
    }
  }
}

// Main function for standalone execution
async function main() {
  const rl = createRlInterface();
  if (!fs.existsSync(path.join(process.cwd(), '.git'))) {
    console.error('❌ Not a git repository. Initialize git first.');
    rl.close();
    process.exit(1);
  }
  try {
    await commitChanges(rl, { commitMessage: 'feat: test commit from assist-commit' });
    console.log('✅ Commit process complete.');
  } catch (error) {
    console.error('❌ Error during commit process:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  main();
} 