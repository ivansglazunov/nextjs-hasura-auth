import fs from 'fs-extra';
import path from 'path';
import Debug from './debug';
import { findProjectRoot } from './cli-hasyx';

const debug = Debug('local');

export const localCommand = () => {
  debug('Executing "local" command.');
  console.log('🏠 Switching environment URL variables to local development...');
  
  const projectRoot = findProjectRoot();
  const envPath = path.join(projectRoot, '.env');
  
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found in project root.');
    console.error('   Please create a .env file first.');
    debug(`Env file not found at: ${envPath}`);
    process.exit(1);
  }
  
  try {
    let envContent = fs.readFileSync(envPath, 'utf-8');
    let modified = false;
    
    // URL variables to switch to local
    const urlMappings = {
      'NEXT_PUBLIC_MAIN_URL': 'http://localhost:3000',
      'NEXT_PUBLIC_BASE_URL': 'http://localhost:3000',
      'NEXTAUTH_URL': 'http://localhost:3000'
    };
    
    for (const [varName, localValue] of Object.entries(urlMappings)) {
      const regex = new RegExp(`^${varName}=.*$`, 'm');
      const newLine = `${varName}=${localValue}`;
      
      if (regex.test(envContent)) {
        const oldContent = envContent;
        envContent = envContent.replace(regex, newLine);
        if (oldContent !== envContent) {
          console.log(`✅ Updated ${varName} to ${localValue}`);
          debug(`Updated ${varName} to ${localValue}`);
          modified = true;
        }
      } else {
        // Add the variable if it doesn't exist
        envContent += `\n${newLine}`;
        console.log(`✅ Added ${varName}=${localValue}`);
        debug(`Added ${varName}=${localValue}`);
        modified = true;
      }
    }
    
    if (modified) {
      fs.writeFileSync(envPath, envContent);
      console.log('✅ Environment variables updated for local development');
      debug('Environment file updated successfully');
    } else {
      console.log('ℹ️ Environment variables already set for local development');
      debug('No changes needed to environment file');
    }
    
  } catch (error) {
    console.error('❌ Failed to update .env file:', error);
    debug(`Error updating env file: ${error}`);
    process.exit(1);
  }
  
  console.log('✨ Local environment setup complete!');
  console.log('   You can now run: npm run dev');
  debug('Finished "local" command.');
}; 