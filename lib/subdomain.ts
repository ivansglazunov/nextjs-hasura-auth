import Debug from './debug';
import { CloudFlare } from './cloudflare';
import { SSL } from './ssl';
import { Nginx } from './nginx';

const debug = Debug('subdomain');

export interface SubdomainManagerConfig {
  nginx: Nginx;
  ssl: SSL;
  cloudflare: CloudFlare;
}

export interface SubdomainConfig {
  ip: string;
  port: number;
  ttl?: number;
  proxied?: boolean;
  email?: string;
}

export interface SubdomainInfo {
  subdomain: string;
  fullDomain: string;
  ip: string;
  port: number;
  cloudflareStatus: {
    exists: boolean;
    recordId?: string;
    ttl?: number;
    proxied?: boolean;
  };
  sslStatus: {
    exists: boolean;
    expiresAt?: Date;
    daysLeft?: number;
  };
  nginxStatus: {
    exists: boolean;
    enabled: boolean;
    serverName?: string;
  };
  fullyActive: boolean;
}

export class SubdomainManager {
  public nginx: Nginx;
  public ssl: SSL;
  public cloudflare: CloudFlare;
  public domain: string;

  constructor(config: SubdomainManagerConfig) {
    debug('Initializing SubdomainManager');
    
    this.nginx = config.nginx;
    this.ssl = config.ssl;
    this.cloudflare = config.cloudflare;
    
    // Extract domain from CloudFlare instance
    this.domain = (this.cloudflare as any).domain;
    
    debug(`SubdomainManager initialized for domain: ${this.domain}`);
  }

  public getFullDomain(subdomain: string): string {
    if (subdomain === '@' || subdomain === '') {
      return this.domain;
    }
    return `${subdomain}.${this.domain}`;
  }

  public validateSubdomainName(subdomain: string): void {
    if (!subdomain || subdomain.trim() === '') {
      throw new Error('Subdomain name cannot be empty');
    }
    
    // Basic DNS name validation
    const validPattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
    if (!validPattern.test(subdomain)) {
      throw new Error('Invalid subdomain name. Use only letters, numbers, and hyphens.');
    }

    if (subdomain.startsWith('-') || subdomain.endsWith('-')) {
      throw new Error('Subdomain cannot start or end with a hyphen');
    }
  }

  public async getSubdomainInfo(subdomain: string): Promise<SubdomainInfo> {
    const fullDomain = this.getFullDomain(subdomain);
    debug(`Getting subdomain info for: ${subdomain} (${fullDomain})`);

    // Check CloudFlare status
    const cloudflareRecord = await this.cloudflare.get(subdomain);
    const cloudflareStatus = {
      exists: !!cloudflareRecord,
      recordId: cloudflareRecord?.id,
      ttl: cloudflareRecord?.ttl,
      proxied: cloudflareRecord?.proxied
    };

    // Check SSL status
    const sslInfo = await this.ssl.check(fullDomain);
    const sslStatus = {
      exists: sslInfo.exists,
      expiresAt: sslInfo.expiresAt,
      daysLeft: sslInfo.daysLeft
    };

    // Check Nginx status
    const nginxConfig = await this.nginx.get(fullDomain);
    const nginxEnabled = await this.nginx.isEnabled(fullDomain);
    const nginxStatus = {
      exists: !!nginxConfig,
      enabled: nginxEnabled,
      serverName: nginxConfig?.serverName
    };

    // Extract IP and port from existing configuration
    let ip = '';
    let port = 80;

    if (cloudflareRecord) {
      ip = cloudflareRecord.content;
    }

    if (nginxConfig?.proxyPass) {
      const match = nginxConfig.proxyPass.match(/http:\/\/(?:localhost|127\.0\.0\.1):(\d+)/);
      if (match) {
        port = parseInt(match[1]);
      }
    }

    // Subdomain is fully active only if all components exist and nginx is enabled
    const fullyActive = cloudflareStatus.exists && sslStatus.exists && nginxStatus.exists && nginxStatus.enabled;

    const info: SubdomainInfo = {
      subdomain,
      fullDomain,
      ip,
      port,
      cloudflareStatus,
      sslStatus,
      nginxStatus,
      fullyActive
    };

    debug(`Subdomain info for ${subdomain}: ${JSON.stringify(info, null, 2)}`);
    return info;
  }

  public async reinitializeNginx(): Promise<void> {
    debug('Reinitializing nginx to ensure configuration is active');
    
    try {
      // Test nginx configuration
      (this.nginx as any).testNginxConfig();
      
      // Reload nginx
      (this.nginx as any).reloadNginx();
      
      debug('Nginx reinitialized successfully');
    } catch (error) {
      debug(`Error reinitializing nginx: ${error}`);
      throw new Error(`Failed to reinitialize nginx: ${error}`);
    }
  }

  /**
   * Define complete subdomain with CloudFlare DNS, SSL certificate, and Nginx proxy
   * This is the main method for creating fully functional subdomains
   */
  async define(subdomain: string, config: SubdomainConfig): Promise<SubdomainInfo> {
    debug(`Defining complete subdomain: ${subdomain}`);
    
    this.validateSubdomainName(subdomain);
    
    const fullDomain = this.getFullDomain(subdomain);
    let progress = 'Starting';

    try {
      // Step 1: Create CloudFlare DNS record
      progress = 'Creating DNS record';
      debug(`${progress} for ${fullDomain} → ${config.ip}`);
      
      await this.cloudflare.define(subdomain, {
        ip: config.ip,
        ttl: config.ttl || 300,
        proxied: config.proxied || false
      });
      
      debug(`DNS record created successfully for ${fullDomain}`);

      // Step 2: Wait for DNS propagation
      progress = 'Waiting for DNS propagation';
      debug(`${progress} for ${fullDomain}`);
      
      await this.ssl.wait(fullDomain, config.ip);
      debug(`DNS propagation completed for ${fullDomain}`);

      // Step 3: Create SSL certificate
      progress = 'Creating SSL certificate';
      debug(`${progress} for ${fullDomain}`);
      
      await this.ssl.define(fullDomain, config.email);
      debug(`SSL certificate created successfully for ${fullDomain}`);

      // Step 4: Create Nginx configuration with SSL
      progress = 'Creating Nginx configuration';
      debug(`${progress} for ${fullDomain}`);
      
      const sslInfo = await this.ssl.check(fullDomain);
      
      await this.nginx.define(fullDomain, {
        serverName: fullDomain,
        proxyPass: `http://127.0.0.1:${config.port}`,
        ssl: true,
        sslCertificate: sslInfo.path?.fullchain,
        sslCertificateKey: sslInfo.path?.privateKey
      });
      
      debug(`Nginx configuration created successfully for ${fullDomain}`);

      // Step 5: Reinitialize nginx to guarantee activation
      progress = 'Reinitializing nginx';
      debug(`${progress} for ${fullDomain}`);
      
      await this.reinitializeNginx();
      debug(`Nginx reinitialized for ${fullDomain}`);

      // Return final subdomain information
      const finalInfo = await this.getSubdomainInfo(subdomain);
      
      debug(`Subdomain ${subdomain} defined successfully. Fully active: ${finalInfo.fullyActive}`);
      console.log(`🎉 Subdomain ${fullDomain} created successfully!`);
      console.log(`🌐 Available at: https://${fullDomain}`);
      console.log(`🔗 Proxies to: http://127.0.0.1:${config.port}`);
      
      return finalInfo;
      
    } catch (error) {
      debug(`Error during subdomain definition at step '${progress}': ${error}`);
      console.error(`💥 Failed to define subdomain ${fullDomain} at step: ${progress}`);
      
      // Attempt cleanup on failure
      try {
        debug(`Attempting cleanup for failed subdomain: ${subdomain}`);
        await this.undefine(subdomain);
      } catch (cleanupError) {
        debug(`Cleanup failed: ${cleanupError}`);
      }
      
      throw new Error(`Failed to define subdomain at ${progress}: ${error}`);
    }
  }

  /**
   * Undefine complete subdomain by removing all components
   * Does not throw errors for non-existing components
   */
  async undefine(subdomain: string): Promise<void> {
    debug(`Undefining complete subdomain: ${subdomain}`);
    
    const fullDomain = this.getFullDomain(subdomain);
    const errors: string[] = [];

    // Step 1: Remove Nginx configuration (disable first if needed)
    try {
      debug(`Removing Nginx configuration for ${fullDomain}`);
      await this.nginx.undefine(fullDomain);
      debug(`Nginx configuration removed for ${fullDomain}`);
    } catch (error) {
      debug(`Error removing Nginx configuration: ${error}`);
      errors.push(`Nginx: ${error}`);
    }

    // Step 2: Remove SSL certificate
    try {
      debug(`Removing SSL certificate for ${fullDomain}`);
      await this.ssl.undefine(fullDomain);
      debug(`SSL certificate removed for ${fullDomain}`);
    } catch (error) {
      debug(`Error removing SSL certificate: ${error}`);
      errors.push(`SSL: ${error}`);
    }

    // Step 3: Remove CloudFlare DNS record
    try {
      debug(`Removing DNS record for ${fullDomain}`);
      await this.cloudflare.undefine(subdomain);
      debug(`DNS record removed for ${fullDomain}`);
    } catch (error) {
      debug(`Error removing DNS record: ${error}`);
      errors.push(`DNS: ${error}`);
    }

    // Step 4: Reinitialize nginx to ensure clean state
    try {
      debug(`Reinitializing nginx after subdomain removal`);
      await this.reinitializeNginx();
      debug(`Nginx reinitialized after removal`);
    } catch (error) {
      debug(`Error reinitializing nginx: ${error}`);
      errors.push(`Nginx reload: ${error}`);
    }

    if (errors.length > 0) {
      debug(`Subdomain undefine completed with some errors: ${errors.join(', ')}`);
      console.warn(`⚠️ Subdomain ${fullDomain} removed with some warnings: ${errors.join(', ')}`);
    } else {
      debug(`Subdomain ${subdomain} undefined successfully`);
      console.log(`✅ Subdomain ${fullDomain} removed successfully`);
    }
  }

  /**
   * List all fully active subdomains
   * Returns only subdomains that have all components (DNS, SSL, Nginx) properly configured
   */
  async list(): Promise<SubdomainInfo[]> {
    debug('Listing all fully active subdomains');
    
    try {
      // Get all DNS records from CloudFlare
      const dnsRecords = await this.cloudflare.list();
      debug(`Found ${dnsRecords.length} DNS records`);

      // Process each record to get complete subdomain information
      const subdomainPromises = dnsRecords.map(async (record) => {
        try {
          // Extract subdomain from full domain name
          let subdomain = record.name;
          if (subdomain === this.domain) {
            subdomain = '@'; // Root domain
          } else if (subdomain.endsWith(`.${this.domain}`)) {
            subdomain = subdomain.replace(`.${this.domain}`, '');
          } else {
            // Skip records that don't belong to our domain
            return null;
          }

          const info = await this.getSubdomainInfo(subdomain);
          return info;
        } catch (error) {
          debug(`Error getting info for record ${record.name}: ${error}`);
          return null;
        }
      });

      const allSubdomains = await Promise.all(subdomainPromises);
      
      // Filter out null results and only return fully active subdomains
      const activeSubdomains = allSubdomains
        .filter((info): info is SubdomainInfo => info !== null && info.fullyActive);

      debug(`Found ${activeSubdomains.length} fully active subdomains out of ${dnsRecords.length} DNS records`);
      
      // Sort by subdomain name for consistent output
      activeSubdomains.sort((a, b) => a.subdomain.localeCompare(b.subdomain));

      return activeSubdomains;
    } catch (error) {
      debug(`Error listing subdomains: ${error}`);
      throw new Error(`Failed to list subdomains: ${error}`);
    }
  }
} 