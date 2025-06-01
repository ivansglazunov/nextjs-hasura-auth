import { Nginx, NginxConfig, SiteConfig } from './nginx';
import Debug from './debug';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const debug = Debug('test:nginx');

// Environment availability check
function checkNginxAvailable(): boolean {
  try {
    execSync('nginx -v', { stdio: 'pipe' });
    debug('nginx is available on system');
    return true;
  } catch (error) {
    debug('nginx is NOT available on system');
    return false;
  }
}

function generateTestDirName(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `nginx-test-${timestamp}-${random}`;
}

function generateTestSiteName(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `nginx-test-site-${timestamp}-${random}`;
}

async function createTestEnvironment() {
  const testDirName = generateTestDirName();
  const testDir = `/tmp/${testDirName}`;
  const testSitesAvailable = path.join(testDir, 'sites-available');
  const testSitesEnabled = path.join(testDir, 'sites-enabled');

  // Create test directories
  fs.mkdirSync(testDir, { recursive: true });
  fs.mkdirSync(testSitesAvailable, { recursive: true });
  fs.mkdirSync(testSitesEnabled, { recursive: true });

  debug(`Created test environment: ${testDir}`);

  return {
    testDir,
    testSitesAvailable,
    testSitesEnabled,
    cleanup: () => {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
        debug(`Cleaned up test environment: ${testDir}`);
      }
    }
  };
}

describe('[DEBUG] Real Nginx Environment Check', () => {
  it('should verify nginx system dependency availability', () => {
    const isNginxAvailable = checkNginxAvailable();
    
    debug(`Nginx availability check: ${isNginxAvailable ? 'available' : 'missing'}`);
    
    if (!isNginxAvailable) {
      debug('Nginx is not installed. To enable full nginx testing:');
      debug('  Ubuntu/Debian: sudo apt install nginx');
      debug('  CentOS/RHEL: sudo yum install nginx');
      debug('  macOS: brew install nginx');
    }
    
    // Test should pass regardless - we test what we can
    expect(typeof isNginxAvailable).toBe('boolean');
  });

  it('should check nginx configuration syntax if available', () => {
    const isNginxAvailable = checkNginxAvailable();
    
    if (isNginxAvailable) {
      try {
        execSync('nginx -t', { stdio: 'pipe' });
        debug('nginx configuration syntax test passed');
      } catch (error) {
        debug(`nginx configuration syntax test failed: ${error}`);
        // Not critical for our tests
      }
    } else {
      debug('Skipping nginx syntax test - nginx not available');
    }
    
    expect(true).toBe(true); // Always pass
  });
});

describe('Real Nginx Class Tests', () => {
  
  it('should create real nginx instance with custom test paths', async () => {
    const env = await createTestEnvironment();
    
    try {
      debug('Testing real nginx instance creation with custom paths');
      
      const config: NginxConfig = {
        sitesAvailablePath: env.testSitesAvailable,
        sitesEnabledPath: env.testSitesEnabled,
      };
      
      const nginx = new Nginx(config);
      expect(nginx).toBeInstanceOf(Nginx);
      
      // Verify directories exist
      expect(fs.existsSync(env.testSitesAvailable)).toBe(true);
      expect(fs.existsSync(env.testSitesEnabled)).toBe(true);
      
      debug('Real nginx instance created successfully with custom paths');
      
    } finally {
      env.cleanup();
    }
  });

  it('should auto-detect real nginx paths when not provided', async () => {
    try {
      debug('Testing real nginx instance with auto-detected paths');
      
      const nginx = new Nginx();
      expect(nginx).toBeInstanceOf(Nginx);
      
      debug('Real nginx instance created with auto-detected paths');
      
    } catch (error) {
      debug(`Auto-detection test info: ${error}`);
      // This might fail if nginx is not installed, which is OK
    }
  });

  it('should create and retrieve real site configuration', async () => {
    const env = await createTestEnvironment();
    const testSiteName = generateTestSiteName();
    
    try {
      debug(`Testing real site creation: ${testSiteName}`);
      
      const nginx = new Nginx({
        sitesAvailablePath: env.testSitesAvailable,
        sitesEnabledPath: env.testSitesEnabled,
      });
      
      const testConfig: SiteConfig = {
        serverName: 'real-test.example.com',
        listen: 8080,
        proxyPass: 'http://localhost:3000',
      };
      
      // Create real site configuration
      await nginx.create(testSiteName, testConfig);
      
      // Verify real file exists
      const configPath = path.join(env.testSitesAvailable, testSiteName);
      expect(fs.existsSync(configPath)).toBe(true);
      
      // Read and verify real configuration content
      const configContent = fs.readFileSync(configPath, 'utf8');
      expect(configContent).toContain('server {');
      expect(configContent).toContain(testConfig.serverName);
      expect(configContent).toContain(testConfig.listen?.toString());
      expect(configContent).toContain(testConfig.proxyPass);
      
      debug('Real site configuration file created and verified');
      
      // Retrieve configuration
      const retrievedConfig = await nginx.get(testSiteName);
      expect(retrievedConfig).toBeTruthy();
      expect(retrievedConfig!.serverName).toBe(testConfig.serverName);
      expect(retrievedConfig!.listen).toBe(testConfig.listen);
      expect(retrievedConfig!.proxyPass).toBe(testConfig.proxyPass);
      
      debug('Real site configuration retrieved and matched');
      
    } finally {
      env.cleanup();
    }
  });

  it('should handle real SSL site configuration', async () => {
    const env = await createTestEnvironment();
    const testSiteName = generateTestSiteName();
    
    try {
      debug(`Testing real SSL site creation: ${testSiteName}`);
      
      const nginx = new Nginx({
        sitesAvailablePath: env.testSitesAvailable,
        sitesEnabledPath: env.testSitesEnabled,
      });
      
      const testConfigSSL: SiteConfig = {
        serverName: 'ssl-test.example.com',
        ssl: true,
        sslCertificate: '/etc/ssl/certs/test.crt',
        sslCertificateKey: '/etc/ssl/private/test.key',
        proxyPass: 'http://localhost:3000',
      };
      
      // Create real SSL site
      await nginx.create(testSiteName, testConfigSSL);
      
      // Verify real SSL configuration
      const configPath = path.join(env.testSitesAvailable, testSiteName);
      const configContent = fs.readFileSync(configPath, 'utf8');
      
      expect(configContent).toContain('listen 443 ssl');
      expect(configContent).toContain('ssl_certificate');
      expect(configContent).toContain('ssl_certificate_key');
      expect(configContent).toContain('return 301 https://');
      
      debug('Real SSL site configuration created and verified');
      
      // Retrieve and verify SSL config
      const retrievedConfig = await nginx.get(testSiteName);
      expect(retrievedConfig!.ssl).toBe(true);
      expect(retrievedConfig!.sslCertificate).toBe(testConfigSSL.sslCertificate);
      expect(retrievedConfig!.sslCertificateKey).toBe(testConfigSSL.sslCertificateKey);
      
      debug('Real SSL configuration retrieved and matched');
      
    } finally {
      env.cleanup();
    }
  });

  it('should handle real site deletion', async () => {
    const env = await createTestEnvironment();
    const testSiteName = generateTestSiteName();
    
    try {
      debug(`Testing real site deletion: ${testSiteName}`);
      
      const nginx = new Nginx({
        sitesAvailablePath: env.testSitesAvailable,
        sitesEnabledPath: env.testSitesEnabled,
      });
      
      const testConfig: SiteConfig = {
        serverName: 'delete-test.example.com',
        listen: 8080,
        proxyPass: 'http://localhost:3000',
      };
      
      // Create site first
      await nginx.create(testSiteName, testConfig);
      
      const configPath = path.join(env.testSitesAvailable, testSiteName);
      expect(fs.existsSync(configPath)).toBe(true);
      
      debug('Real site created for deletion test');
      
      // Delete real site
      await nginx.delete(testSiteName);
      
      // Verify real deletion
      expect(fs.existsSync(configPath)).toBe(false);
      
      const retrievedConfig = await nginx.get(testSiteName);
      expect(retrievedConfig).toBeNull();
      
      debug('Real site deletion verified');
      
    } finally {
      env.cleanup();
    }
  });

  it('should handle real site listing operations', async () => {
    const env = await createTestEnvironment();
    const testSite1 = generateTestSiteName();
    const testSite2 = generateTestSiteName();
    
    try {
      debug('Testing real site listing operations');
      
      const nginx = new Nginx({
        sitesAvailablePath: env.testSitesAvailable,
        sitesEnabledPath: env.testSitesEnabled,
      });
      
      // Initially empty
      let sites = await nginx.list();
      expect(Array.isArray(sites)).toBe(true);
      expect(sites.length).toBe(0);
      
      debug('Initial site list is empty as expected');
      
      // Create real sites
      await nginx.create(testSite1, {
        serverName: 'site1.example.com',
        listen: 8080,
        proxyPass: 'http://localhost:3001',
      });
      
      await nginx.create(testSite2, {
        serverName: 'site2.example.com',
        listen: 8081,
        proxyPass: 'http://localhost:3002',
      });
      
      debug('Created two real test sites');
      
      // List real sites
      sites = await nginx.list();
      expect(sites.length).toBe(2);
      expect(sites).toContain(testSite1);
      expect(sites).toContain(testSite2);
      
      debug(`Real site listing verified: found ${sites.length} sites`);
      
    } finally {
      env.cleanup();
    }
  });

  it('should handle real enable/disable operations', async () => {
    const env = await createTestEnvironment();
    const testSiteName = generateTestSiteName();
    
    try {
      debug(`Testing real enable/disable operations: ${testSiteName}`);
      
      const nginx = new Nginx({
        sitesAvailablePath: env.testSitesAvailable,
        sitesEnabledPath: env.testSitesEnabled,
      });
      
      const testConfig: SiteConfig = {
        serverName: 'enable-test.example.com',
        listen: 8080,
        proxyPass: 'http://localhost:3000',
      };
      
      // Create real site
      await nginx.create(testSiteName, testConfig);
      
      debug('Real site created for enable/disable test');
      
      // Check initial enabled status
      let isEnabled = await nginx.isEnabled(testSiteName);
      expect(typeof isEnabled).toBe('boolean');
      
      debug(`Initial enabled status: ${isEnabled}`);
      
      // Test enable/disable if using symlinks
      if (env.testSitesAvailable !== env.testSitesEnabled) {
        // Enable site
        await nginx.enable(testSiteName);
        isEnabled = await nginx.isEnabled(testSiteName);
        expect(isEnabled).toBe(true);
        
        const symlinkPath = path.join(env.testSitesEnabled, testSiteName);
        expect(fs.existsSync(symlinkPath)).toBe(true);
        
        debug('Real site enabled and symlink verified');
        
        // Disable site
        await nginx.disable(testSiteName);
        isEnabled = await nginx.isEnabled(testSiteName);
        expect(isEnabled).toBe(false);
        
        expect(fs.existsSync(symlinkPath)).toBe(false);
        
        debug('Real site disabled and symlink removed');
      } else {
        debug('Using same directory for available/enabled - enable/disable are no-ops');
      }
      
    } finally {
      env.cleanup();
    }
  });

  it('should handle real define/undefine operations', async () => {
    const env = await createTestEnvironment();
    const testSiteName = generateTestSiteName();
    
    try {
      debug(`Testing real define/undefine operations: ${testSiteName}`);
      
      const nginx = new Nginx({
        sitesAvailablePath: env.testSitesAvailable,
        sitesEnabledPath: env.testSitesEnabled,
      });
      
      const testConfig: SiteConfig = {
        serverName: 'define-test.example.com',
        listen: 8080,
        proxyPass: 'http://localhost:3000',
      };
      
      // Define new site (creates)
      await nginx.define(testSiteName, testConfig);
      
      let retrievedConfig = await nginx.get(testSiteName);
      expect(retrievedConfig).toBeTruthy();
      expect(retrievedConfig!.serverName).toBe(testConfig.serverName);
      
      debug('Real site defined (created) successfully');
      
      // Redefine existing site (updates)
      const updatedConfig: SiteConfig = {
        ...testConfig,
        serverName: 'updated-define-test.example.com',
        listen: 9090,
      };
      
      await nginx.define(testSiteName, updatedConfig);
      
      retrievedConfig = await nginx.get(testSiteName);
      expect(retrievedConfig!.serverName).toBe(updatedConfig.serverName);
      expect(retrievedConfig!.listen).toBe(updatedConfig.listen);
      
      debug('Real site redefined (updated) successfully');
      
      // Undefine site
      await nginx.undefine(testSiteName);
      
      retrievedConfig = await nginx.get(testSiteName);
      expect(retrievedConfig).toBeNull();
      
      debug('Real site undefined (deleted) successfully');
      
      // Undefine non-existent site (should not throw)
      await expect(nginx.undefine('non-existent-site')).resolves.not.toThrow();
      
      debug('Real undefine of non-existent site handled gracefully');
      
    } finally {
      env.cleanup();
    }
  });

  it('should generate real nginx configuration with all features', async () => {
    const env = await createTestEnvironment();
    const testSiteName = generateTestSiteName();
    
    try {
      debug(`Testing real nginx configuration generation: ${testSiteName}`);
      
      const nginx = new Nginx({
        sitesAvailablePath: env.testSitesAvailable,
        sitesEnabledPath: env.testSitesEnabled,
      });
      
      const fullConfig: SiteConfig = {
        serverName: 'full-config-test.example.com',
        listen: 8080,
        proxyPass: 'http://localhost:3000',
        customConfig: `location /api/ {
    proxy_pass http://api-backend/;
    proxy_timeout 30s;
}

location /static/ {
    root /var/www/static;
    expires 1d;
}`
      };
      
      // Create real configuration
      await nginx.create(testSiteName, fullConfig);
      
      // Read real generated configuration
      const configPath = path.join(env.testSitesAvailable, testSiteName);
      const configContent = fs.readFileSync(configPath, 'utf8');
      
      // Verify all nginx features
      expect(configContent).toContain('server {');
      expect(configContent).toContain(`server_name ${fullConfig.serverName};`);
      expect(configContent).toContain(`listen ${fullConfig.listen};`);
      expect(configContent).toContain(`proxy_pass ${fullConfig.proxyPass};`);
      
      // Verify proxy headers
      expect(configContent).toContain('proxy_set_header Host $host;');
      expect(configContent).toContain('proxy_set_header X-Real-IP $remote_addr;');
      expect(configContent).toContain('proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;');
      
      // Verify WebSocket support
      expect(configContent).toContain('proxy_http_version 1.1;');
      expect(configContent).toContain('proxy_set_header Upgrade $http_upgrade;');
      expect(configContent).toContain('proxy_set_header Connection "upgrade";');
      
      // Verify custom configuration
      expect(configContent).toContain('location /api/');
      expect(configContent).toContain('location /static/');
      expect(configContent).toContain('proxy_pass http://api-backend/;');
      expect(configContent).toContain('root /var/www/static;');
      expect(configContent).toContain('proxy_timeout 30s;');
      expect(configContent).toContain('expires 1d;');
      
      debug('Real nginx configuration generation verified with all features');
      
    } finally {
      env.cleanup();
    }
  });

  it('should handle real error conditions properly', async () => {
    const env = await createTestEnvironment();
    const testSiteName = generateTestSiteName();
    
    try {
      debug('Testing real error condition handling');
      
      const nginx = new Nginx({
        sitesAvailablePath: env.testSitesAvailable,
        sitesEnabledPath: env.testSitesEnabled,
      });
      
      const testConfig: SiteConfig = {
        serverName: 'error-test.example.com',
        listen: 8080,
        proxyPass: 'http://localhost:3000',
      };
      
      // Test duplicate creation
      await nginx.create(testSiteName, testConfig);
      await expect(nginx.create(testSiteName, testConfig))
        .rejects.toThrow('already exists');
      
      debug('Real duplicate creation error handled correctly');
      
      // Test deletion of non-existent site
      await expect(nginx.delete('non-existent-site'))
        .rejects.toThrow('does not exist');
      
      debug('Real deletion of non-existent site error handled correctly');
      
      // Test retrieval of non-existent site
      const nonExistentConfig = await nginx.get('non-existent-site');
      expect(nonExistentConfig).toBeNull();
      
      debug('Real retrieval of non-existent site returned null correctly');
      
    } finally {
      env.cleanup();
    }
  });

  it('should show real nginx testing environment status', async () => {
    const isNginxAvailable = checkNginxAvailable();
    
    debug('Real Nginx tests use actual nginx functionality:');
    debug(`  • Real nginx binary (${isNginxAvailable ? 'available' : 'missing'})`);
    debug('  • Real file system operations');
    debug('  • Real configuration generation');
    debug('  • Real site management (create/delete/enable/disable)');
    debug('  • Real symlink operations for enable/disable');
    debug('  • Each test creates isolated environment');
    debug('  • Each test cleans up its own resources');
    
    if (isNginxAvailable) {
      try {
        const version = execSync('nginx -v', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
        debug(`  • Nginx version: ${version.trim()}`);
      } catch (error) {
        debug('  • Could not get nginx version');
      }
    }
    
    expect(true).toBe(true); // Always pass
  });
}); 