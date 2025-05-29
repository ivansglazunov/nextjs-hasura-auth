import fs from 'fs-extra';
import path from 'path';
import Debug from './debug';
import dotenv from 'dotenv';

const debug = Debug('vercel');

export const vercelCommand = () => {
  dotenv.config({ path: path.join(process.cwd(), '.env') });
  debug('Executing "vercel" command.');
  console.log('☁️ Switching environment URL variables to Vercel deployment...');
  
  const projectRoot = process.cwd();
  const envPath = path.join(projectRoot, '.env');
  
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found in project root.');
    console.error('   Please create a .env file first.');
    debug(`Env file not found at: ${envPath}`);
    process.exit(1);
  }
  
  // Try to determine Vercel URL from package.json or ask user
  let vercelUrl = '';
  
  try {
    const pkgJsonPath = path.join(projectRoot, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
      const pkgJson = fs.readJsonSync(pkgJsonPath);
      if (pkgJson.homepage && pkgJson.homepage.includes('vercel.app')) {
        vercelUrl = pkgJson.homepage;
        console.log(`📦 Found Vercel URL in package.json: ${vercelUrl}`);
        debug(`Found Vercel URL in package.json: ${vercelUrl}`);
      }
    }
  } catch (error) {
    debug(`Error reading package.json: ${error}`);
  }
  
  // If no URL found, try to construct from project name
  if (!vercelUrl) {
    try {
      const pkgJsonPath = path.join(projectRoot, 'package.json');
      if (fs.existsSync(pkgJsonPath)) {
        const pkgJson = fs.readJsonSync(pkgJsonPath);
        if (pkgJson.name) {
          vercelUrl = `https://${pkgJson.name}.vercel.app`;
          console.log(`🔗 Constructed Vercel URL from project name: ${vercelUrl}`);
          debug(`Constructed Vercel URL: ${vercelUrl}`);
        }
      }
    } catch (error) {
      debug(`Error constructing Vercel URL: ${error}`);
    }
  }
  
  if (!vercelUrl) {
    console.error('❌ Could not determine Vercel URL.');
    console.error('   Please set the "homepage" field in package.json to your Vercel URL');
    console.error('   Example: "homepage": "https://your-project.vercel.app"');
    debug('Could not determine Vercel URL');
    process.exit(1);
  }
  
  try {
    let envContent = fs.readFileSync(envPath, 'utf-8');
    let modified = false;
    
    // URL variables to switch to Vercel
    const urlMappings = {
      'NEXT_PUBLIC_MAIN_URL': vercelUrl,
      'NEXT_PUBLIC_BASE_URL': vercelUrl,
      'NEXTAUTH_URL': vercelUrl
    };
    
    for (const [varName, vercelValue] of Object.entries(urlMappings)) {
      const regex = new RegExp(`^${varName}=.*$`, 'm');
      const newLine = `${varName}=${vercelValue}`;
      
      if (regex.test(envContent)) {
        const oldContent = envContent;
        envContent = envContent.replace(regex, newLine);
        if (oldContent !== envContent) {
          console.log(`✅ Updated ${varName} to ${vercelValue}`);
          debug(`Updated ${varName} to ${vercelValue}`);
          modified = true;
        }
      } else {
        // Add the variable if it doesn't exist
        envContent += `\n${newLine}`;
        console.log(`✅ Added ${varName}=${vercelValue}`);
        debug(`Added ${varName}=${vercelValue}`);
        modified = true;
      }
    }
    
    if (modified) {
      fs.writeFileSync(envPath, envContent);
      console.log('✅ Environment variables updated for Vercel deployment');
      debug('Environment file updated successfully');
    } else {
      console.log('ℹ️ Environment variables already set for Vercel deployment');
      debug('No changes needed to environment file');
    }
    
  } catch (error) {
    console.error('❌ Failed to update .env file:', error);
    debug(`Error updating env file: ${error}`);
    process.exit(1);
  }
  
  console.log('✨ Vercel environment setup complete!');
  console.log('   Remember to sync these changes to your Vercel project environment variables');
  console.log('   You can use: vercel env pull .env.local');
  debug('Finished "vercel" command.');
}; 