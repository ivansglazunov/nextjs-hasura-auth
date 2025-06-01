import { Nginx, NginxConfig, SiteConfig } from './nginx';
import Debug from './debug';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const debug = Debug('test:nginx');

// Environment availability check
const isNginxAvailable = (() => {
  try {
    execSync('nginx -v', { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
})();

// Test configuration
const testSiteName = 'nginx-test-site';
const testConfig: SiteConfig = {
  serverName: 'test.example.com',
  listen: 8080,
  proxyPass: 'http://localhost:3000',
};

const testConfigSSL: SiteConfig = {
  serverName: 'hasyx-ssl-test.deep.foundation',
  ssl: true,
  sslCertificate: '/etc/ssl/certs/test.crt',
  sslCertificateKey: '/etc/ssl/private/test.key',
  proxyPass: 'http://localhost:3000',
};

// Test directories
const testDir = '/tmp/nginx-test';
const testSitesAvailable = path.join(testDir, 'sites-available');
const testSitesEnabled = path.join(testDir, 'sites-enabled');

describe('DEBUG: Nginx Environment Check', () => {
  it('should check nginx availability', () => {
    debug(`Nginx availability: ${isNginxAvailable ? 'available' : 'not available'}`);
    console.log(`Nginx is ${isNginxAvailable ? 'available' : 'not available'} on this system`);
    
    if (!isNginxAvailable) {
      console.log('To run Nginx tests with real nginx commands, install nginx:');
      console.log('  Ubuntu/Debian: sudo apt install nginx');
      console.log('  CentOS/RHEL: sudo yum install nginx');
      console.log('  macOS: brew install nginx');
    }
  });
});

describe('Nginx Class', () => {
  let nginx: Nginx;

  beforeEach(() => {
    // Create test directories
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(testSitesAvailable, { recursive: true });
    fs.mkdirSync(testSitesEnabled, { recursive: true });

    // Initialize nginx with test paths
    const config: NginxConfig = {
      sitesAvailablePath: testSitesAvailable,
      sitesEnabledPath: testSitesEnabled,
    };
    
    nginx = new Nginx(config);
    debug(`Test setup: Nginx instance created with test directories`);
  });

  afterEach(() => {
    // Clean up test directories
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
      debug(`Cleanup: Removed test directory ${testDir}`);
    }
  });

  describe('Constructor and Path Detection', () => {
    it('should create Nginx instance with custom paths', () => {
      expect(nginx).toBeInstanceOf(Nginx);
      debug('Constructor test: Nginx instance created successfully with custom paths');
    });

    it('should auto-detect nginx paths when not provided', () => {
      // This test will use the auto-detection logic
      const autoNginx = new Nginx();
      expect(autoNginx).toBeInstanceOf(Nginx);
      debug('Constructor test: Nginx instance created with auto-detected paths');
    });

    it('should create directories if they do not exist', () => {
      const newTestDir = '/tmp/nginx-test-new';
      const newSitesAvailable = path.join(newTestDir, 'sites-available');
      const newSitesEnabled = path.join(newTestDir, 'sites-enabled');

      try {
        const config: NginxConfig = {
          sitesAvailablePath: newSitesAvailable,
          sitesEnabledPath: newSitesEnabled,
        };
        
        const newNginx = new Nginx(config);
        expect(newNginx).toBeInstanceOf(Nginx);
        expect(fs.existsSync(newSitesAvailable)).toBe(true);
        expect(fs.existsSync(newSitesEnabled)).toBe(true);
        
        debug('Constructor test: Directories created automatically');
        
        // Cleanup
        fs.rmSync(newTestDir, { recursive: true, force: true });
      } catch (error) {
        debug(`Constructor test error: ${error}`);
        throw error;
      }
    });
  });

  describe('Site Management', () => {
    it('should create and get site configuration', async () => {
      debug(`Creating test site: ${testSiteName}`);
      
      // Create site
      await nginx.create(testSiteName, testConfig);
      
      // Verify file exists
      const configPath = path.join(testSitesAvailable, testSiteName);
      expect(fs.existsSync(configPath)).toBe(true);
      debug(`Site configuration file created: ${configPath}`);

      // Get site configuration
      const retrievedConfig = await nginx.get(testSiteName);
      expect(retrievedConfig).toBeDefined();
      expect(retrievedConfig!.serverName).toBe(testConfig.serverName);
      expect(retrievedConfig!.listen).toBe(testConfig.listen);
      expect(retrievedConfig!.proxyPass).toBe(testConfig.proxyPass);
      
      debug(`Retrieved site configuration matches created configuration`);
    });

    it('should return null for non-existing site', async () => {
      const nonExistentSite = 'non-existent-site';
      const config = await nginx.get(nonExistentSite);
      expect(config).toBeNull();
      debug(`Correctly returned null for non-existent site: ${nonExistentSite}`);
    });

    it('should throw error when creating duplicate site', async () => {
      debug(`Testing duplicate creation for: ${testSiteName}`);
      
      // Create first site
      await nginx.create(testSiteName, testConfig);
      debug('First site created successfully');

      // Try to create duplicate
      await expect(nginx.create(testSiteName, testConfig))
        .rejects.toThrow('already exists');
      
      debug('Duplicate creation correctly rejected');
    });

    it('should delete existing site', async () => {
      debug(`Testing site deletion for: ${testSiteName}`);
      
      // Create site first
      await nginx.create(testSiteName, testConfig);
      debug('Site created for deletion test');

      // Delete site
      await nginx.delete(testSiteName);
      debug('Site deleted');

      // Verify deletion
      const config = await nginx.get(testSiteName);
      expect(config).toBeNull();
      
      const configPath = path.join(testSitesAvailable, testSiteName);
      expect(fs.existsSync(configPath)).toBe(false);
      debug('Deletion verified - site not found');
    });

    it('should throw error when deleting non-existing site', async () => {
      const nonExistentSite = 'non-existent-delete-test';
      
      await expect(nginx.delete(nonExistentSite))
        .rejects.toThrow('does not exist');
      
      debug(`Correctly rejected deletion of non-existent site: ${nonExistentSite}`);
    });
  });

  describe('Define/Undefine Operations', () => {
    it('should define site (create new)', async () => {
      debug(`Testing define operation for new site: ${testSiteName}`);
      
      await nginx.define(testSiteName, testConfig);
      
      const config = await nginx.get(testSiteName);
      expect(config).toBeDefined();
      expect(config!.serverName).toBe(testConfig.serverName);
      
      debug(`Define created new site successfully`);
    });

    it('should define site (replace existing)', async () => {
      debug(`Testing define operation for existing site: ${testSiteName}`);
      
      // Create initial site
      await nginx.create(testSiteName, testConfig);
      debug(`Initial site created`);

      // Define with different configuration
      const newConfig: SiteConfig = { 
        ...testConfig, 
        serverName: 'updated.example.com',
        listen: 9090 
      };
      await nginx.define(testSiteName, newConfig);
      
      const retrievedConfig = await nginx.get(testSiteName);
      expect(retrievedConfig!.serverName).toBe(newConfig.serverName);
      expect(retrievedConfig!.listen).toBe(newConfig.listen);
      
      debug(`Define replaced existing site successfully`);
    });

    it('should undefine existing site without error', async () => {
      debug(`Testing undefine operation for existing site: ${testSiteName}`);
      
      // Create site first
      await nginx.create(testSiteName, testConfig);
      debug('Site created for undefine test');

      // Undefine should not throw
      await expect(nginx.undefine(testSiteName)).resolves.not.toThrow();
      
      // Verify removal
      const config = await nginx.get(testSiteName);
      expect(config).toBeNull();
      
      debug('Undefine completed successfully');
    });

    it('should undefine non-existing site without error', async () => {
      const nonExistentSite = 'non-existent-undefine-test';
      
      // Should not throw error
      await expect(nginx.undefine(nonExistentSite)).resolves.not.toThrow();
      
      debug(`Undefine correctly handled non-existent site: ${nonExistentSite}`);
    });
  });

  describe('List Operations', () => {
    it('should list sites', async () => {
      debug(`Testing list operation`);
      
      // Create multiple test sites
      await nginx.create('site1', { ...testConfig, serverName: 'site1.example.com' });
      await nginx.create('site2', { ...testConfig, serverName: 'site2.example.com' });
      debug('Test sites created for list test');

      // List sites
      const sites = await nginx.list();
      expect(Array.isArray(sites)).toBe(true);
      expect(sites).toContain('site1');
      expect(sites).toContain('site2');
      
      debug(`List found ${sites.length} sites: ${sites.join(', ')}`);
    });

    it('should return empty list for empty directory', async () => {
      const sites = await nginx.list();
      expect(Array.isArray(sites)).toBe(true);
      expect(sites.length).toBe(0);
      
      debug('List correctly returned empty array for empty directory');
    });
  });

  describe('SSL Configuration', () => {
    it('should create SSL site configuration', async () => {
      debug('Testing SSL site creation');
      
      await nginx.create('ssl-site', testConfigSSL);
      
      const config = await nginx.get('ssl-site');
      expect(config).toBeDefined();
      expect(config!.ssl).toBe(true);
      expect(config!.sslCertificate).toBe(testConfigSSL.sslCertificate);
      expect(config!.sslCertificateKey).toBe(testConfigSSL.sslCertificateKey);
      
      // Check that the generated config contains SSL directives
      const configPath = path.join(testSitesAvailable, 'ssl-site');
      const configContent = fs.readFileSync(configPath, 'utf8');
      expect(configContent).toContain('listen 443 ssl');
      expect(configContent).toContain('ssl_certificate');
      expect(configContent).toContain('ssl_certificate_key');
      expect(configContent).toContain('return 301 https://'); // HTTP redirect
      
      debug('SSL site configuration created and verified');
    });
  });

  describe('Enable/Disable Operations', () => {
    it('should check if site is enabled', async () => {
      debug('Testing site enable status check');
      
      await nginx.create(testSiteName, testConfig);
      
      const isEnabled = await nginx.isEnabled(testSiteName);
      expect(typeof isEnabled).toBe('boolean');
      
      debug(`Site ${testSiteName} enabled status: ${isEnabled}`);
    });

    it('should enable and disable sites', async () => {
      debug('Testing site enable/disable operations');
      
      // Create site
      await nginx.create(testSiteName, testConfig);
      
      // Check initial state
      let isEnabled = await nginx.isEnabled(testSiteName);
      debug(`Initial enabled state: ${isEnabled}`);
      
      // If using symlinks, test enable/disable
      if (testSitesAvailable !== testSitesEnabled) {
        // Disable site
        if (isEnabled) {
          await nginx.disable(testSiteName);
          isEnabled = await nginx.isEnabled(testSiteName);
          expect(isEnabled).toBe(false);
          debug('Site disabled successfully');
        }
        
        // Enable site
        await nginx.enable(testSiteName);
        isEnabled = await nginx.isEnabled(testSiteName);
        expect(isEnabled).toBe(true);
        debug('Site enabled successfully');
      } else {
        debug('Not using symlinks, enable/disable operations are no-ops');
      }
    });
  });

  describe('Configuration Generation', () => {
    it('should generate proper nginx configuration', async () => {
      debug('Testing nginx configuration generation');
      
      await nginx.create('config-test', testConfig);
      
      const configPath = path.join(testSitesAvailable, 'config-test');
      const configContent = fs.readFileSync(configPath, 'utf8');
      
      // Check basic structure
      expect(configContent).toContain('server {');
      expect(configContent).toContain(`server_name ${testConfig.serverName};`);
      expect(configContent).toContain(`listen ${testConfig.listen};`);
      expect(configContent).toContain(`proxy_pass ${testConfig.proxyPass};`);
      
      // Check proxy headers
      expect(configContent).toContain('proxy_set_header Host $host;');
      expect(configContent).toContain('proxy_set_header X-Real-IP $remote_addr;');
      expect(configContent).toContain('proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;');
      
      // Check WebSocket support
      expect(configContent).toContain('proxy_http_version 1.1;');
      expect(configContent).toContain('proxy_set_header Upgrade $http_upgrade;');
      expect(configContent).toContain('proxy_set_header Connection "upgrade";');
      
      debug('Nginx configuration generation verified');
    });

    it('should handle custom configuration', async () => {
      debug('Testing custom configuration handling');
      
      const customConfig: SiteConfig = {
        ...testConfig,
        customConfig: `location /api/ {
    proxy_pass http://api-backend/;
}

location /static/ {
    root /var/www/static;
}`
      };
      
      await nginx.create('custom-config-test', customConfig);
      
      const configPath = path.join(testSitesAvailable, 'custom-config-test');
      const configContent = fs.readFileSync(configPath, 'utf8');
      
      expect(configContent).toContain('location /api/');
      expect(configContent).toContain('location /static/');
      expect(configContent).toContain('proxy_pass http://api-backend/;');
      expect(configContent).toContain('root /var/www/static;');
      
      debug('Custom configuration handling verified');
    });
  });
});

// Alternative describe for when nginx is not available
(!isNginxAvailable ? describe : describe.skip)('Nginx Class - Nginx Not Available', () => {
  it('should skip tests when nginx is not installed', () => {
    expect(isNginxAvailable).toBeFalsy();
    debug('Nginx tests skipped: nginx not available on system');
  });
}); 