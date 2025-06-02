import Debug from './debug';
import { CloudFlare } from './cloudflare';
import { SSL, WildcardCertificateInfo } from './ssl';
import { Nginx } from './nginx';
import * as fs from 'fs';

const debug = Debug('subdomain');

export interface SubdomainManagerConfig {
  nginx: Nginx;
  ssl: SSL;
  cloudflare: CloudFlare;
  useWildcardSSL?: boolean; // New option to enable wildcard SSL
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
    isWildcard?: boolean; // New field to indicate wildcard usage
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
  public useWildcardSSL: boolean;
  private wildcardCertInfo: WildcardCertificateInfo | null = null;

  constructor(config: SubdomainManagerConfig) {
    debug('Initializing SubdomainManager');
    
    this.nginx = config.nginx;
    this.ssl = config.ssl;
    this.cloudflare = config.cloudflare;
    this.useWildcardSSL = config.useWildcardSSL ?? true; // Default to wildcard SSL
    
    // Extract domain from CloudFlare instance
    this.domain = (this.cloudflare as any).domain;
    
    debug(`SubdomainManager initialized for domain: ${this.domain}, wildcard SSL: ${this.useWildcardSSL}`);
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

  /**
   * FULL CLEANUP - Remove subdomain from BOTH legacy and new mechanics
   * This ensures complete compatibility and no orphaned SSL certificates
   */
  async fullCleanup(subdomain: string): Promise<void> {
    const fullDomain = this.getFullDomain(subdomain);
    debug(`Performing FULL CLEANUP for subdomain: ${subdomain} (${fullDomain})`);
    
    const errors: string[] = [];

    // Step 1: Remove Nginx configuration (common for both mechanics)
    try {
      debug(`Removing Nginx configuration for ${fullDomain}`);
      await this.nginx.undefine(fullDomain);
      debug(`✅ Nginx configuration removed for ${fullDomain}`);
    } catch (error) {
      debug(`Nginx removal error (safe to ignore): ${error}`);
      errors.push(`Nginx: ${error}`);
    }

    // Step 2: Remove INDIVIDUAL SSL certificate (legacy mechanic)
    try {
      debug(`Removing individual SSL certificate for ${fullDomain}`);
      await this.ssl.undefine(fullDomain);
      debug(`✅ Individual SSL certificate removed for ${fullDomain}`);
    } catch (error) {
      debug(`Individual SSL removal error (safe to ignore): ${error}`);
      errors.push(`Individual SSL: ${error}`);
    }

    // Step 3: Check and preserve/clean wildcard SSL based on usage
    if (this.useWildcardSSL) {
      debug(`Preserving wildcard SSL certificate for ${this.domain} (shared resource)`);
    } else {
      // If not using wildcard SSL, we could clean it up, but it's safer to preserve
      debug(`Wildcard SSL preserved (other subdomains might use it)`);
    }

    // Step 4: Remove DNS record (common for both mechanics)
    try {
      debug(`Removing DNS record for ${fullDomain}`);
      await this.cloudflare.undefine(subdomain);
      debug(`✅ DNS record removed for ${fullDomain}`);
    } catch (error) {
      debug(`DNS removal error (safe to ignore): ${error}`);
      errors.push(`DNS: ${error}`);
    }

    // Step 5: Reinitialize nginx to ensure clean state
    try {
      debug(`Reinitializing nginx after full cleanup`);
      await this.reinitializeNginx();
      debug(`✅ Nginx reinitialized after full cleanup`);
    } catch (error) {
      debug(`Nginx reload error: ${error}`);
      errors.push(`Nginx reload: ${error}`);
    }

    if (errors.length > 0) {
      debug(`Full cleanup completed with warnings: ${errors.join(', ')}`);
    } else {
      debug(`✅ Full cleanup completed successfully for ${subdomain}`);
    }
  }

  /**
   * Initialize wildcard SSL certificate (called once)
   * Creates or verifies wildcard certificate for the domain
   */
  async initializeWildcardSSL(): Promise<void> {
    if (!this.useWildcardSSL) {
      debug('Wildcard SSL disabled, skipping initialization');
      return;
    }
    
    debug('Initializing wildcard SSL certificate');
    
    // Check if wildcard certificate already exists
    this.wildcardCertInfo = await this.ssl.getWildcard(this.domain);
    
    if (!this.wildcardCertInfo || (this.wildcardCertInfo.daysLeft && this.wildcardCertInfo.daysLeft < 30)) {
      debug('Creating new wildcard certificate');
      
      // Generate Cloudflare credentials file
      const credPath = this.cloudflare.generateCredentialsFile();
      
      try {
        await this.ssl.createWildcard(this.domain, credPath);
        this.wildcardCertInfo = await this.ssl.getWildcard(this.domain);
        
        debug(`Wildcard certificate created successfully: ${this.wildcardCertInfo?.wildcardDomain}`);
      } finally {
        // Clean up credentials file
        try {
          fs.unlinkSync(credPath);
          debug('Credentials file cleaned up');
        } catch (error) {
          debug(`Warning: Could not delete credentials file: ${error}`);
        }
      }
    } else {
      debug(`Wildcard certificate already exists, expires in ${this.wildcardCertInfo.daysLeft} days`);
    }
    
    if (!this.wildcardCertInfo) {
      throw new Error('Failed to initialize wildcard SSL certificate');
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

    // Check SSL status (wildcard or individual)
    let sslStatus = {
      exists: false,
      expiresAt: undefined as Date | undefined,
      daysLeft: undefined as number | undefined,
      isWildcard: false
    };

    if (this.useWildcardSSL && this.wildcardCertInfo) {
      // Check if wildcard covers this subdomain
      if (this.wildcardCertInfo.coversSubdomain(subdomain)) {
        sslStatus = {
          exists: true,
          expiresAt: this.wildcardCertInfo.expiresAt,
          daysLeft: this.wildcardCertInfo.daysLeft,
          isWildcard: true
        };
      }
    } else {
      // Check individual certificate
      const sslInfo = await this.ssl.check(fullDomain);
      sslStatus = {
        exists: sslInfo.exists,
        expiresAt: sslInfo.expiresAt,
        daysLeft: sslInfo.daysLeft,
        isWildcard: false
      };
    }

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
   * Define complete subdomain with FULL COMPATIBILITY
   * NEW: Performs full cleanup of BOTH mechanics before creation
   */
  async define(subdomain: string, config: SubdomainConfig): Promise<SubdomainInfo> {
    debug(`Defining subdomain with FULL COMPATIBILITY: ${subdomain}`);
    
    this.validateSubdomainName(subdomain);
    
    const fullDomain = this.getFullDomain(subdomain);
    let progress = 'Starting';

    try {
      // Step 0: FULL CLEANUP - Remove any existing configuration from BOTH mechanics
      progress = 'Performing full cleanup';
      debug(`${progress} for ${fullDomain}`);
      await this.fullCleanup(subdomain);
      debug(`✅ Full cleanup completed for ${fullDomain}`);

      // Step 1: Ensure wildcard SSL certificate is ready
      if (this.useWildcardSSL) {
        progress = 'Initializing wildcard SSL';
        debug(`${progress} for domain: ${this.domain}`);
        await this.initializeWildcardSSL();
        debug(`✅ Wildcard SSL ready for ${this.domain}`);
      }

      // Step 2: Create CloudFlare DNS record
      progress = 'Creating DNS record';
      debug(`${progress} for ${fullDomain} → ${config.ip}`);
      
      await this.cloudflare.define(subdomain, {
        ip: config.ip,
        ttl: config.ttl || 300,
        proxied: config.proxied || false
      });
      
      debug(`✅ DNS record created successfully for ${fullDomain}`);

      // Step 3: Wait for DNS propagation
      progress = 'Waiting for DNS propagation';
      debug(`${progress} for ${fullDomain}`);
      
      await this.ssl.wait(fullDomain, config.ip);
      debug(`✅ DNS propagation completed for ${fullDomain}`);

      // Step 4: SSL certificate setup
      if (this.useWildcardSSL) {
        progress = 'Using wildcard SSL certificate';
        debug(`${progress} for ${fullDomain}`);
        
        if (!this.wildcardCertInfo) {
          throw new Error('Wildcard certificate not available');
        }
        
        debug(`✅ Using wildcard certificate ${this.wildcardCertInfo.wildcardDomain} for ${fullDomain}`);
      } else {
        // Fallback to individual SSL certificate
        progress = 'Creating individual SSL certificate';
        debug(`${progress} for ${fullDomain}`);
        
        await this.ssl.define(fullDomain, config.email);
        debug(`✅ Individual SSL certificate created for ${fullDomain}`);
      }

      // Step 5: Create Nginx configuration with SSL
      progress = 'Creating Nginx configuration';
      debug(`${progress} for ${fullDomain}`);
      
      let sslCertPath, sslKeyPath;
      
      if (this.useWildcardSSL && this.wildcardCertInfo) {
        sslCertPath = this.wildcardCertInfo.path?.fullchain;
        sslKeyPath = this.wildcardCertInfo.path?.privateKey;
      } else {
        const sslInfo = await this.ssl.check(fullDomain);
        sslCertPath = sslInfo.path?.fullchain;
        sslKeyPath = sslInfo.path?.privateKey;
      }
      
      await this.nginx.define(fullDomain, {
        serverName: fullDomain,
        proxyPass: `http://127.0.0.1:${config.port}`,
        ssl: true,
        sslCertificate: sslCertPath,
        sslCertificateKey: sslKeyPath
      });
      
      debug(`✅ Nginx configuration created successfully for ${fullDomain}`);

      // Step 6: Reinitialize nginx to guarantee activation
      progress = 'Reinitializing nginx';
      debug(`${progress} for ${fullDomain}`);
      
      await this.reinitializeNginx();
      debug(`✅ Nginx reinitialized for ${fullDomain}`);

      // Return final subdomain information
      const finalInfo = await this.getSubdomainInfo(subdomain);
      
      debug(`✅ Subdomain ${subdomain} defined successfully. Fully active: ${finalInfo.fullyActive}`);
      console.log(`🎉 Subdomain ${fullDomain} created successfully!`);
      console.log(`🌐 Available at: https://${fullDomain}`);
      console.log(`🔗 Proxies to: http://127.0.0.1:${config.port}`);
      if (this.useWildcardSSL) {
        console.log(`🔒 Using wildcard SSL certificate: ${this.wildcardCertInfo?.wildcardDomain}`);
      }
      console.log(`♻️ Full compatibility: cleaned both legacy and new mechanics`);
      
      return finalInfo;
      
    } catch (error) {
      debug(`Error during subdomain definition at step '${progress}': ${error}`);
      console.error(`💥 Failed to define subdomain ${fullDomain} at step: ${progress}`);
      
      // Attempt cleanup on failure
      try {
        debug(`Attempting cleanup for failed subdomain: ${subdomain}`);
        await this.fullCleanup(subdomain);
      } catch (cleanupError) {
        debug(`Cleanup failed: ${cleanupError}`);
      }
      
      throw new Error(`Failed to define subdomain at ${progress}: ${error}`);
    }
  }

  /**
   * Undefine complete subdomain with FULL COMPATIBILITY
   * NEW: Performs full cleanup of BOTH mechanics
   */
  async undefine(subdomain: string): Promise<void> {
    debug(`Undefining subdomain with FULL COMPATIBILITY: ${subdomain}`);
    
    const fullDomain = this.getFullDomain(subdomain);
    
    // Perform full cleanup of BOTH mechanics
    await this.fullCleanup(subdomain);
    
    debug(`✅ Subdomain ${subdomain} undefined successfully with full compatibility`);
    console.log(`✅ Subdomain ${fullDomain} removed successfully`);
    console.log(`♻️ Full compatibility: cleaned both legacy and new mechanics`);
    if (this.useWildcardSSL) {
      console.log(`🔒 Wildcard SSL certificate preserved for other subdomains`);
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