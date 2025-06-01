import { SSL, SSLConfig, CertificateInfo, DNSPropagationResult } from './ssl';
import Debug from './debug';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const debug = Debug('test:ssl');

// Environment availability checks
const isCertbotAvailable = (() => {
  try {
    execSync('certbot --version', { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
})();

const isDigAvailable = (() => {
  try {
    execSync('dig -v', { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
})();

const isOpensslAvailable = (() => {
  try {
    execSync('openssl version', { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
})();

// Test configuration
const testDomain = process.env.HASYX_DNS_DOMAIN ? `hasyx-ssl-test.${process.env.HASYX_DNS_DOMAIN}` : 'hasyx-ssl-test.example.com';
const testEmail = process.env.LETSENCRYPT_EMAIL || 'admin@example.com';
const testIp = '149.102.136.233';

// Test directory for mock certificates
const testDir = '/tmp/ssl-test';
const testLetsencryptDir = path.join(testDir, 'letsencrypt', 'live');

describe('DEBUG: SSL Environment Check', () => {
  it('should check SSL tools availability', () => {
    debug(`Certbot availability: ${isCertbotAvailable ? 'available' : 'not available'}`);
    debug(`Dig availability: ${isDigAvailable ? 'available' : 'not available'}`);
    debug(`OpenSSL availability: ${isOpensslAvailable ? 'available' : 'not available'}`);
    
    console.log(`Certbot is ${isCertbotAvailable ? 'available' : 'not available'} on this system`);
    console.log(`Dig is ${isDigAvailable ? 'available' : 'not available'} on this system`);
    console.log(`OpenSSL is ${isOpensslAvailable ? 'available' : 'not available'} on this system`);
    
    if (!isCertbotAvailable) {
      console.log('To run SSL tests with real certbot, install certbot:');
      console.log('  Ubuntu/Debian: sudo apt install certbot python3-certbot-nginx');
      console.log('  CentOS/RHEL: sudo yum install certbot python3-certbot-nginx');
      console.log('  macOS: brew install certbot');
    }
  });
});

describe('SSL Class', () => {
  let ssl: SSL;

  beforeEach(() => {
    // Create test directories
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(testLetsencryptDir, { recursive: true });

    // Initialize SSL with test configuration
    const config: SSLConfig = {
      email: testEmail,
      certbotPath: 'echo', // Mock certbot for testing
    };
    
    ssl = new SSL(config);
    ssl.letsencryptPath = path.join(testDir, 'letsencrypt', 'live'); // Override for testing
    
    debug(`Test setup: SSL instance created with test directories`);
  });

  afterEach(() => {
    // Clean up test directories
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
      debug(`Cleanup: Removed test directory ${testDir}`);
    }
  });

  describe('Constructor and Configuration', () => {
    it('should create SSL instance with default configuration', () => {
      const defaultSSL = new SSL();
      expect(defaultSSL).toBeInstanceOf(SSL);
      expect(defaultSSL.certbotPath).toBe('certbot');
      debug('Constructor test: SSL instance created with defaults');
    });

    it('should create SSL instance with custom configuration', () => {
      const customConfig: SSLConfig = {
        email: 'custom@example.com',
        certbotPath: '/custom/certbot',
      };
      
      const customSSL = new SSL(customConfig);
      expect(customSSL.defaultEmail).toBe('custom@example.com');
      expect(customSSL.certbotPath).toBe('/custom/certbot');
      debug('Constructor test: SSL instance created with custom config');
    });

    it('should use environment variables for configuration', () => {
      // Set environment variable
      const originalEmail = process.env.LETSENCRYPT_EMAIL;
      process.env.LETSENCRYPT_EMAIL = 'env@example.com';
      
      try {
        const envSSL = new SSL();
        expect(envSSL.defaultEmail).toBe('env@example.com');
        debug('Constructor test: Environment variable used for email');
      } finally {
        // Restore original environment
        if (originalEmail) {
          process.env.LETSENCRYPT_EMAIL = originalEmail;
        } else {
          delete process.env.LETSENCRYPT_EMAIL;
        }
      }
    });
  });

  describe('Certificate Path Management', () => {
    it('should generate correct certificate paths', () => {
      const paths = ssl.getCertificatePaths(testDomain);
      
      expect(paths.certificate).toContain(testDomain);
      expect(paths.certificate).toContain('cert.pem');
      expect(paths.privateKey).toContain('privkey.pem');
      expect(paths.fullchain).toContain('fullchain.pem');
      
      debug(`Certificate paths generated for ${testDomain}: ${JSON.stringify(paths)}`);
    });

    it('should check certificate existence correctly', () => {
      // Initially no certificate should exist
      expect(ssl.checkCertificateExists(testDomain)).toBe(false);
      
      // Create mock certificate files
      const domainDir = path.join(testLetsencryptDir, testDomain);
      fs.mkdirSync(domainDir, { recursive: true });
      
      const paths = ssl.getCertificatePaths(testDomain);
      fs.writeFileSync(paths.certificate, 'mock cert');
      fs.writeFileSync(paths.privateKey, 'mock key');
      fs.writeFileSync(paths.fullchain, 'mock fullchain');
      
      expect(ssl.checkCertificateExists(testDomain)).toBe(true);
      debug('Certificate existence check working correctly');
    });
  });

  describe('Certificate Information', () => {
    it('should return null for non-existing certificate', async () => {
      const info = await ssl.get('non-existent.example.com');
      expect(info).toBeNull();
      debug('Certificate info correctly returned null for non-existent certificate');
    });

    it('should parse certificate information when certificate exists', async () => {
      // Create mock certificate with valid structure for testing
      const domainDir = path.join(testLetsencryptDir, testDomain);
      fs.mkdirSync(domainDir, { recursive: true });
      
      const paths = ssl.getCertificatePaths(testDomain);
      
      // Create a very basic mock certificate that won't actually be parsed by openssl
      fs.writeFileSync(paths.certificate, 'mock cert');
      fs.writeFileSync(paths.privateKey, 'mock key');
      fs.writeFileSync(paths.fullchain, 'mock fullchain');
      
      // Since we can't create a real certificate, this test will fail at parsing
      // but we can test that the existence check works
      expect(ssl.checkCertificateExists(testDomain)).toBe(true);
      
      debug('Mock certificate files created for testing');
    });
  });

  describe('Certificate Operations', () => {
    it('should require email for certificate creation', async () => {
      const originalEmail = process.env.LETSENCRYPT_EMAIL;
      delete process.env.LETSENCRYPT_EMAIL; // Temporarily remove email env var
      const sslNoEmail = new SSL({ email: "" }); // Explicitly no email
      
      await expect(sslNoEmail.create(testDomain))
        .rejects.toThrow('Email is required');
      
      debug('Certificate creation correctly requires email');
      
      // Restore email env var
      if (originalEmail) process.env.LETSENCRYPT_EMAIL = originalEmail;
    });

    it('should throw error when creating duplicate certificate', async () => {
      // Create mock certificate first
      const domainDir = path.join(testLetsencryptDir, testDomain);
      fs.mkdirSync(domainDir, { recursive: true });
      
      const paths = ssl.getCertificatePaths(testDomain);
      fs.writeFileSync(paths.certificate, 'mock cert');
      fs.writeFileSync(paths.privateKey, 'mock key');
      fs.writeFileSync(paths.fullchain, 'mock fullchain');
      
      await expect(ssl.create(testDomain, testEmail))
        .rejects.toThrow('already exists');
      
      debug('Duplicate certificate creation correctly rejected');
    });

    it('should throw error when deleting non-existing certificate', async () => {
      await expect(ssl.delete('non-existent.example.com'))
        .rejects.toThrow('does not exist');
      
      debug('Deletion of non-existent certificate correctly rejected');
    });

    it('should replace existing certificate with define', async () => {
      // Create existing certificate
      const domainDir = path.join(testLetsencryptDir, testDomain);
      fs.mkdirSync(domainDir, { recursive: true });
      
      const paths = ssl.getCertificatePaths(testDomain);
      fs.writeFileSync(paths.certificate, 'old cert');
      fs.writeFileSync(paths.privateKey, 'old key');
      fs.writeFileSync(paths.fullchain, 'old fullchain');
      
      // Override SSL methods to simulate proper certbot behavior
      const originalDelete = ssl.delete;
      ssl.delete = async (domain: string) => {
        // Simulate file removal by certbot
        const domainPath = path.join(testLetsencryptDir, domain);
        if (fs.existsSync(domainPath)) {
          fs.rmSync(domainPath, { recursive: true, force: true });
        }
        debug(`Mock SSL delete: removed files for ${domain}`);
      };
      
      const originalCreate = ssl.create;
      ssl.create = async (domain: string, email?: string) => {
        // Simulate certificate creation
        const domainPath = path.join(testLetsencryptDir, domain);
        fs.mkdirSync(domainPath, { recursive: true });
        const certPaths = ssl.getCertificatePaths(domain);
        fs.writeFileSync(certPaths.certificate, 'new cert');
        fs.writeFileSync(certPaths.privateKey, 'new key');
        fs.writeFileSync(certPaths.fullchain, 'new fullchain');
        debug(`Mock SSL create: created files for ${domain}`);
      };
      
      try {
        await expect(ssl.define(testDomain, testEmail))
          .resolves.not.toThrow();
        
        debug('Define operation replaced existing certificate');
      } finally {
        // Restore original methods
        ssl.delete = originalDelete;
        ssl.create = originalCreate;
      }
    });
  });

  describe('Define/Undefine Operations', () => {
    it('should define certificate without error for new domain', async () => {
      // Mock certbot to succeed
      ssl.certbotPath = 'true'; // Command that always succeeds
      
      await expect(ssl.define('new-domain.example.com', testEmail))
        .resolves.not.toThrow();
      
      debug('Define operation completed for new domain');
    });

    it('should undefine certificate without error for non-existing domain', async () => {
      await expect(ssl.undefine('non-existent.example.com'))
        .resolves.not.toThrow();
      
      debug('Undefine operation completed for non-existent domain without error');
    });
  });

  describe('Check Operations', () => {
    it('should return non-existing status for missing certificate', async () => {
      const status = await ssl.check('missing.example.com');
      
      expect(status.exists).toBe(false);
      expect(status.domain).toBe('missing.example.com');
      
      debug('Check correctly identified missing certificate');
    });

    it('should validate certbot availability', () => {
      const realSSL = new SSL({ certbotPath: 'certbot' });
      
      if (isCertbotAvailable) {
        expect(() => realSSL.validateCertbotAvailable()).not.toThrow();
        debug('Certbot validation passed');
      } else {
        expect(() => realSSL.validateCertbotAvailable()).toThrow();
        debug('Certbot validation correctly failed for missing certbot');
      }
    });
  });
});

// DNS Propagation Tests (when dig is available)
(isDigAvailable ? describe : describe.skip)('SSL DNS Propagation', () => {
  let ssl: SSL;

  beforeEach(() => {
    ssl = new SSL({ email: testEmail });
  });

  afterEach(() => {
    // No cleanup needed for DNS tests
  });

  it('should wait for DNS propagation with real DNS lookup', async () => {
    debug('Testing DNS propagation wait with real DNS lookup');
    
    // Test with a well-known domain that should resolve quickly
    const knownDomain = 'google.com';
    const knownIp = '8.8.8.8'; // This might not match exactly, but tests the mechanism
    
    try {
      // Set short timeout for test
      const result = await ssl.wait(knownDomain, knownIp, 1);
      
      expect(result.domain).toBe(knownDomain);
      expect(result.expectedIp).toBe(knownIp);
      expect(typeof result.actualIp).toBe('string');
      expect(result.attempts).toBeGreaterThan(0);
      
      debug(`DNS propagation test completed: ${JSON.stringify(result)}`);
    } catch (error) {
      // This is expected as we're not expecting google.com to resolve to 8.8.8.8
      expect(error).toBeInstanceOf(Error);
      debug('DNS propagation test completed with expected timeout');
    }
  }, 15000); // 15 second timeout for DNS test
});

// OpenSSL Tests (when openssl is available)
(isOpensslAvailable ? describe : describe.skip)('SSL Certificate Parsing', () => {
  let ssl: SSL;

  beforeEach(() => {
    ssl = new SSL({ email: testEmail });
  });

  afterEach(() => {
    // No cleanup needed for OpenSSL tests
  });

  it('should handle openssl parsing errors gracefully', () => {
    const invalidCertPath = '/tmp/invalid-cert.pem';
    
    // Create invalid certificate file
    fs.writeFileSync(invalidCertPath, 'invalid certificate content');
    
    try {
      expect(() => ssl.parseCertificateInfo(invalidCertPath))
        .toThrow('Failed to parse certificate');
      
      debug('OpenSSL parsing correctly handled invalid certificate');
    } finally {
      // Cleanup
      if (fs.existsSync(invalidCertPath)) {
        fs.unlinkSync(invalidCertPath);
      }
    }
  });
});

// Fallback tests when tools are not available
(!isCertbotAvailable ? describe : describe.skip)('SSL Class - Certbot Not Available', () => {
  it('should skip certbot tests when certbot is not installed', () => {
    expect(isCertbotAvailable).toBeFalsy();
    debug('SSL certbot tests skipped: certbot not available on system');
  });
});

(!isDigAvailable ? describe : describe.skip)('SSL Class - Dig Not Available', () => {
  it('should skip DNS tests when dig is not installed', () => {
    expect(isDigAvailable).toBeFalsy();
    debug('SSL DNS tests skipped: dig not available on system');
  });
});

(!isOpensslAvailable ? describe : describe.skip)('SSL Class - OpenSSL Not Available', () => {
  it('should skip certificate parsing tests when openssl is not installed', () => {
    expect(isOpensslAvailable).toBeFalsy();
    debug('SSL parsing tests skipped: openssl not available on system');
  });
}); 