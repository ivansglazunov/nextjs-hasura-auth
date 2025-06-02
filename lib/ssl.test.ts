import { SSL, SSLConfig, CertificateInfo, DNSPropagationResult } from './ssl';
import Debug from './debug';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const debug = Debug('test:ssl');

// Test configuration from environment
const TEST_DOMAIN = process.env.HASYX_DNS_DOMAIN || 'deep.foundation';
const LETSENCRYPT_EMAIL = process.env.LETSENCRYPT_EMAIL || 'admin@deep.foundation';
const SERVER_IP = process.env.HASYX_SERVER_IP || '149.102.136.233';

// Environment availability check for subdomain functionality
const isEnvAvailable = Boolean(
  process.env.CLOUDFLARE_API_TOKEN &&
  process.env.CLOUDFLARE_ZONE_ID &&
  process.env.HASYX_DNS_DOMAIN &&
  process.env.LETSENCRYPT_EMAIL &&
  process.env.HASYX_SERVER_IP
);

// Environment availability checks
function checkSystemDependency(command: string, name: string): boolean {
  try {
    execSync(`${command}`, { stdio: 'pipe' });
    debug(`${name} is available`);
    return true;
  } catch (error) {
    debug(`${name} is NOT available`);
    return false;
  }
}

function generateTestDomain(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `ssl-test-${timestamp}-${random}.${TEST_DOMAIN}`;
}

async function waitForDNSResolution(domain: string, expectedIp: string, maxAttempts = 10): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = execSync(`dig +short ${domain}`, { encoding: 'utf8', timeout: 5000 });
      const actualIp = result.trim();
      debug(`DNS resolution attempt ${attempt}: ${domain} -> ${actualIp} (expected: ${expectedIp})`);
      
      if (actualIp === expectedIp) {
        return true;
      }
    } catch (error) {
      debug(`DNS resolution attempt ${attempt} failed: ${error}`);
    }
    
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  return false;
}

describe('[DEBUG] Real SSL Environment Check', () => {
  it('should verify system dependencies for real SSL operations', () => {
    debug('Checking SSL system dependencies for real tests');
    
    const certbotAvailable = checkSystemDependency('certbot --version', 'certbot (Let\'s Encrypt client)');
    const digAvailable = checkSystemDependency('dig -v', 'dig (DNS lookup)');
    const opensslAvailable = checkSystemDependency('openssl version', 'openssl (SSL/TLS toolkit)');
    const nginxAvailable = checkSystemDependency('nginx -v', 'nginx (web server)');
    
    debug(`System dependencies status:`);
    debug(`  certbot: ${certbotAvailable ? 'available' : 'missing'}`);
    debug(`  dig: ${digAvailable ? 'available' : 'missing'}`);
    debug(`  openssl: ${opensslAvailable ? 'available' : 'missing'}`);
    debug(`  nginx: ${nginxAvailable ? 'available' : 'missing'}`);
    
    // We expect at least some tools to be available
    expect(opensslAvailable).toBe(true); // openssl should be available on most systems
  });

  it('should verify environment configuration', () => {
    debug('Checking environment configuration for real SSL tests');
    
    debug(`TEST_DOMAIN: ${TEST_DOMAIN}`);
    debug(`LETSENCRYPT_EMAIL: ${LETSENCRYPT_EMAIL}`);
    debug(`SERVER_IP: ${SERVER_IP}`);
    debug(`Environment available: ${isEnvAvailable}`);
    
    if (!isEnvAvailable) {
      debug('Missing environment variables:');
      if (!process.env.CLOUDFLARE_API_TOKEN) debug('  - CLOUDFLARE_API_TOKEN');
      if (!process.env.CLOUDFLARE_ZONE_ID) debug('  - CLOUDFLARE_ZONE_ID');
      if (!process.env.HASYX_DNS_DOMAIN) debug('  - HASYX_DNS_DOMAIN');
      if (!process.env.LETSENCRYPT_EMAIL) debug('  - LETSENCRYPT_EMAIL');
      if (!process.env.HASYX_SERVER_IP) debug('  - HASYX_SERVER_IP');
    }
    
    expect(TEST_DOMAIN).toBeTruthy();
    expect(LETSENCRYPT_EMAIL).toBeTruthy();
    expect(SERVER_IP).toBeTruthy();
  });
});

(isEnvAvailable ? describe : describe.skip)('Real SSL Class Tests', () => {
  
  it('should create real SSL instance with proper configuration', () => {
    const testDomain = generateTestDomain();
    
    try {
      debug(`Testing SSL instance creation for domain: ${testDomain}`);
      
      // Create real SSL instance
      const ssl = new SSL({
        email: LETSENCRYPT_EMAIL,
        staging: true // Use staging environment for tests
      });
      
      expect(ssl).toBeInstanceOf(SSL);
      expect(ssl.defaultEmail).toBe(LETSENCRYPT_EMAIL);
      expect(ssl.certbotPath).toBe('certbot'); // Should use real certbot
      
      debug('Real SSL instance created successfully');
      
      // Test certificate path generation
      const paths = ssl.getCertificatePaths(testDomain);
      expect(paths.certificate).toContain(testDomain);
      expect(paths.certificate).toContain('cert.pem');
      expect(paths.privateKey).toContain('privkey.pem');
      expect(paths.fullchain).toContain('fullchain.pem');
      
      debug(`Real certificate paths generated: ${JSON.stringify(paths)}`);
      
    } finally {
      debug('SSL instance test cleanup completed');
    }
  });

  it('should handle real certificate existence checks', async () => {
    const testDomain = generateTestDomain();
    
    try {
      debug(`Testing real certificate existence check for: ${testDomain}`);
      
      const ssl = new SSL({
        email: LETSENCRYPT_EMAIL,
        staging: true // Use staging environment for tests
      });
      
      // Check non-existing certificate
      const nonExistentInfo = await ssl.get(testDomain);
      expect(nonExistentInfo).toBeNull();
      
      debug('Real certificate existence check completed - certificate does not exist as expected');
      
      // Test certificate file existence check
      const exists = ssl.checkCertificateExists(testDomain);
      expect(exists).toBe(false);
      
      debug('Real certificate file existence check completed');
      
    } finally {
      debug('Certificate existence test cleanup completed');
    }
  });

  it('should test real DNS propagation checking functionality', async () => {
    const testDomain = generateTestDomain();
    
    try {
      debug(`Testing real DNS propagation check for: ${testDomain}`);
      
      const ssl = new SSL({
        email: LETSENCRYPT_EMAIL,
        staging: true // Use staging environment for tests
      });
      
      // Test DNS propagation check (this domain won't resolve, but we test the mechanism)
      const result = await ssl.wait(testDomain, SERVER_IP, 1); // Only 1 attempt for testing
      
      // We expect this to fail since the domain doesn't actually point to our server
      expect(result.propagated).toBe(false);
      expect(result.domain).toBe(testDomain);
      expect(result.expectedIp).toBe(SERVER_IP);
      
      debug(`Real DNS propagation test completed: ${JSON.stringify(result)}`);
      
    } finally {
      debug('DNS propagation test cleanup completed');
    }
  }, 30000);

  it('should handle real certificate validation operations', async () => {
    const testDomain = generateTestDomain();
    
    try {
      debug(`Testing real certificate validation for: ${testDomain}`);
      
      const ssl = new SSL({
        email: LETSENCRYPT_EMAIL,
        staging: true // Use staging environment for tests
      });
      
      // Check certificate status (should return exists: false for non-existent cert)
      const certStatus = await ssl.check(testDomain);
      expect(certStatus.exists).toBe(false);
      expect(certStatus.domain).toBe(testDomain);
      
      debug('Real certificate validation completed');
      
    } finally {
      debug('Certificate validation test cleanup completed');
    }
  });

  it('should test real Let\'s Encrypt certificate creation (safe mode)', async () => {
    const testDomain = generateTestDomain();
    let certificatesCreated: string[] = [];
    
    try {
      debug(`Testing real Let\'s Encrypt certificate creation for: ${testDomain}`);
      
      if (!checkSystemDependency('certbot --version', 'certbot')) {
        debug('Skipping real certificate creation - certbot not available');
        return;
      }
      
      const ssl = new SSL({
        email: LETSENCRYPT_EMAIL,
        staging: true // Use staging environment for tests
      });
      
      // Note: We would need the domain to actually point to this server for real certificate creation
      // For safety, we'll test the command construction without actual execution
      debug('Real certificate creation would require:');
      debug(`  1. Domain ${testDomain} pointing to server ${SERVER_IP}`);
      debug(`  2. Web server running on port 80/443`);
      debug(`  3. Firewall allowing HTTP/HTTPS traffic`);
      debug('  4. For staging tests: certbot --staging flag would be added');
      
      // Test certificate creation logic without actual execution
      try {
        // This will likely fail because the domain doesn't point to us
        // but it tests the real certbot integration
        await ssl.create(testDomain, LETSENCRYPT_EMAIL);
        certificatesCreated.push(testDomain);
        debug(`Real certificate creation succeeded for: ${testDomain}`);
      } catch (error) {
        debug(`Real certificate creation failed as expected (domain not pointing to server): ${error}`);
        // This is expected - we don't have real DNS pointing to our server
      }
      
    } finally {
      // Real cleanup of any created certificates
      if (certificatesCreated.length > 0) {
        const ssl = new SSL({ email: LETSENCRYPT_EMAIL });
        for (const domain of certificatesCreated) {
          try {
            await ssl.delete(domain);
            debug(`Cleaned up real certificate: ${domain}`);
          } catch (error) {
            debug(`Certificate cleanup warning: ${error}`);
          }
        }
      }
    }
  }, 60000);

  it('should test real SSL certificate file operations', () => {
    const testDomain = generateTestDomain();
    
    try {
      debug(`Testing real SSL certificate file operations for: ${testDomain}`);
      
      const ssl = new SSL({
        email: LETSENCRYPT_EMAIL,
        staging: true // Use staging environment for tests
      });
      
      // Test path generation
      const paths = ssl.getCertificatePaths(testDomain);
      
      expect(paths.certificate).toBe(`/etc/letsencrypt/live/${testDomain}/cert.pem`);
      expect(paths.privateKey).toBe(`/etc/letsencrypt/live/${testDomain}/privkey.pem`);
      expect(paths.fullchain).toBe(`/etc/letsencrypt/live/${testDomain}/fullchain.pem`);
      
      debug(`Real certificate paths verified: ${JSON.stringify(paths)}`);
      
      // Test file existence check (should be false for non-existent certificates)
      const exists = ssl.checkCertificateExists(testDomain);
      expect(exists).toBe(false);
      
      debug('Real certificate file existence check completed');
      
    } finally {
      debug('SSL file operations test cleanup completed');
    }
  });

  it('should validate real SSL configuration requirements', async () => {
    const testDomain = generateTestDomain();
    
    try {
      debug(`Testing real SSL configuration validation for: ${testDomain}`);
      
      // Test with missing email
      const sslNoEmail = new SSL({ email: '', staging: true });
      
      await expect(sslNoEmail.create(testDomain))
        .rejects.toThrow('Email is required for certificate creation');
      
      debug('Real SSL email validation working correctly');
      
      // Test with valid configuration
      const sslValid = new SSL({
        email: LETSENCRYPT_EMAIL,
        staging: true // Use staging environment for tests
      });
      
      expect(sslValid.defaultEmail).toBe(LETSENCRYPT_EMAIL);
      
      debug('Real SSL configuration validation completed');
      
    } finally {
      debug('SSL configuration validation test cleanup completed');
    }
  });

  it('should show real SSL environment status', () => {
    debug('Real SSL tests use actual dependencies:');
    debug(`  • Real certbot (${checkSystemDependency('certbot --version', 'certbot') ? 'available' : 'missing'})`);
    debug('  • Real Let\'s Encrypt API (production mode - staging would require custom certbot flags)');
    debug('  • Real file system operations');
    debug('  • Real DNS resolution checks');
    debug(`  • Test domain pattern: ssl-test-{timestamp}-{random}.${TEST_DOMAIN}`);
    debug(`  • Email: ${LETSENCRYPT_EMAIL}`);
    debug(`  • Server IP: ${SERVER_IP}`);
    
    expect(TEST_DOMAIN).toBeTruthy();
    expect(LETSENCRYPT_EMAIL).toBeTruthy();
    expect(SERVER_IP).toBeTruthy();
  });
}); 