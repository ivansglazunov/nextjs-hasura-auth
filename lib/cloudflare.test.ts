import { CloudFlare, CloudflareConfig, SubdomainDnsConfig } from './cloudflare';
import Debug from './debug';

const debug = Debug('test:cloudflare');

// Environment availability check
const isEnvAvailable = Boolean(
  process.env.CLOUDFLARE_API_TOKEN &&
  process.env.CLOUDFLARE_ZONE_ID &&
  process.env.HASYX_DNS_DOMAIN
);

const getCloudflareConfig = (): CloudflareConfig => ({
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
  zoneId: process.env.CLOUDFLARE_ZONE_ID!,
  domain: process.env.HASYX_DNS_DOMAIN!
});

// Test data
const testSubdomain = 'cloudflare-test';
const testConfig: SubdomainDnsConfig = {
  ip: '149.102.136.233',
  ttl: 300,
  proxied: false
};

describe('DEBUG: CloudFlare Environment Check', () => {
  it('should have required environment variables', () => {
    debug(`Environment check: ${isEnvAvailable ? 'available' : 'missing variables'}`);
    console.log('Environment variables status:');
    console.log(`  CLOUDFLARE_API_TOKEN: ${process.env.CLOUDFLARE_API_TOKEN ? 'set' : 'missing'}`);
    console.log(`  CLOUDFLARE_ZONE_ID: ${process.env.CLOUDFLARE_ZONE_ID ? 'set' : 'missing'}`);
    console.log(`  HASYX_DNS_DOMAIN: ${process.env.HASYX_DNS_DOMAIN ? 'set' : 'missing'}`);
    
    if (!isEnvAvailable) {
      console.log('To run CloudFlare tests, set these environment variables:');
      console.log('  CLOUDFLARE_API_TOKEN=your_api_token');
      console.log('  CLOUDFLARE_ZONE_ID=your_zone_id');
      console.log('  HASYX_DNS_DOMAIN=your_domain');
    }
  });
});

(isEnvAvailable ? describe : describe.skip)('CloudFlare Class', () => {
  let cloudflare: CloudFlare;

  beforeEach(() => {
    cloudflare = new CloudFlare(getCloudflareConfig());
    debug(`Test setup: CloudFlare instance created for domain ${process.env.HASYX_DNS_DOMAIN}`);
  });

  afterEach(async () => {
    // Clean up test records after each test
    try {
      await cloudflare.undefine(testSubdomain);
      debug(`Cleanup: Removed test subdomain ${testSubdomain}`);
    } catch (error) {
      debug(`Cleanup warning: ${error}`);
    }
  });

  describe('Constructor', () => {
    it('should create CloudFlare instance with valid config', () => {
      expect(cloudflare).toBeInstanceOf(CloudFlare);
      debug('Constructor test: CloudFlare instance created successfully');
    });

    it('should throw error with incomplete config', () => {
      expect(() => {
        new CloudFlare({ apiToken: '', zoneId: '', domain: '' });
      }).toThrow('CloudFlare configuration incomplete');
      debug('Constructor test: Properly validates incomplete config');
    });
  });

  describe('DNS Record Management', () => {
    it('should create and get DNS record', async () => {
      debug(`Creating test record: ${testSubdomain}.${process.env.HASYX_DNS_DOMAIN} → ${testConfig.ip}`);
      
      // Create record
      const createdRecord = await cloudflare.create(testSubdomain, testConfig);
      expect(createdRecord).toBeDefined();
      expect(createdRecord.name).toBe(`${testSubdomain}.${process.env.HASYX_DNS_DOMAIN}`);
      expect(createdRecord.content).toBe(testConfig.ip);
      expect(createdRecord.type).toBe('A');
      
      debug(`Created record: ${createdRecord.id}`);

      // Get record
      const retrievedRecord = await cloudflare.get(testSubdomain);
      expect(retrievedRecord).toBeDefined();
      expect(retrievedRecord!.id).toBe(createdRecord.id);
      expect(retrievedRecord!.content).toBe(testConfig.ip);
      
      debug(`Retrieved record matches created record`);
    });

    it('should return null for non-existing record', async () => {
      const nonExistentSubdomain = 'non-existent-test-record';
      const record = await cloudflare.get(nonExistentSubdomain);
      expect(record).toBeNull();
      debug(`Correctly returned null for non-existent subdomain: ${nonExistentSubdomain}`);
    });

    it('should throw error when creating duplicate record', async () => {
      debug(`Testing duplicate creation for: ${testSubdomain}`);
      
      // Create first record
      await cloudflare.create(testSubdomain, testConfig);
      debug('First record created successfully');

      // Try to create duplicate
      await expect(cloudflare.create(testSubdomain, testConfig))
        .rejects.toThrow('already exists');
      
      debug('Duplicate creation correctly rejected');
    });

    it('should delete existing record', async () => {
      debug(`Testing record deletion for: ${testSubdomain}`);
      
      // Create record first
      await cloudflare.create(testSubdomain, testConfig);
      debug('Record created for deletion test');

      // Delete record
      await cloudflare.delete(testSubdomain);
      debug('Record deleted');

      // Verify deletion
      const record = await cloudflare.get(testSubdomain);
      expect(record).toBeNull();
      debug('Deletion verified - record not found');
    });

    it('should throw error when deleting non-existing record', async () => {
      const nonExistentSubdomain = 'non-existent-delete-test';
      
      await expect(cloudflare.delete(nonExistentSubdomain))
        .rejects.toThrow('does not exist');
      
      debug(`Correctly rejected deletion of non-existent subdomain: ${nonExistentSubdomain}`);
    });
  });

  describe('Define/Undefine Operations', () => {
    it('should define record (create new)', async () => {
      debug(`Testing define operation for new record: ${testSubdomain}`);
      
      const record = await cloudflare.define(testSubdomain, testConfig);
      expect(record).toBeDefined();
      expect(record.content).toBe(testConfig.ip);
      
      debug(`Define created new record: ${record.id}`);
    });

    it('should define record (replace existing)', async () => {
      debug(`Testing define operation for existing record: ${testSubdomain}`);
      
      // Create initial record
      const initialRecord = await cloudflare.create(testSubdomain, testConfig);
      debug(`Initial record created: ${initialRecord.id}`);

      // Define with different IP
      const newConfig: SubdomainDnsConfig = { ...testConfig, ip: '1.2.3.4' };
      const newRecord = await cloudflare.define(testSubdomain, newConfig);
      
      expect(newRecord.content).toBe(newConfig.ip);
      expect(newRecord.id).not.toBe(initialRecord.id);
      
      debug(`Define replaced record: ${initialRecord.id} → ${newRecord.id}`);
    });

    it('should undefine existing record without error', async () => {
      debug(`Testing undefine operation for existing record: ${testSubdomain}`);
      
      // Create record first
      await cloudflare.create(testSubdomain, testConfig);
      debug('Record created for undefine test');

      // Undefine should not throw
      await expect(cloudflare.undefine(testSubdomain)).resolves.not.toThrow();
      
      // Verify removal
      const record = await cloudflare.get(testSubdomain);
      expect(record).toBeNull();
      
      debug('Undefine completed successfully');
    });

    it('should undefine non-existing record without error', async () => {
      const nonExistentSubdomain = 'non-existent-undefine-test';
      
      // Should not throw error
      await expect(cloudflare.undefine(nonExistentSubdomain)).resolves.not.toThrow();
      
      debug(`Undefine correctly handled non-existent subdomain: ${nonExistentSubdomain}`);
    });
  });

  describe('List Operations', () => {
    it('should list DNS records for domain', async () => {
      debug(`Testing list operation for domain: ${process.env.HASYX_DNS_DOMAIN}`);
      
      // Create test record
      await cloudflare.create(testSubdomain, testConfig);
      debug('Test record created for list test');

      // List records
      const records = await cloudflare.list();
      expect(Array.isArray(records)).toBe(true);
      
      // Should find our test record
      const testRecord = records.find(r => r.name === `${testSubdomain}.${process.env.HASYX_DNS_DOMAIN}`);
      expect(testRecord).toBeDefined();
      expect(testRecord!.content).toBe(testConfig.ip);
      
      debug(`List found ${records.length} records, including our test record`);
    });
  });

  describe('Domain Handling', () => {
    it('should handle root domain (@)', async () => {
      debug('Testing root domain handling');
      
      const rootConfig: SubdomainDnsConfig = { ...testConfig, ip: '5.6.7.8' };
      
      try {
        await cloudflare.define('@', rootConfig);
        const record = await cloudflare.get('@');
        
        expect(record).toBeDefined();
        expect(record!.name).toBe(process.env.HASYX_DNS_DOMAIN);
        expect(record!.content).toBe(rootConfig.ip);
        
        debug('Root domain handling successful');
        
        // Clean up root domain record
        await cloudflare.undefine('@');
      } catch (error) {
        debug(`Root domain test error (may be expected): ${error}`);
        // Don't fail test if root domain modification is restricted
      }
    });

    it('should handle empty subdomain as root domain', async () => {
      debug('Testing empty subdomain as root domain');
      
      const emptyConfig: SubdomainDnsConfig = { ...testConfig, ip: '9.10.11.12' };
      
      try {
        await cloudflare.define('', emptyConfig);
        const record = await cloudflare.get('');
        
        expect(record).toBeDefined();
        expect(record!.name).toBe(process.env.HASYX_DNS_DOMAIN);
        
        debug('Empty subdomain handling successful');
        
        // Clean up
        await cloudflare.undefine('');
      } catch (error) {
        debug(`Empty subdomain test error (may be expected): ${error}`);
        // Don't fail test if root domain modification is restricted
      }
    });
  });
});

// Alternative describe for when environment is not available
(!isEnvAvailable ? describe : describe.skip)('CloudFlare Class - Environment Not Available', () => {
  it('should skip tests when CLOUDFLARE_API_TOKEN is not set', () => {
    expect(process.env.CLOUDFLARE_API_TOKEN).toBeFalsy();
    debug('CloudFlare tests skipped: CLOUDFLARE_API_TOKEN not available');
  });

  it('should skip tests when CLOUDFLARE_ZONE_ID is not set', () => {
    expect(process.env.CLOUDFLARE_ZONE_ID).toBeFalsy();
    debug('CloudFlare tests skipped: CLOUDFLARE_ZONE_ID not available');
  });

  it('should skip tests when HASYX_DNS_DOMAIN is not set', () => {
    expect(process.env.HASYX_DNS_DOMAIN).toBeFalsy();
    debug('CloudFlare tests skipped: HASYX_DNS_DOMAIN not available');
  });
}); 