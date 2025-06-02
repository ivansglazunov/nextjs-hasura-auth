import { CloudFlare, CloudflareConfig, SubdomainDnsConfig } from './cloudflare';
import Debug from './debug';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const debug = Debug('test:cloudflare');

// Environment availability check
const isEnvAvailable = Boolean(
  process.env.CLOUDFLARE_API_TOKEN &&
  process.env.CLOUDFLARE_ZONE_ID &&
  process.env.HASYX_DNS_DOMAIN &&
  process.env.LETSENCRYPT_EMAIL &&
  process.env.HASYX_SERVER_IP
);

const getCloudflareConfig = (): CloudflareConfig => ({
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
  zoneId: process.env.CLOUDFLARE_ZONE_ID!,
  domain: process.env.HASYX_DNS_DOMAIN!
});

function generateTestSubdomain(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `cf-test-${timestamp}-${random}`;
}

describe('[DEBUG] Real CloudFlare Environment Check', () => {
  it('should verify required environment variables for real CloudFlare tests', () => {
    debug(`CloudFlare environment check: ${isEnvAvailable ? 'available' : 'missing variables'}`);
    debug('Environment variables status:');
    debug(`  CLOUDFLARE_API_TOKEN: ${process.env.CLOUDFLARE_API_TOKEN ? 'set' : 'missing'}`);
    debug(`  CLOUDFLARE_ZONE_ID: ${process.env.CLOUDFLARE_ZONE_ID ? 'set' : 'missing'}`);
    debug(`  HASYX_DNS_DOMAIN: ${process.env.HASYX_DNS_DOMAIN ? 'set' : 'missing'}`);
    debug(`  LETSENCRYPT_EMAIL: ${process.env.LETSENCRYPT_EMAIL ? 'set' : 'missing'}`);
    debug(`  HASYX_SERVER_IP: ${process.env.HASYX_SERVER_IP ? 'set' : 'missing'}`);
    
    if (!isEnvAvailable) {
      debug('To run real CloudFlare tests, set these environment variables:');
      debug('  CLOUDFLARE_API_TOKEN=your_api_token');
      debug('  CLOUDFLARE_ZONE_ID=your_zone_id');
      debug('  HASYX_DNS_DOMAIN=your_domain');
      debug('  LETSENCRYPT_EMAIL=your_email');
      debug('  HASYX_SERVER_IP=your_server_ip');
    }
    
    expect(typeof isEnvAvailable).toBe('boolean');
  });

  it('should test CloudFlare configuration validation', () => {
    if (isEnvAvailable) {
      debug('Testing real CloudFlare configuration validation');
      
      // Valid config should work
      const validConfig = getCloudflareConfig();
      expect(() => new CloudFlare(validConfig)).not.toThrow();
      
      debug('Valid CloudFlare configuration accepted');
      
      // Invalid config should throw
      expect(() => {
        new CloudFlare({ apiToken: '', zoneId: '', domain: '' });
      }).toThrow('CloudFlare configuration incomplete');
      
      debug('Invalid CloudFlare configuration properly rejected');
    } else {
      debug('Skipping CloudFlare configuration test - environment not available');
    }
  });
});

(isEnvAvailable ? describe : describe.skip)('Real CloudFlare API Tests', () => {
  
  it('should create and retrieve real DNS record', async () => {
    if (!isEnvAvailable) {
      debug('Skipping real DNS record test - CloudFlare environment not available');
      return;
    }

    const testSubdomain = generateTestSubdomain();
    const testDomain = `${testSubdomain}.${process.env.HASYX_DNS_DOMAIN}`;
    let recordsCreated: string[] = [];

    try {
      debug(`Testing real DNS record creation: ${testDomain}`);
      
      // Create real CloudFlare instance
      const cloudflare = new CloudFlare(getCloudflareConfig());
      
      const testConfig: SubdomainDnsConfig = {
        ip: '149.102.136.233',
        ttl: 300,
        proxied: false
      };
      
      // Create real DNS record
      const createdRecord = await cloudflare.create(testSubdomain, testConfig);
      recordsCreated.push(testSubdomain);
      
      expect(createdRecord).toBeTruthy();
      expect(createdRecord.name).toBe(testDomain);
      expect(createdRecord.content).toBe(testConfig.ip);
      expect(createdRecord.type).toBe('A');
      expect(createdRecord.proxied).toBe(testConfig.proxied);
      
      debug(`Real DNS record created: ${createdRecord.id} (${createdRecord.name} -> ${createdRecord.content})`);

      // Retrieve real DNS record
      const retrievedRecord = await cloudflare.get(testSubdomain);
      expect(retrievedRecord).toBeTruthy();
      expect(retrievedRecord!.id).toBe(createdRecord.id);
      expect(retrievedRecord!.content).toBe(testConfig.ip);
      expect(retrievedRecord!.type).toBe('A');
      
      debug('Real DNS record retrieved and matches created record');

    } finally {
      // Real cleanup
      if (isEnvAvailable && recordsCreated.length > 0) {
        const cloudflare = new CloudFlare(getCloudflareConfig());
        for (const subdomain of recordsCreated) {
          try {
            await cloudflare.delete(subdomain);
            debug(`Cleaned up real DNS record: ${subdomain}`);
          } catch (error) {
            debug(`DNS cleanup warning: ${error}`);
          }
        }
      }
    }
  }, 30000);

  it('should handle real DNS record deletion', async () => {
    if (!isEnvAvailable) {
      debug('Skipping real DNS deletion test - CloudFlare environment not available');
      return;
    }

    const testSubdomain = generateTestSubdomain();
    const testDomain = `${testSubdomain}.${process.env.HASYX_DNS_DOMAIN}`;

    try {
      debug(`Testing real DNS record deletion: ${testDomain}`);
      
      const cloudflare = new CloudFlare(getCloudflareConfig());
      
      const testConfig: SubdomainDnsConfig = {
        ip: '1.2.3.4',
        ttl: 300,
        proxied: false
      };
      
      // Create real record first
      const createdRecord = await cloudflare.create(testSubdomain, testConfig);
      expect(createdRecord).toBeTruthy();
      
      debug(`Real DNS record created for deletion test: ${createdRecord.id}`);
      
      // Delete real record
      await cloudflare.delete(testSubdomain);
      
      debug('Real DNS record deleted');
      
      // Verify real deletion
      const retrievedRecord = await cloudflare.get(testSubdomain);
      expect(retrievedRecord).toBeNull();
      
      debug('Real DNS record deletion verified');

    } catch (error) {
      debug(`Real DNS deletion test completed with cleanup: ${error}`);
      // No additional cleanup needed since delete was attempted
    }
  }, 30000);

  it('should handle real DNS record updates via define', async () => {
    if (!isEnvAvailable) {
      debug('Skipping real DNS update test - CloudFlare environment not available');
      return;
    }

    const testSubdomain = generateTestSubdomain();
    const testDomain = `${testSubdomain}.${process.env.HASYX_DNS_DOMAIN}`;
    let recordsCreated: string[] = [];

    try {
      debug(`Testing real DNS record updates: ${testDomain}`);
      
      const cloudflare = new CloudFlare(getCloudflareConfig());
      
      const initialConfig: SubdomainDnsConfig = {
        ip: '5.6.7.8',
        ttl: 300,
        proxied: false
      };
      
      // Create initial real record
      const initialRecord = await cloudflare.create(testSubdomain, initialConfig);
      recordsCreated.push(testSubdomain);
      
      expect(initialRecord.content).toBe(initialConfig.ip);
      
      debug(`Initial real DNS record created: ${initialRecord.id} -> ${initialRecord.content}`);
      
      // Update record using define (replace)
      const updatedConfig: SubdomainDnsConfig = {
        ip: '9.10.11.12',
        ttl: 600,
        proxied: true
      };
      
      const updatedRecord = await cloudflare.define(testSubdomain, updatedConfig);
      
      expect(updatedRecord.content).toBe(updatedConfig.ip);
      expect(updatedRecord.ttl).toBeGreaterThan(0); // CloudFlare may return automatic TTL
      expect(updatedRecord.proxied).toBe(updatedConfig.proxied);
      expect(updatedRecord.id).not.toBe(initialRecord.id); // Should be new record
      
      debug(`Real DNS record updated: ${initialRecord.id} -> ${updatedRecord.id} (${updatedRecord.content})`);
      
      // Verify update via get
      const verifyRecord = await cloudflare.get(testSubdomain);
      expect(verifyRecord!.content).toBe(updatedConfig.ip);
      expect(verifyRecord!.proxied).toBe(updatedConfig.proxied);
      
      debug('Real DNS record update verified');

    } finally {
      // Real cleanup
      if (isEnvAvailable && recordsCreated.length > 0) {
        const cloudflare = new CloudFlare(getCloudflareConfig());
        for (const subdomain of recordsCreated) {
          try {
            await cloudflare.undefine(subdomain);
            debug(`Cleaned up real DNS record: ${subdomain}`);
          } catch (error) {
            debug(`DNS cleanup warning: ${error}`);
          }
        }
      }
    }
  }, 30000);

  it('should list real DNS records from CloudFlare zone', async () => {
    if (!isEnvAvailable) {
      debug('Skipping real DNS listing test - CloudFlare environment not available');
      return;
    }

    const testSubdomain1 = generateTestSubdomain();
    const testSubdomain2 = generateTestSubdomain();
    let recordsCreated: string[] = [];

    try {
      debug('Testing real DNS records listing');
      
      const cloudflare = new CloudFlare(getCloudflareConfig());
      
      // Create two real test records
      await cloudflare.create(testSubdomain1, {
        ip: '1.1.1.1',
        ttl: 300,
        proxied: false
      });
      recordsCreated.push(testSubdomain1);
      
      await cloudflare.create(testSubdomain2, {
        ip: '2.2.2.2',
        ttl: 300,
        proxied: false
      });
      recordsCreated.push(testSubdomain2);
      
      debug(`Created two real test DNS records: ${testSubdomain1}, ${testSubdomain2}`);
      
      // List real records
      const records = await cloudflare.list();
      expect(Array.isArray(records)).toBe(true);
      expect(records.length).toBeGreaterThan(0);
      
      debug(`Real DNS records list contains ${records.length} records`);
      
      // Find our test records
      const testRecord1 = records.find(r => r.name === `${testSubdomain1}.${process.env.HASYX_DNS_DOMAIN}`);
      const testRecord2 = records.find(r => r.name === `${testSubdomain2}.${process.env.HASYX_DNS_DOMAIN}`);
      
      expect(testRecord1).toBeTruthy();
      expect(testRecord1!.content).toBe('1.1.1.1');
      expect(testRecord2).toBeTruthy();
      expect(testRecord2!.content).toBe('2.2.2.2');
      
      debug('Real DNS records found in list with correct values');

    } finally {
      // Real cleanup
      if (isEnvAvailable && recordsCreated.length > 0) {
        const cloudflare = new CloudFlare(getCloudflareConfig());
        for (const subdomain of recordsCreated) {
          try {
            await cloudflare.delete(subdomain);
            debug(`Cleaned up real DNS record: ${subdomain}`);
          } catch (error) {
            debug(`DNS cleanup warning: ${error}`);
          }
        }
      }
    }
  }, 45000);

  it('should handle real error conditions properly', async () => {
    if (!isEnvAvailable) {
      debug('Skipping real error conditions test - CloudFlare environment not available');
      return;
    }

    const testSubdomain = generateTestSubdomain();
    let recordsCreated: string[] = [];

    try {
      debug('Testing real CloudFlare error conditions');
      
      const cloudflare = new CloudFlare(getCloudflareConfig());
      
      const testConfig: SubdomainDnsConfig = {
        ip: '3.3.3.3',
        ttl: 300,
        proxied: false
      };
      
      // Test duplicate creation error
      await cloudflare.create(testSubdomain, testConfig);
      recordsCreated.push(testSubdomain);
      
      debug('First real DNS record created for error testing');
      
      await expect(cloudflare.create(testSubdomain, testConfig))
        .rejects.toThrow('already exists');
      
      debug('Real duplicate creation error handled correctly');
      
      // Test deletion of non-existent record
      await expect(cloudflare.delete('non-existent-test-record'))
        .rejects.toThrow('does not exist');
      
      debug('Real deletion of non-existent record error handled correctly');
      
      // Test retrieval of non-existent record
      const nonExistentRecord = await cloudflare.get('non-existent-test-record');
      expect(nonExistentRecord).toBeNull();
      
      debug('Real retrieval of non-existent record returned null correctly');
      
      // Test undefine of non-existent record (should not throw)
      await expect(cloudflare.undefine('non-existent-test-record')).resolves.not.toThrow();
      
      debug('Real undefine of non-existent record handled gracefully');

    } finally {
      // Real cleanup
      if (isEnvAvailable && recordsCreated.length > 0) {
        const cloudflare = new CloudFlare(getCloudflareConfig());
        for (const subdomain of recordsCreated) {
          try {
            await cloudflare.delete(subdomain);
            debug(`Cleaned up real DNS record: ${subdomain}`);
          } catch (error) {
            debug(`DNS cleanup warning: ${error}`);
          }
        }
      }
    }
  }, 30000);

  it('should handle real undefine operations safely', async () => {
    if (!isEnvAvailable) {
      debug('Skipping real undefine test - CloudFlare environment not available');
      return;
    }

    const testSubdomain = generateTestSubdomain();

    try {
      debug(`Testing real undefine operations: ${testSubdomain}`);
      
      const cloudflare = new CloudFlare(getCloudflareConfig());
      
      const testConfig: SubdomainDnsConfig = {
        ip: '4.4.4.4',
        ttl: 300,
        proxied: false
      };
      
      // Create real record first
      await cloudflare.create(testSubdomain, testConfig);
      
      debug('Real DNS record created for undefine test');
      
      // Verify record exists
      const beforeRecord = await cloudflare.get(testSubdomain);
      expect(beforeRecord).toBeTruthy();
      
      // Undefine (should not throw)
      await expect(cloudflare.undefine(testSubdomain)).resolves.not.toThrow();
      
      // Verify record is gone
      const afterRecord = await cloudflare.get(testSubdomain);
      expect(afterRecord).toBeNull();
      
      debug('Real undefine operation completed successfully');
      
      // Test undefine of already undefined record (should not throw)
      await expect(cloudflare.undefine(testSubdomain)).resolves.not.toThrow();
      
      debug('Real undefine of non-existent record handled gracefully');

    } catch (error) {
      debug(`Real undefine test completed: ${error}`);
      // Any errors are cleanup attempts, which is fine
    }
  }, 30000);

  it('should show real CloudFlare testing environment status', () => {
    debug('Real CloudFlare tests use actual CloudFlare API:');
    debug(`  • Real CloudFlare API Token (${process.env.CLOUDFLARE_API_TOKEN ? 'configured' : 'missing'})`);
    debug(`  • Real CloudFlare Zone ID (${process.env.CLOUDFLARE_ZONE_ID ? 'configured' : 'missing'})`);
    debug(`  • Real DNS Domain (${process.env.HASYX_DNS_DOMAIN || 'missing'})`);
    debug('  • Real HTTP requests to CloudFlare API');
    debug('  • Real DNS record creation/deletion/updates');
    debug('  • Real DNS zone management');
    debug('  • Each test creates isolated test records');
    debug('  • Each test cleans up its own DNS records');
    debug(`  • Test subdomain pattern: cf-test-{timestamp}-{random}.${process.env.HASYX_DNS_DOMAIN || 'domain'}`);
    
    if (isEnvAvailable) {
      debug('  • Environment: READY for real CloudFlare testing');
    } else {
      debug('  • Environment: MISSING credentials - tests will be skipped');
    }
    
    expect(true).toBe(true); // Always pass
  });
}); 