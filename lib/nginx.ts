import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import Debug from './debug';

const debug = Debug('nginx');

export interface NginxConfig {
  sitesAvailablePath?: string;
  sitesEnabledPath?: string;
}

export interface SiteConfig {
  serverName: string;
  listen?: number;
  proxyPass?: string;
  ssl?: boolean;
  sslCertificate?: string;
  sslCertificateKey?: string;
  customConfig?: string;
}

// Popular nginx installation paths across different distributions
const NGINX_COMMON_PATHS = [
  '/etc/nginx/sites-available',  // Ubuntu/Debian
  '/etc/nginx/conf.d',           // CentOS/RHEL/Fedora  
  '/usr/local/etc/nginx/sites-available',  // FreeBSD/macOS Homebrew
  '/opt/etc/nginx/sites-available',        // Some custom installations
  '/var/www/conf/nginx',         // Some hosting panels
  '/etc/nginx/vhosts',           // Some distributions
  '/etc/nginx/vhost.d',          // Some configurations
];

const NGINX_ENABLED_PATHS = [
  '/etc/nginx/sites-enabled',    // Ubuntu/Debian
  '/etc/nginx/conf.d',           // CentOS/RHEL/Fedora (same as available)
  '/usr/local/etc/nginx/sites-enabled',   // FreeBSD/macOS Homebrew
  '/opt/etc/nginx/sites-enabled',         // Some custom installations
  '/var/www/conf/nginx',         // Some hosting panels (same as available)
  '/etc/nginx/vhosts',           // Some distributions (same as available)
  '/etc/nginx/vhost.d',          // Some configurations (same as available)
];

export class Nginx {
  private sitesAvailablePath: string;
  private sitesEnabledPath: string;
  private useSymlinks: boolean;

  constructor(config?: NginxConfig) {
    debug('Initializing Nginx manager');
    
    if (config?.sitesAvailablePath && config?.sitesEnabledPath) {
      this.sitesAvailablePath = config.sitesAvailablePath;
      this.sitesEnabledPath = config.sitesEnabledPath;
    } else {
      const detectedPaths = this.detectNginxPaths();
      this.sitesAvailablePath = detectedPaths.sitesAvailable;
      this.sitesEnabledPath = detectedPaths.sitesEnabled;
    }

    // Determine if we should use symlinks or direct files
    this.useSymlinks = this.sitesAvailablePath !== this.sitesEnabledPath;

    debug(`Using nginx paths: available=${this.sitesAvailablePath}, enabled=${this.sitesEnabledPath}, symlinks=${this.useSymlinks}`);
    
    this.validatePaths();
  }

  private detectNginxPaths(): { sitesAvailable: string; sitesEnabled: string } {
    debug('Auto-detecting nginx paths');

    // Try to detect from nginx configuration
    try {
      const nginxOutput = execSync('nginx -V 2>&1', { encoding: 'utf8' });
      const configPathMatch = nginxOutput.match(/--conf-path=([^\s]+)/);
      if (configPathMatch) {
        const configPath = configPathMatch[1];
        const nginxDir = path.dirname(configPath);
        
        const potentialSitesAvailable = path.join(nginxDir, 'sites-available');
        const potentialSitesEnabled = path.join(nginxDir, 'sites-enabled');
        
        if (fs.existsSync(potentialSitesAvailable)) {
          debug(`Detected from nginx config: ${potentialSitesAvailable}`);
          return {
            sitesAvailable: potentialSitesAvailable,
            sitesEnabled: fs.existsSync(potentialSitesEnabled) ? potentialSitesEnabled : potentialSitesAvailable
          };
        }
      }
    } catch (error) {
      debug(`Failed to detect from nginx -V: ${error}`);
    }

    // Fallback to checking common paths
    for (let i = 0; i < NGINX_COMMON_PATHS.length; i++) {
      const availablePath = NGINX_COMMON_PATHS[i];
      const enabledPath = NGINX_ENABLED_PATHS[i];
      
      if (fs.existsSync(availablePath)) {
        debug(`Found nginx path: ${availablePath}`);
        return {
          sitesAvailable: availablePath,
          sitesEnabled: fs.existsSync(enabledPath) ? enabledPath : availablePath
        };
      }
    }

    // If nothing found, default to most common Ubuntu/Debian paths
    const defaultAvailable = '/etc/nginx/sites-available';
    const defaultEnabled = '/etc/nginx/sites-enabled';
    
    debug(`No nginx paths detected, using defaults: ${defaultAvailable}`);
    return {
      sitesAvailable: defaultAvailable,
      sitesEnabled: defaultEnabled
    };
  }

  private validatePaths(): void {
    // Ensure directories exist
    if (!fs.existsSync(this.sitesAvailablePath)) {
      debug(`Creating sites-available directory: ${this.sitesAvailablePath}`);
      fs.mkdirSync(this.sitesAvailablePath, { recursive: true });
    }

    if (this.useSymlinks && !fs.existsSync(this.sitesEnabledPath)) {
      debug(`Creating sites-enabled directory: ${this.sitesEnabledPath}`);
      fs.mkdirSync(this.sitesEnabledPath, { recursive: true });
    }
  }

  private getConfigPath(siteName: string): string {
    return path.join(this.sitesAvailablePath, siteName);
  }

  private getEnabledPath(siteName: string): string {
    return path.join(this.sitesEnabledPath, siteName);
  }

  private generateNginxConfig(siteName: string, config: SiteConfig): string {
    const listen = config.listen || 80;
    const hasSSL = config.ssl && config.sslCertificate && config.sslCertificateKey;
    
    let nginxConfig = '';

    if (hasSSL) {
      // HTTPS server block
      nginxConfig += `server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${config.serverName};

    ssl_certificate ${config.sslCertificate};
    ssl_certificate_key ${config.sslCertificateKey};
    
    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

`;

      if (config.proxyPass) {
        nginxConfig += `    location / {
        proxy_pass ${config.proxyPass};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
`;
      }

      if (config.customConfig) {
        nginxConfig += `    ${config.customConfig.replace(/\n/g, '\n    ')}\n`;
      }

      nginxConfig += `}

# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name ${config.serverName};
    
    return 301 https://$host$request_uri;
}`;
    } else {
      // HTTP only server block
      nginxConfig += `server {
    listen ${listen};
    listen [::]:${listen};
    server_name ${config.serverName};

`;

      if (config.proxyPass) {
        nginxConfig += `    location / {
        proxy_pass ${config.proxyPass};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
`;
      }

      if (config.customConfig) {
        nginxConfig += `    ${config.customConfig.replace(/\n/g, '\n    ')}\n`;
      }

      nginxConfig += `}`;
    }

    return nginxConfig;
  }

  private testNginxConfig(): void {
    try {
      execSync('nginx -t', { stdio: 'pipe' });
      debug('Nginx configuration test passed');
    } catch (error) {
      throw new Error(`Nginx configuration test failed: ${error}`);
    }
  }

  private reloadNginx(): void {
    try {
      execSync('nginx -s reload', { stdio: 'pipe' });
      debug('Nginx reloaded successfully');
    } catch (error) {
      try {
        execSync('systemctl reload nginx', { stdio: 'pipe' });
        debug('Nginx reloaded via systemctl');
      } catch (systemctlError) {
        throw new Error(`Failed to reload nginx: ${error}`);
      }
    }
  }

  /**
   * Get site configuration
   * Returns null if site doesn't exist
   */
  async get(siteName: string): Promise<SiteConfig | null> {
    debug(`Getting site configuration for: ${siteName}`);
    
    const configPath = this.getConfigPath(siteName);
    
    if (!fs.existsSync(configPath)) {
      debug(`Site ${siteName} not found in ${configPath}`);
      return null;
    }

    try {
      const configContent = fs.readFileSync(configPath, 'utf8');
      
      // Parse basic info from nginx config (simplified parsing)
      const serverNameMatch = configContent.match(/server_name\s+([^;]+);/);
      const listenMatch = configContent.match(/listen\s+(\d+)/);
      const proxyPassMatch = configContent.match(/proxy_pass\s+([^;]+);/);
      const sslCertMatch = configContent.match(/ssl_certificate\s+([^;]+);/);
      const sslKeyMatch = configContent.match(/ssl_certificate_key\s+([^;]+);/);
      
      const config: SiteConfig = {
        serverName: serverNameMatch ? serverNameMatch[1].trim() : siteName,
        listen: listenMatch ? parseInt(listenMatch[1]) : undefined,
        proxyPass: proxyPassMatch ? proxyPassMatch[1].trim() : undefined,
        ssl: !!(sslCertMatch && sslKeyMatch),
        sslCertificate: sslCertMatch ? sslCertMatch[1].trim() : undefined,
        sslCertificateKey: sslKeyMatch ? sslKeyMatch[1].trim() : undefined,
      };

      debug(`Found site configuration for ${siteName}: ${JSON.stringify(config)}`);
      return config;
    } catch (error) {
      debug(`Error reading site config ${siteName}: ${error}`);
      throw new Error(`Failed to read site configuration: ${error}`);
    }
  }

  /**
   * List all available sites
   */
  async list(): Promise<string[]> {
    debug(`Listing sites from: ${this.sitesAvailablePath}`);
    
    try {
      if (!fs.existsSync(this.sitesAvailablePath)) {
        debug('Sites directory does not exist, returning empty list');
        return [];
      }

      const files = fs.readdirSync(this.sitesAvailablePath);
      const sites = files.filter(file => {
        const filePath = path.join(this.sitesAvailablePath, file);
        return fs.statSync(filePath).isFile();
      });

      debug(`Found ${sites.length} sites: ${sites.join(', ')}`);
      return sites;
    } catch (error) {
      debug(`Error listing sites: ${error}`);
      throw new Error(`Failed to list sites: ${error}`);
    }
  }

  /**
   * Create new site configuration
   * Throws error if site already exists
   */
  async create(siteName: string, config: SiteConfig): Promise<void> {
    debug(`Creating site: ${siteName}`);
    
    const configPath = this.getConfigPath(siteName);
    
    if (fs.existsSync(configPath)) {
      throw new Error(`Site ${siteName} already exists`);
    }

    try {
      const nginxConfig = this.generateNginxConfig(siteName, config);
      fs.writeFileSync(configPath, nginxConfig);
      debug(`Site configuration written to: ${configPath}`);

      // Test configuration before enabling
      this.testNginxConfig();

      // Enable site if using symlinks
      if (this.useSymlinks) {
        const enabledPath = this.getEnabledPath(siteName);
        if (!fs.existsSync(enabledPath)) {
          fs.symlinkSync(configPath, enabledPath);
          debug(`Site enabled via symlink: ${enabledPath}`);
        }
      }

      // Reload nginx
      this.reloadNginx();
      
      debug(`Site ${siteName} created successfully`);
    } catch (error) {
      // Cleanup on failure
      if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
      }
      debug(`Error creating site ${siteName}: ${error}`);
      throw new Error(`Failed to create site: ${error}`);
    }
  }

  /**
   * Delete site configuration
   * Throws error if site doesn't exist
   */
  async delete(siteName: string): Promise<void> {
    debug(`Deleting site: ${siteName}`);
    
    const configPath = this.getConfigPath(siteName);
    
    if (!fs.existsSync(configPath)) {
      throw new Error(`Site ${siteName} does not exist`);
    }

    try {
      // Remove symlink if exists
      if (this.useSymlinks) {
        const enabledPath = this.getEnabledPath(siteName);
        if (fs.existsSync(enabledPath)) {
          fs.unlinkSync(enabledPath);
          debug(`Removed symlink: ${enabledPath}`);
        }
      }

      // Remove configuration file
      fs.unlinkSync(configPath);
      debug(`Removed configuration: ${configPath}`);

      // Test and reload nginx
      this.testNginxConfig();
      this.reloadNginx();
      
      debug(`Site ${siteName} deleted successfully`);
    } catch (error) {
      debug(`Error deleting site ${siteName}: ${error}`);
      throw new Error(`Failed to delete site: ${error}`);
    }
  }

  /**
   * Define site (delete if exists, then create)
   * Does not throw errors for non-existing sites
   */
  async define(siteName: string, config: SiteConfig): Promise<void> {
    debug(`Defining site: ${siteName}`);
    
    try {
      await this.undefine(siteName);
    } catch (error) {
      debug(`No existing site to remove: ${siteName}`);
    }

    await this.create(siteName, config);
  }

  /**
   * Undefine site (delete if exists)
   * Does not throw errors for non-existing sites
   */
  async undefine(siteName: string): Promise<void> {
    debug(`Undefining site: ${siteName}`);
    
    try {
      await this.delete(siteName);
    } catch (error) {
      debug(`Site ${siteName} does not exist or already deleted`);
      // Do not throw error - this is expected behavior for undefine
    }
  }

  /**
   * Check if site is enabled
   */
  async isEnabled(siteName: string): Promise<boolean> {
    if (!this.useSymlinks) {
      // If not using symlinks, a site is enabled if it exists
      return fs.existsSync(this.getConfigPath(siteName));
    }

    const enabledPath = this.getEnabledPath(siteName);
    return fs.existsSync(enabledPath);
  }

  /**
   * Enable site (create symlink if using symlinks)
   */
  async enable(siteName: string): Promise<void> {
    debug(`Enabling site: ${siteName}`);
    
    const configPath = this.getConfigPath(siteName);
    if (!fs.existsSync(configPath)) {
      throw new Error(`Site ${siteName} does not exist`);
    }

    if (!this.useSymlinks) {
      debug(`Not using symlinks, site ${siteName} is already enabled`);
      return;
    }

    const enabledPath = this.getEnabledPath(siteName);
    if (fs.existsSync(enabledPath)) {
      debug(`Site ${siteName} is already enabled`);
      return;
    }

    try {
      fs.symlinkSync(configPath, enabledPath);
      this.testNginxConfig();
      this.reloadNginx();
      debug(`Site ${siteName} enabled successfully`);
    } catch (error) {
      debug(`Error enabling site ${siteName}: ${error}`);
      throw new Error(`Failed to enable site: ${error}`);
    }
  }

  /**
   * Disable site (remove symlink if using symlinks)
   */
  async disable(siteName: string): Promise<void> {
    debug(`Disabling site: ${siteName}`);
    
    if (!this.useSymlinks) {
      throw new Error('Cannot disable site when not using symlinks. Use delete() instead.');
    }

    const enabledPath = this.getEnabledPath(siteName);
    if (!fs.existsSync(enabledPath)) {
      debug(`Site ${siteName} is already disabled`);
      return;
    }

    try {
      fs.unlinkSync(enabledPath);
      this.testNginxConfig();
      this.reloadNginx();
      debug(`Site ${siteName} disabled successfully`);
    } catch (error) {
      debug(`Error disabling site ${siteName}: ${error}`);
      throw new Error(`Failed to disable site: ${error}`);
    }
  }
} 