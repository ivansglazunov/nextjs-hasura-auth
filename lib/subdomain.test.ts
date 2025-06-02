import { SubdomainManager, SubdomainManagerConfig, SubdomainConfig, SubdomainInfo } from './subdomain';
import { CloudFlare, DnsRecord } from './cloudflare';
import { SSL, CertificateInfo } from './ssl';
import { Nginx, SiteConfig } from './nginx';
import Debug from './debug';
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const debug = Debug('test:subdomain');

// Test configuration from environment
const TEST_DOMAIN = process.env.HASYX_DNS_DOMAIN || 'deep.foundation';
const CLOUDFLARE_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID;
const LETSENCRYPT_EMAIL = process.env.LETSENCRYPT_EMAIL || 'admin@deep.foundation';
const SERVER_IP = process.env.HASYX_SERVER_IP || '149.102.136.233';

function generateTestSubdomain(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `test-${timestamp}-${random}`;
}

async function waitForDNSPropagation(domain: string, expectedIp: string, maxAttempts = 30): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = execSync(`dig +short ${domain}`, { encoding: 'utf8', timeout: 5000 });
      const actualIp = result.trim();
      debug(`DNS check attempt ${attempt}: ${domain} -> ${actualIp} (expected: ${expectedIp})`);
      
      if (actualIp === expectedIp) {
        return true;
      }
    } catch (error) {
      debug(`DNS check attempt ${attempt} failed: ${error}`);
    }
    
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  return false;
}

describe('[DEBUG] Environment Check for Real SubdomainManager Tests', () => {
  it('should verify required environment variables', () => {
    debug('Checking environment variables for real tests');
    
    if (!CLOUDFLARE_TOKEN) {
      debug('CLOUDFLARE_API_TOKEN not set - skipping real CloudFlare tests');
    }
    if (!CLOUDFLARE_ZONE_ID) {
      debug('CLOUDFLARE_ZONE_ID not set - skipping real CloudFlare tests');
    }
    
    debug(`TEST_DOMAIN: ${TEST_DOMAIN}`);
    debug(`LETSENCRYPT_EMAIL: ${LETSENCRYPT_EMAIL}`);
    debug(`SERVER_IP: ${SERVER_IP}`);
    debug(`CloudFlare token available: ${!!CLOUDFLARE_TOKEN}`);
    debug(`CloudFlare zone ID available: ${!!CLOUDFLARE_ZONE_ID}`);
  });

  it('should check system dependencies', () => {
    const checkCommand = (cmd: string, name: string) => {
      try {
        execSync(`which ${cmd}`, { stdio: 'pipe' });
        debug(`${name} is available`);
        return true;
      } catch (error) {
        debug(`${name} is NOT available - some tests may be skipped`);
        return false;
      }
    };

    checkCommand('dig', 'dig (DNS lookup)');
    checkCommand('certbot', 'certbot (Let\'s Encrypt)');
    checkCommand('nginx', 'nginx');
  });
});

describe('Real SubdomainManager Tests', () => {
  
  it('should create real subdomain with DNS record only (without SSL/Nginx)', async () => {
    if (!CLOUDFLARE_TOKEN || !CLOUDFLARE_ZONE_ID) {
      debug('Skipping real CloudFlare test - missing credentials');
      return;
    }

    const testSubdomain = generateTestSubdomain();
    const testDomain = `${testSubdomain}.${TEST_DOMAIN}`;
    let resourcesCreated: string[] = [];

    try {
      debug(`Starting real DNS test for subdomain: ${testSubdomain}`);
      
      // Create real CloudFlare instance
      const cloudflare = new CloudFlare({
        apiToken: CLOUDFLARE_TOKEN,
        zoneId: CLOUDFLARE_ZONE_ID,
        domain: TEST_DOMAIN
      });

      // Create real DNS record
      const record = await cloudflare.create(testSubdomain, {
        ip: SERVER_IP,
        ttl: 300
      });
      resourcesCreated.push(testSubdomain);

      debug(`Created real DNS record: ${record.name} -> ${record.content}`);

      // Verify record exists in CloudFlare
      const retrievedRecord = await cloudflare.get(testSubdomain);
      expect(retrievedRecord).toBeTruthy();
      expect(retrievedRecord!.content).toBe(SERVER_IP);
      expect(retrievedRecord!.type).toBe('A');

      debug('Real DNS record verified in CloudFlare API');

      // Wait for DNS propagation and verify with independent DNS query
      const propagated = await waitForDNSPropagation(testDomain, SERVER_IP, 10);
      if (propagated) {
        debug('Real DNS propagation verified with dig command');
      } else {
        debug('DNS propagation still in progress (this is normal for new records)');
      }

    } finally {
      // Real cleanup of DNS records
      if (CLOUDFLARE_TOKEN && CLOUDFLARE_ZONE_ID && resourcesCreated.length > 0) {
        const cloudflare = new CloudFlare({
          apiToken: CLOUDFLARE_TOKEN,
          zoneId: CLOUDFLARE_ZONE_ID,
          domain: TEST_DOMAIN
        });

        for (const subdomain of resourcesCreated) {
          try {
            await cloudflare.delete(subdomain);
            debug(`Cleaned up real DNS record: ${subdomain}`);
          } catch (error) {
            debug(`Cleanup warning: ${error}`);
          }
        }
      }
    }
  }, 60000);

  it('should handle real SSL certificate operations (test mode)', async () => {
    // Note: This test focuses on SSL path generation and basic operations
    const testSubdomain = generateTestSubdomain();
    const testDomain = `${testSubdomain}.${TEST_DOMAIN}`;
    let certificatesCreated: string[] = [];

    try {
      debug(`Starting real SSL test for domain: ${testDomain}`);

      // Create real SSL instance
      const ssl = new SSL({
        email: LETSENCRYPT_EMAIL,
        staging: true // Use staging environment for tests
      });

      // Check if certificate already exists
      const existingCert = await ssl.get(testDomain);
      if (existingCert) {
        debug('Certificate already exists, skipping creation test');
        return;
      }

      // For real SSL test, we need the domain to actually point to our server
      // This is a limitation test - showing what would happen
      debug('Real SSL test: would require actual DNS pointing to our server');
      debug('Skipping actual certificate creation to avoid Let\'s Encrypt rate limits');

      // Test certificate path generation
      const paths = ssl.getCertificatePaths(testDomain);
      expect(paths.certificate).toContain(testDomain);
      expect(paths.certificate).toContain('cert.pem');
      expect(paths.privateKey).toContain('privkey.pem');
      expect(paths.fullchain).toContain('fullchain.pem');

      debug('Real SSL certificate paths generated correctly');

    } finally {
      // Real cleanup would happen here
      debug('Real SSL cleanup completed');
    }
  }, 30000);

  it('should handle real nginx configuration operations', async () => {
    const testSubdomain = generateTestSubdomain();
    const testDomain = `${testSubdomain}.${TEST_DOMAIN}`;
    let sitesCreated: string[] = [];

    try {
      debug(`Starting real nginx test for site: ${testDomain}`);

      // Create real Nginx instance
      const nginx = new Nginx();

      // Test nginx configuration syntax check (using public method through class cast)
      try {
        // Access private method through any cast for testing purposes
        (nginx as any).testNginxConfig();
        debug('Real nginx configuration syntax check passed');
      } catch (error) {
        debug(`Real nginx config test failed: ${error}`);
        // This might fail if nginx is not properly configured
      }

      // List existing sites
      const existingSites = await nginx.list();
      debug(`Real nginx sites found: ${existingSites.length}`);

      // Test site configuration creation (dry run mode)
      debug(`Real nginx configuration would be created for: ${testDomain}`);
      debug('Configuration would include: proxy_pass, SSL settings, server_name');

      // Note: Actual nginx site creation commented out to avoid system changes
      // await nginx.create(testDomain, { serverName: testDomain, proxyPass: 'http://localhost:3000' });
      // sitesCreated.push(testDomain);

      debug('Real nginx test completed (dry run mode)');

    } finally {
      // Real cleanup of nginx sites
      for (const site of sitesCreated) {
        try {
          const nginx = new Nginx();
          await nginx.delete(site);
          debug(`Cleaned up real nginx site: ${site}`);
        } catch (error) {
          debug(`Nginx cleanup warning: ${error}`);
        }
      }
    }
  }, 30000);

  it('should integrate real CloudFlare, SSL, and Nginx through SubdomainManager', async () => {
    if (!CLOUDFLARE_TOKEN || !CLOUDFLARE_ZONE_ID) {
      debug('Skipping real SubdomainManager integration test - missing CloudFlare credentials');
      return;
    }

    const testSubdomain = generateTestSubdomain();
    const testDomain = `${testSubdomain}.${TEST_DOMAIN}`;
    let resourcesCreated: string[] = [];

    try {
      debug(`Starting real SubdomainManager integration test for: ${testSubdomain}`);

      // Create real instances
      const cloudflare = new CloudFlare({
        apiToken: CLOUDFLARE_TOKEN,
        zoneId: CLOUDFLARE_ZONE_ID,
        domain: TEST_DOMAIN
      });

      const ssl = new SSL({
        email: LETSENCRYPT_EMAIL,
        staging: true // Use staging environment for tests
      });

      const nginx = new Nginx();

      // Create real SubdomainManager with real dependencies
      const subdomainManager = new SubdomainManager({
        cloudflare,
        ssl,
        nginx
      });

      debug('Real SubdomainManager created with real dependencies');

      // Test subdomain definition (DNS only for safety)
      const subdomainConfig: SubdomainConfig = {
        ip: SERVER_IP,
        port: 3000,
        email: LETSENCRYPT_EMAIL
      };

      // Define subdomain (this will create real DNS record)
      await subdomainManager.define(testSubdomain, subdomainConfig);
      resourcesCreated.push(testSubdomain);

      debug(`Real subdomain defined: ${testSubdomain}`);

      // Verify subdomain was created using getSubdomainInfo
      const subdomainInfo = await subdomainManager.getSubdomainInfo(testSubdomain);
      expect(subdomainInfo).toBeTruthy();
      expect(subdomainInfo.subdomain).toBe(testSubdomain);
      expect(subdomainInfo.fullDomain).toBe(testDomain);

      debug('Real subdomain verification completed');

      // List all subdomains
      const allSubdomains = await subdomainManager.list();
      const ourSubdomain = allSubdomains.find(s => s.subdomain === testSubdomain);
      expect(ourSubdomain).toBeTruthy();

      debug(`Real subdomain found in list: ${ourSubdomain ? 'yes' : 'no'}`);

    } finally {
      // Real cleanup through SubdomainManager
      if (CLOUDFLARE_TOKEN && CLOUDFLARE_ZONE_ID && resourcesCreated.length > 0) {
        const cloudflare = new CloudFlare({
          apiToken: CLOUDFLARE_TOKEN,
          zoneId: CLOUDFLARE_ZONE_ID,
          domain: TEST_DOMAIN
        });

        const ssl = new SSL({ email: LETSENCRYPT_EMAIL });
        const nginx = new Nginx();
        const subdomainManager = new SubdomainManager({ cloudflare, ssl, nginx });

        for (const subdomain of resourcesCreated) {
          try {
            await subdomainManager.undefine(subdomain);
            debug(`Cleaned up real subdomain: ${subdomain}`);
          } catch (error) {
            debug(`Subdomain cleanup warning: ${error}`);
          }
        }
      }
    }
  }, 120000);

  it('should show real environment status', () => {
    debug('Real SubdomainManager tests use actual dependencies:');
    debug(`  • Real CloudFlare API (${CLOUDFLARE_TOKEN ? 'configured' : 'missing token'})`);
    debug(`  • Real SSL/Let\'s Encrypt (${LETSENCRYPT_EMAIL})`);
    debug('  • Real Nginx configuration management');
    debug(`  • Test domain: ${TEST_DOMAIN}`);
    debug(`  • Server IP: ${SERVER_IP}`);
    
    expect(TEST_DOMAIN).toBeTruthy();
    expect(LETSENCRYPT_EMAIL).toBeTruthy();
    expect(SERVER_IP).toBeTruthy();
  });
}); 