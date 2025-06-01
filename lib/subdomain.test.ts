import { SubdomainManager, SubdomainManagerConfig, SubdomainConfig, SubdomainInfo } from './subdomain';
import { CloudFlare, DnsRecord } from './cloudflare';
import { SSL, CertificateInfo } from './ssl';
import { Nginx, SiteConfig } from './nginx';
import Debug from './debug';

const debug = Debug('test:subdomain');

// Mock implementations
class MockCloudFlare {
  public domain = 'test.example.com';
  public records: Map<string, DnsRecord> = new Map();
  public recordIdCounter = 1;

  async get(subdomain: string): Promise<DnsRecord | null> {
    const fullDomain = subdomain === '@' ? this.domain : `${subdomain}.${this.domain}`;
    const record = this.records.get(fullDomain);
    debug(`Mock CloudFlare get: ${subdomain} -> ${record ? 'found' : 'not found'}`);
    return record || null;
  }

  async list(): Promise<DnsRecord[]> {
    const records = Array.from(this.records.values());
    debug(`Mock CloudFlare list: ${records.length} records`);
    return records;
  }

  async create(subdomain: string, config: any): Promise<DnsRecord> {
    const fullDomain = subdomain === '@' ? this.domain : `${subdomain}.${this.domain}`;
    
    if (this.records.has(fullDomain)) {
      throw new Error(`DNS record for ${fullDomain} already exists`);
    }

    const record: DnsRecord = {
      id: `record_${this.recordIdCounter++}`,
      name: fullDomain,
      content: config.ip,
      type: 'A',
      ttl: config.ttl || 300,
      proxied: config.proxied || false
    };

    this.records.set(fullDomain, record);
    debug(`Mock CloudFlare created: ${fullDomain} -> ${config.ip}`);
    return record;
  }

  async delete(subdomain: string): Promise<void> {
    const fullDomain = subdomain === '@' ? this.domain : `${subdomain}.${this.domain}`;
    
    if (!this.records.has(fullDomain)) {
      throw new Error(`DNS record for ${fullDomain} does not exist`);
    }

    this.records.delete(fullDomain);
    debug(`Mock CloudFlare deleted: ${fullDomain}`);
  }

  async define(subdomain: string, config: any): Promise<DnsRecord> {
    try {
      await this.undefine(subdomain);
    } catch (error) {
      // Ignore errors for non-existing records
    }
    return await this.create(subdomain, config);
  }

  async undefine(subdomain: string): Promise<void> {
    try {
      await this.delete(subdomain);
    } catch (error) {
      // Do not throw error - this is expected behavior for undefine
    }
  }
}

class MockSSL {
  public certificates: Map<string, CertificateInfo> = new Map();
  public propagationDelay = 0; // For testing

  async get(domain: string): Promise<CertificateInfo | null> {
    const cert = this.certificates.get(domain);
    debug(`Mock SSL get: ${domain} -> ${cert ? 'found' : 'not found'}`);
    return cert || null;
  }

  async create(domain: string, email?: string): Promise<void> {
    if (this.certificates.has(domain)) {
      throw new Error(`SSL certificate for ${domain} already exists`);
    }

    const cert: CertificateInfo = {
      exists: true,
      domain,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
      daysLeft: 90,
      path: {
        certificate: `/etc/letsencrypt/live/${domain}/cert.pem`,
        privateKey: `/etc/letsencrypt/live/${domain}/privkey.pem`,
        fullchain: `/etc/letsencrypt/live/${domain}/fullchain.pem`
      }
    };

    this.certificates.set(domain, cert);
    debug(`Mock SSL created: ${domain}`);
  }

  async delete(domain: string): Promise<void> {
    if (!this.certificates.has(domain)) {
      throw new Error(`SSL certificate for ${domain} does not exist`);
    }

    this.certificates.delete(domain);
    debug(`Mock SSL deleted: ${domain}`);
  }

  async define(domain: string, email?: string): Promise<void> {
    try {
      await this.undefine(domain);
    } catch (error) {
      // Ignore errors for non-existing certificates
    }
    await this.create(domain, email);
  }

  async undefine(domain: string): Promise<void> {
    try {
      await this.delete(domain);
    } catch (error) {
      // Do not throw error - this is expected behavior for undefine
    }
  }

  async wait(domain: string, ip: string, maxAttempts?: number): Promise<any> {
    debug(`Mock SSL wait: ${domain} -> ${ip}`);
    
    if (this.propagationDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.propagationDelay));
    }

    return {
      domain,
      expectedIp: ip,
      actualIp: ip,
      propagated: true,
      attempts: 1
    };
  }

  async check(domain: string): Promise<CertificateInfo> {
    const cert = await this.get(domain);
    if (!cert) {
      return { exists: false, domain };
    }
    return cert;
  }
}

class MockNginx {
  public sites: Map<string, SiteConfig> = new Map();
  public enabledSites: Set<string> = new Set();

  async get(siteName: string): Promise<SiteConfig | null> {
    const site = this.sites.get(siteName);
    debug(`Mock Nginx get: ${siteName} -> ${site ? 'found' : 'not found'}`);
    return site || null;
  }

  async list(): Promise<string[]> {
    const sites = Array.from(this.sites.keys());
    debug(`Mock Nginx list: ${sites.length} sites`);
    return sites;
  }

  async create(siteName: string, config: SiteConfig): Promise<void> {
    if (this.sites.has(siteName)) {
      throw new Error(`Site ${siteName} already exists`);
    }

    this.sites.set(siteName, config);
    this.enabledSites.add(siteName); // Auto-enable when created
    debug(`Mock Nginx created: ${siteName}`);
  }

  async delete(siteName: string): Promise<void> {
    if (!this.sites.has(siteName)) {
      throw new Error(`Site ${siteName} does not exist`);
    }

    this.sites.delete(siteName);
    this.enabledSites.delete(siteName);
    debug(`Mock Nginx deleted: ${siteName}`);
  }

  async define(siteName: string, config: SiteConfig): Promise<void> {
    try {
      await this.undefine(siteName);
    } catch (error) {
      // Ignore errors for non-existing sites
    }
    await this.create(siteName, config);
  }

  async undefine(siteName: string): Promise<void> {
    try {
      await this.delete(siteName);
    } catch (error) {
      // Do not throw error - this is expected behavior for undefine
    }
  }

  async isEnabled(siteName: string): Promise<boolean> {
    const enabled = this.enabledSites.has(siteName);
    debug(`Mock Nginx isEnabled: ${siteName} -> ${enabled}`);
    return enabled;
  }

  async enable(siteName: string): Promise<void> {
    if (!this.sites.has(siteName)) {
      throw new Error(`Site ${siteName} does not exist`);
    }
    this.enabledSites.add(siteName);
    debug(`Mock Nginx enabled: ${siteName}`);
  }

  async disable(siteName: string): Promise<void> {
    this.enabledSites.delete(siteName);
    debug(`Mock Nginx disabled: ${siteName}`);
  }

  // Add missing methods that SubdomainManager expects
  testNginxConfig(): void {
    debug('Mock Nginx testNginxConfig called');
    // Simulate successful config test
  }

  reloadNginx(): void {
    debug('Mock Nginx reloadNginx called');
    // Simulate successful reload
  }
}

describe('SubdomainManager', () => {
  let subdomainManager: SubdomainManager;
  let mockCloudflare: MockCloudFlare;
  let mockSSL: MockSSL;
  let mockNginx: MockNginx;

  beforeEach(() => {
    // Create fresh mock instances for each test
    mockCloudflare = new MockCloudFlare();
    mockSSL = new MockSSL();
    mockNginx = new MockNginx();

    // Create SubdomainManager with mocked dependencies
    const config: SubdomainManagerConfig = {
      cloudflare: mockCloudflare as any,
      ssl: mockSSL as any,
      nginx: mockNginx as any
    };

    subdomainManager = new SubdomainManager(config);
    debug('Test setup: SubdomainManager created with mocked dependencies');
  });

  afterEach(() => {
    // Clear all mock data
    mockCloudflare.records.clear();
    mockSSL.certificates.clear();
    mockNginx.sites.clear();
    mockNginx.enabledSites.clear();
    debug('Cleanup: All mock data cleared');
  });

  describe('Constructor and Basic Methods', () => {
    it('should create SubdomainManager with correct domain', () => {
      expect(subdomainManager).toBeInstanceOf(SubdomainManager);
      expect(subdomainManager.domain).toBe('test.example.com');
      debug('Constructor test: SubdomainManager created successfully');
    });

    it('should generate correct full domain names', () => {
      expect(subdomainManager.getFullDomain('app')).toBe('app.test.example.com');
      expect(subdomainManager.getFullDomain('@')).toBe('test.example.com');
      expect(subdomainManager.getFullDomain('')).toBe('test.example.com');
      debug('Full domain generation test passed');
    });

    it('should validate subdomain names correctly', () => {
      // Valid names
      expect(() => subdomainManager.validateSubdomainName('app')).not.toThrow();
      expect(() => subdomainManager.validateSubdomainName('my-app')).not.toThrow();
      expect(() => subdomainManager.validateSubdomainName('app123')).not.toThrow();

      // Invalid names
      expect(() => subdomainManager.validateSubdomainName('')).toThrow();
      expect(() => subdomainManager.validateSubdomainName('-app')).toThrow();
      expect(() => subdomainManager.validateSubdomainName('app-')).toThrow();
      expect(() => subdomainManager.validateSubdomainName('app.test')).toThrow();

      debug('Subdomain name validation test passed');
    });
  });

  describe('Subdomain Information', () => {
    it('should get subdomain info for non-existing subdomain', async () => {
      const info = await subdomainManager.getSubdomainInfo('nonexistent');
      
      expect(info.subdomain).toBe('nonexistent');
      expect(info.fullDomain).toBe('nonexistent.test.example.com');
      expect(info.cloudflareStatus.exists).toBe(false);
      expect(info.sslStatus.exists).toBe(false);
      expect(info.nginxStatus.exists).toBe(false);
      expect(info.fullyActive).toBe(false);
      
      debug('Non-existing subdomain info test passed');
    });

    it('should get subdomain info for partially configured subdomain', async () => {
      // Create only DNS record
      await mockCloudflare.create('partial', { ip: '1.2.3.4', ttl: 300 });
      
      const info = await subdomainManager.getSubdomainInfo('partial');
      
      expect(info.cloudflareStatus.exists).toBe(true);
      expect(info.sslStatus.exists).toBe(false);
      expect(info.nginxStatus.exists).toBe(false);
      expect(info.fullyActive).toBe(false);
      
      debug('Partially configured subdomain info test passed');
    });

    it('should get subdomain info for fully configured subdomain', async () => {
      const subdomain = 'full';
      const fullDomain = 'full.test.example.com';
      
      // Create all components
      await mockCloudflare.create(subdomain, { ip: '1.2.3.4', ttl: 300 });
      await mockSSL.create(fullDomain, 'test@example.com');
      await mockNginx.create(fullDomain, {
        serverName: fullDomain,
        proxyPass: 'http://127.0.0.1:3000',
        ssl: true
      });
      
      const info = await subdomainManager.getSubdomainInfo(subdomain);
      
      expect(info.cloudflareStatus.exists).toBe(true);
      expect(info.sslStatus.exists).toBe(true);
      expect(info.nginxStatus.exists).toBe(true);
      expect(info.nginxStatus.enabled).toBe(true);
      expect(info.fullyActive).toBe(true);
      expect(info.ip).toBe('1.2.3.4');
      expect(info.port).toBe(3000);
      
      debug('Fully configured subdomain info test passed');
    });
  });

  describe('Define Subdomain', () => {
    it('should define complete subdomain successfully', async () => {
      const config: SubdomainConfig = {
        ip: '1.2.3.4',
        port: 3000,
        email: 'test@example.com'
      };

      const result = await subdomainManager.define('testapp', config);
      
      expect(result.subdomain).toBe('testapp');
      expect(result.fullyActive).toBe(true);
      expect(result.cloudflareStatus.exists).toBe(true);
      expect(result.sslStatus.exists).toBe(true);
      expect(result.nginxStatus.exists).toBe(true);
      expect(result.nginxStatus.enabled).toBe(true);
      
      // Verify all components were created
      expect(await mockCloudflare.get('testapp')).toBeTruthy();
      expect(await mockSSL.get('testapp.test.example.com')).toBeTruthy();
      expect(await mockNginx.get('testapp.test.example.com')).toBeTruthy();
      
      debug('Complete subdomain definition test passed');
    });

    it('should replace existing subdomain with define', async () => {
      const config1: SubdomainConfig = {
        ip: '1.2.3.4',
        port: 3000,
        email: 'test@example.com'
      };

      const config2: SubdomainConfig = {
        ip: '5.6.7.8',
        port: 4000,
        email: 'test@example.com'
      };

      // Create first subdomain
      await subdomainManager.define('replace', config1);
      
      // Verify first configuration
      let info = await subdomainManager.getSubdomainInfo('replace');
      expect(info.ip).toBe('1.2.3.4');
      
      // Replace with second configuration
      await subdomainManager.define('replace', config2);
      
      // Verify replacement
      info = await subdomainManager.getSubdomainInfo('replace');
      expect(info.ip).toBe('5.6.7.8');
      expect(info.fullyActive).toBe(true);
      
      debug('Subdomain replacement test passed');
    });

    it('should handle errors during subdomain definition', async () => {
      // Make SSL creation fail
      const originalCreate = mockSSL.create;
      mockSSL.create = async () => {
        throw new Error('SSL creation failed');
      };

      const config: SubdomainConfig = {
        ip: '1.2.3.4',
        port: 3000,
        email: 'test@example.com'
      };

      await expect(subdomainManager.define('failing', config))
        .rejects.toThrow('SSL creation failed');
      
      // Verify cleanup happened (DNS should be removed)
      expect(await mockCloudflare.get('failing')).toBeNull();
      
      // Restore original method
      mockSSL.create = originalCreate;
      
      debug('Error handling during definition test passed');
    });

    it('should validate subdomain name before definition', async () => {
      const config: SubdomainConfig = {
        ip: '1.2.3.4',
        port: 3000,
        email: 'test@example.com'
      };

      await expect(subdomainManager.define('', config))
        .rejects.toThrow('Subdomain name cannot be empty');
      
      await expect(subdomainManager.define('-invalid', config))
        .rejects.toThrow('Invalid subdomain name');
      
      debug('Subdomain name validation test passed');
    });
  });

  describe('Undefine Subdomain', () => {
    it('should undefine existing subdomain successfully', async () => {
      const config: SubdomainConfig = {
        ip: '1.2.3.4',
        port: 3000,
        email: 'test@example.com'
      };

      // Create subdomain first
      await subdomainManager.define('toundefine', config);
      
      // Verify it exists
      let info = await subdomainManager.getSubdomainInfo('toundefine');
      expect(info.fullyActive).toBe(true);
      
      // Undefine it
      await subdomainManager.undefine('toundefine');
      
      // Verify removal
      info = await subdomainManager.getSubdomainInfo('toundefine');
      expect(info.fullyActive).toBe(false);
      expect(info.cloudflareStatus.exists).toBe(false);
      expect(info.sslStatus.exists).toBe(false);
      expect(info.nginxStatus.exists).toBe(false);
      
      debug('Subdomain undefine test passed');
    });

    it('should undefine non-existing subdomain without error', async () => {
      await expect(subdomainManager.undefine('nonexistent'))
        .resolves.not.toThrow();
      
      debug('Non-existing subdomain undefine test passed');
    });

    it('should handle partial failures during undefine gracefully', async () => {
      const config: SubdomainConfig = {
        ip: '1.2.3.4',
        port: 3000,
        email: 'test@example.com'
      };

      // Create subdomain
      await subdomainManager.define('partial-fail', config);
      
      // Make nginx deletion fail
      const originalDelete = mockNginx.delete;
      mockNginx.delete = async () => {
        throw new Error('Nginx deletion failed');
      };

      // Undefine should not throw but may log warnings
      await expect(subdomainManager.undefine('partial-fail'))
        .resolves.not.toThrow();
      
      // Verify other components were still removed
      expect(await mockCloudflare.get('partial-fail')).toBeNull();
      expect(await mockSSL.get('partial-fail.test.example.com')).toBeNull();
      
      // Restore original method
      mockNginx.delete = originalDelete;
      
      debug('Partial failure during undefine test passed');
    });
  });

  describe('List Subdomains', () => {
    it('should list only fully active subdomains', async () => {
      const config: SubdomainConfig = {
        ip: '1.2.3.4',
        port: 3000,
        email: 'test@example.com'
      };

      // Create one fully active subdomain
      await subdomainManager.define('active1', config);
      await subdomainManager.define('active2', { ...config, port: 4000 });
      
      // Create partially configured subdomain (only DNS)
      await mockCloudflare.create('partial', { ip: '1.2.3.4', ttl: 300 });
      
      const list = await subdomainManager.list();
      
      expect(list).toHaveLength(2);
      expect(list.map(s => s.subdomain).sort()).toEqual(['active1', 'active2']);
      expect(list.every(s => s.fullyActive)).toBe(true);
      
      debug('List fully active subdomains test passed');
    });

    it('should return empty list when no subdomains exist', async () => {
      const list = await subdomainManager.list();
      
      expect(list).toHaveLength(0);
      expect(Array.isArray(list)).toBe(true);
      
      debug('Empty list test passed');
    });

    it('should handle DNS records from other domains', async () => {
      // Add a record that doesn't belong to our domain
      mockCloudflare.records.set('other.domain.com', {
        id: 'other1',
        name: 'other.domain.com',
        content: '1.2.3.4',
        type: 'A',
        ttl: 300,
        proxied: false
      });

      // Add a valid subdomain
      const config: SubdomainConfig = {
        ip: '1.2.3.4',
        port: 3000,
        email: 'test@example.com'
      };
      await subdomainManager.define('valid', config);

      const list = await subdomainManager.list();
      
      expect(list).toHaveLength(1);
      expect(list[0].subdomain).toBe('valid');
      
      debug('Foreign domain filtering test passed');
    });
  });

  describe('Nginx Integration', () => {
    it('should access nginx methods through reinitializeNginx', async () => {
      // Mock the private methods by adding them to the mockNginx
      let testConfigCalled = false;
      let reloadCalled = false;
      
      (mockNginx as any).testNginxConfig = () => {
        testConfigCalled = true;
        debug('Mock testNginxConfig called');
      };
      (mockNginx as any).reloadNginx = () => {
        reloadCalled = true;
        debug('Mock reloadNginx called');
      };
      
      await expect(subdomainManager.reinitializeNginx())
        .resolves.not.toThrow();
      
      expect(testConfigCalled).toBe(true);
      expect(reloadCalled).toBe(true);
      
      debug('Nginx reinitialization test passed');
    });

    it('should handle nginx reinitialization errors', async () => {
      // Mock failing nginx methods
      (mockNginx as any).testNginxConfig = () => {
        throw new Error('Nginx test failed');
      };
      
      await expect(subdomainManager.reinitializeNginx())
        .rejects.toThrow('Failed to reinitialize nginx');
      
      debug('Nginx reinitialization error handling test passed');
    });
  });
});

describe('DEBUG: SubdomainManager Environment', () => {
  it('should show mock environment status', () => {
    console.log('SubdomainManager tests run with mocked dependencies:');
    console.log('  • MockCloudFlare - simulates DNS record management');
    console.log('  • MockSSL - simulates SSL certificate management');  
    console.log('  • MockNginx - simulates nginx configuration management');
    console.log('  • All tests run in isolation without external dependencies');
    
    debug('Mock environment status displayed');
  });
}); 