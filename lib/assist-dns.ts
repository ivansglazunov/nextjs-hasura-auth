import readline from 'readline';
import Debug from './debug';
import { createRlInterface, askYesNo, askForInput, parseEnvFile, writeEnvFile } from './assist-common';
import { configureCloudflare } from './assist-cloudflare';
import path from 'path';

const debug = Debug('assist:dns');

export async function configureDns(rl: readline.Interface, envPath: string): Promise<Record<string, string>> {
  debug('Starting DNS management configuration');
  console.log('\n🌐 DNS Management Configuration');
  console.log('===============================');
  
  let envVars = parseEnvFile(envPath);
  let changed = false;

  // Ask if user wants to configure DNS management
  const wantsDnsManagement = await askYesNo(
    rl,
    'Do you want to configure DNS/SSL/Cloudflare management? (y/n): '
  );

  if (!wantsDnsManagement) {
    console.log('⏭️  Skipping DNS management configuration.');
    return envVars;
  }

  console.log('\n📋 DNS management allows you to:');
  console.log('   • Automatically manage DNS records');
  console.log('   • Configure SSL certificates');
  console.log('   • Set up subdomains programmatically');
  console.log('   • Integrate with Cloudflare for DNS management');

  // Ask for DNS domain
  const currentDomain = envVars.HASYX_DNS_DOMAIN;
  if (currentDomain) {
    console.log(`\n🔍 Current DNS domain: ${currentDomain}`);
    const keepDomain = await askYesNo(rl, 'Keep this domain? (y/n): ', true);
    
    if (!keepDomain) {
      const newDomain = await askForInput(
        rl,
        'Enter your DNS domain (e.g., example.com): ',
        currentDomain
      );
      
      if (newDomain !== currentDomain) {
        envVars.HASYX_DNS_DOMAIN = newDomain;
        changed = true;
        console.log(`✅ DNS domain updated to: ${newDomain}`);
      }
    }
  } else {
    const domain = await askForInput(
      rl,
      'Enter your DNS domain (e.g., example.com): '
    );
    
    if (domain) {
      envVars.HASYX_DNS_DOMAIN = domain;
      changed = true;
      console.log(`✅ DNS domain set to: ${domain}`);
    } else {
      console.log('⚠️  No domain provided. DNS management will be limited.');
    }
  }

  // Configure Cloudflare as a child module
  console.log('\n☁️ Cloudflare Configuration');
  console.log('============================');
  console.log('Cloudflare provides reliable DNS management with:');
  console.log('   • Fast global DNS resolution');
  console.log('   • DDoS protection');
  console.log('   • SSL/TLS certificates');
  console.log('   • API for automated management');

  const wantsCloudflare = await askYesNo(
    rl,
    'Do you want to configure Cloudflare for DNS management? (y/n): '
  );

  if (wantsCloudflare) {
    try {
      debug('Configuring Cloudflare integration');
      const cloudflareEnvVars = await configureCloudflare(rl, envPath);
      
      // Merge Cloudflare environment variables
      Object.assign(envVars, cloudflareEnvVars);
      changed = true;
      
      console.log('✅ Cloudflare configuration completed successfully!');
    } catch (error) {
      console.error(`❌ Error configuring Cloudflare: ${error}`);
      debug(`Cloudflare configuration error: ${error}`);
    }
  } else {
    console.log('⏭️  Skipping Cloudflare configuration.');
    console.log('💡 You can configure other DNS providers manually or run this setup again later.');
  }

  // Summary
  console.log('\n📊 DNS Configuration Summary');
  console.log('============================');
  
  if (envVars.HASYX_DNS_DOMAIN) {
    console.log(`🌐 DNS Domain: ${envVars.HASYX_DNS_DOMAIN}`);
  }
  
  if (envVars.CLOUDFLARE_API_TOKEN) {
    console.log('☁️  Cloudflare: Configured');
    console.log(`   Zone ID: ${envVars.CLOUDFLARE_ZONE_ID ? 'Set' : 'Not set'}`);
    console.log(`   Email: ${envVars.LETSENCRYPT_EMAIL ? envVars.LETSENCRYPT_EMAIL : 'Not set'}`);
  } else {
    console.log('☁️  Cloudflare: Not configured');
  }

  // Save changes if any
  if (changed) {
    writeEnvFile(envPath, envVars);
    debug('DNS configuration saved to .env file');
    console.log('\n💾 Configuration saved to .env file');
  }

  console.log('\n🎉 DNS management configuration completed!');
  
  if (envVars.HASYX_DNS_DOMAIN && envVars.CLOUDFLARE_API_TOKEN) {
    console.log('\n🚀 You can now use DNS management features:');
    console.log('   • Create subdomains programmatically');
    console.log('   • Manage SSL certificates');
    console.log('   • Configure reverse proxies');
    console.log('   • Automate DNS record management');
  } else {
    console.log('\n💡 To enable full DNS management features:');
    if (!envVars.HASYX_DNS_DOMAIN) {
      console.log('   • Set HASYX_DNS_DOMAIN in your .env file');
    }
    if (!envVars.CLOUDFLARE_API_TOKEN) {
      console.log('   • Configure Cloudflare API credentials');
    }
  }

  return envVars;
}

export async function setupDnsManagement(): Promise<void> {
  const rl = createRlInterface();
  const envPath = path.resolve('.env');
  
  try {
    await configureDns(rl, envPath);
  } catch (error) {
    console.error(`❌ DNS configuration failed: ${error}`);
    debug(`DNS setup error: ${error}`);
  } finally {
    rl.close();
  }
}

// Export for CLI usage
if (require.main === module) {
  setupDnsManagement().catch(console.error);
} 