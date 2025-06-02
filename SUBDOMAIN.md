# Subdomain Management

Subdomain Management (`SUBDOMAIN.md`)

This document describes the `SubdomainManager` class and related utilities provided in `lib/subdomain.ts`, which provide integrated subdomain creation with DNS, SSL certificates, and nginx configuration.

## Purpose

The `SubdomainManager` class provides comprehensive subdomain management that:
- Integrates CloudFlare DNS, SSL certificates, and nginx configuration
- Automates the complete subdomain creation workflow
- Provides automatic HTTPS subdomain setup with Let's Encrypt
- Implements define/undefine patterns for idempotent operations
- Handles error scenarios with automatic cleanup

⚠️ **Important**: This module requires proper environment configuration for CloudFlare API, SSL email, and domain settings. Use the assist command to configure all required credentials.

<details>
<summary>Core Exports (`lib/subdomain.ts`)</summary>

* `SubdomainManager`: Main class for integrated subdomain management
* `SubdomainConfig`: Interface for subdomain configuration options
* `SubdomainStatus`: Interface describing subdomain status and health

</details>

## CLI Command 🌐

The easiest way to manage subdomains is through the CLI command:

```bash
# Show help with all subcommands and examples
npx hasyx subdomain --help

# List all DNS records for your domain
npx hasyx subdomain list

# Create subdomain with DNS record only
npx hasyx subdomain define app1 149.102.136.233

# Create full subdomain with DNS, SSL certificate, and Nginx configuration
npx hasyx subdomain define app1 149.102.136.233 3000

# Remove subdomain completely (DNS, SSL, and Nginx)
npx hasyx subdomain undefine app1
```

### CLI Subcommands

**`list`** - List all DNS records for the domain
```bash
npx hasyx subdomain list
# Output:
# 📋 Found 3 DNS record(s):
# ════════════════════════════════════════════════════════════════════════════════
# 🌐 @                    → 149.102.136.233   TTL:300    🔴 Direct
# 🌐 api                  → 149.102.136.233   TTL:300    🔴 Direct  
# 🌐 app                  → 149.102.136.233   TTL:300    🔴 Direct
# ════════════════════════════════════════════════════════════════════════════════
```

**`define <subdomain> <ip> [port]`** - Create subdomain with optional SSL and Nginx
```bash
# DNS record only
npx hasyx subdomain define api 149.102.136.233

# Full HTTPS setup with reverse proxy
npx hasyx subdomain define api 149.102.136.233 8080
# Result: https://api.yourdomain.com → http://127.0.0.1:8080
```

**`undefine <subdomain>`** - Remove subdomain completely
```bash
npx hasyx subdomain undefine api
# Removes: DNS record, SSL certificate, and Nginx configuration
```

### CLI Environment Requirements

The CLI command requires these environment variables:
- `HASYX_DNS_DOMAIN` (or `DOMAIN`) - Your domain name
- `CLOUDFLARE_API_TOKEN` - CloudFlare API token with Zone:Edit permissions
- `CLOUDFLARE_ZONE_ID` - CloudFlare Zone ID for your domain
- `LETSENCRYPT_EMAIL` (optional) - Email for SSL certificates

Configure all variables using:
```bash
npx hasyx assist
```

If environment variables are missing, the CLI will show:
```bash
❌ Missing required environment variables for subdomain management:
   HASYX_DNS_DOMAIN or DOMAIN
   CLOUDFLARE_API_TOKEN
   CLOUDFLARE_ZONE_ID

💡 To configure these variables, run: npx hasyx assist
```

## Core Features

### Integrated Workflow
- **DNS Management**: Automatic CloudFlare DNS record creation
- **SSL Certificates**: Let's Encrypt certificate generation with DNS propagation waiting
- **Wildcard SSL Support**: Efficient wildcard certificates for unlimited subdomains
- **Nginx Configuration**: Automatic nginx site configuration with SSL
- **Complete HTTPS Setup**: End-to-end HTTPS subdomain creation

### Wildcard SSL Optimization
- **Shared Certificates**: Single wildcard certificate covers all subdomains
- **Rate Limit Friendly**: Reduces Let's Encrypt certificate requests
- **DNS-01 Validation**: Uses CloudFlare API for domain validation
- **Automatic Management**: Wildcard certificate creation and renewal

### Compatibility & Migration
- **Full Cleanup Support**: Removes both legacy individual and new wildcard certificates
- **Backward Compatibility**: Handles existing individual certificate setups
- **Safe Migration**: Automatic cleanup prevents SSL conflicts

### Safety and Reliability
- **DNS Propagation Waiting**: Ensures DNS is ready before SSL certificate creation
- **Automatic Cleanup**: Removes partially created resources on failure
- **Idempotent Operations**: Safe operations that handle existing configurations
- **Health Checking**: Verifies all components are properly configured

### Error Handling
- **Graceful Failures**: Automatic cleanup of partial configurations
- **Detailed Logging**: Comprehensive status reporting at each stage
- **Recovery Options**: Ability to retry failed operations

## Prerequisites and Configuration

Before using the SubdomainManager, you must configure the environment:

1. **CloudFlare Account**: Domain must be managed by CloudFlare
2. **API Credentials**: CloudFlare API token and Zone ID
3. **SSL Email**: Email address for Let's Encrypt certificates
4. **System Requirements**: nginx and certbot installed
5. **Domain Configuration**: Primary domain for subdomain management

### Environment Configuration with Assist

⚠️ **Required Setup**: Configure all required credentials and settings:

```bash
npx hasyx assist dns
```

This will configure all required environment variables:
- `HASYX_DNS_DOMAIN`: Your primary domain name
- `CLOUDFLARE_API_TOKEN`: API token with Zone:Edit permissions
- `CLOUDFLARE_ZONE_ID`: Zone ID from CloudFlare dashboard
- `LETSENCRYPT_EMAIL`: Email for SSL certificates

**Example assist session:**
```bash
$ npx hasyx assist dns

🌐 DNS Management Configuration
===============================

Do you want to configure DNS/SSL/Cloudflare management? (y/n): y

Enter your DNS domain (e.g., example.com): yourdomain.com
✅ DNS domain set to: yourdomain.com

☁️ Cloudflare Configuration
============================

Do you want to configure Cloudflare for DNS management? (y/n): y

Enter Cloudflare API Token: your_api_token_here
✅ Cloudflare API Token configured

Enter Cloudflare Zone ID: your_zone_id_here
✅ Cloudflare Zone ID configured

Enter LetsEncrypt email for SSL certificates: admin@yourdomain.com
✅ LetsEncrypt email configured

✅ Cloudflare configuration completed successfully!
💾 Configuration saved to .env file

🎉 DNS management configuration completed!
🚀 You can now use DNS management features:
   • Create subdomains programmatically
   • Manage SSL certificates
   • Configure reverse proxies
   • Automate DNS record management
```

### Manual Environment Configuration

Alternatively, set environment variables manually:

```bash
# Required for subdomain management
HASYX_DNS_DOMAIN=yourdomain.com
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_ZONE_ID=your_zone_id_here
LETSENCRYPT_EMAIL=admin@yourdomain.com

# Optional server IP (defaults to detecting current server IP)
SERVER_IP=149.102.136.233
```

### Environment Variables Usage

```typescript
import { SubdomainManager } from 'hasyx';

// Recommended: Use environment variables
const subdomainManager = new SubdomainManager({
  domain: process.env.HASYX_DNS_DOMAIN!,
  cloudflare: {
    apiToken: process.env.CLOUDFLARE_API_TOKEN!,
    zoneId: process.env.CLOUDFLARE_ZONE_ID!,
    domain: process.env.HASYX_DNS_DOMAIN!
  },
  ssl: {
    email: process.env.LETSENCRYPT_EMAIL!
  },
  defaultIp: process.env.SERVER_IP || '149.102.136.233'
});

// Verify configuration
const requiredVars = [
  'HASYX_DNS_DOMAIN',
  'CLOUDFLARE_API_TOKEN', 
  'CLOUDFLARE_ZONE_ID',
  'LETSENCRYPT_EMAIL'
];

for (const varName of requiredVars) {
  if (!process.env[varName]) {
    console.error(`${varName} not configured. Run: npx hasyx assist dns`);
    process.exit(1);
  }
}

console.log(`SubdomainManager configured for domain: ${process.env.HASYX_DNS_DOMAIN}`);
```

## Usage

### Basic Usage

```typescript
import { SubdomainManager, CloudFlare, SSL, Nginx } from 'hasyx';

// Create SubdomainManager with wildcard SSL support (default)
const subdomainManager = new SubdomainManager({
  nginx: new Nginx(),
  ssl: new SSL({ email: process.env.LETSENCRYPT_EMAIL }),
  cloudflare: new CloudFlare({
    apiToken: process.env.CLOUDFLARE_API_TOKEN!,
    zoneId: process.env.CLOUDFLARE_ZONE_ID!,
    domain: process.env.HASYX_DNS_DOMAIN!
  }),
  useWildcardSSL: true // Default: uses efficient wildcard certificates
});

// Create subdomain with HTTPS using wildcard certificate
await subdomainManager.define('app', {
  ip: '149.102.136.233',
  port: 3000
});

// Check subdomain status
const info = await subdomainManager.getSubdomainInfo('app');
console.log(`HTTPS subdomain: https://${info.fullDomain}`);
console.log(`SSL type: ${info.sslStatus.isWildcard ? 'Wildcard' : 'Individual'}`);
console.log(`SSL expires: ${info.sslStatus.expiresAt}, Days left: ${info.sslStatus.daysLeft}`);
```

### Environment-Based Configuration

```typescript
import { SubdomainManager, CloudFlare, SSL, Nginx } from 'hasyx';

// Verify environment variables are configured
function validateEnvironment() {
  const requiredVars = {
    domain: process.env.HASYX_DNS_DOMAIN || process.env.DOMAIN,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
    zoneId: process.env.CLOUDFLARE_ZONE_ID,
    email: process.env.LETSENCRYPT_EMAIL
  };

  const missing = Object.entries(requiredVars)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    console.log('💡 Run: npx hasyx assist dns');
    process.exit(1);
  }

  return requiredVars;
}

function createSubdomainManager() {
  const requiredVars = validateEnvironment();
  
  return new SubdomainManager({
    nginx: new Nginx(),
    ssl: new SSL({ 
      email: requiredVars.email!,
      staging: process.env.NODE_ENV !== 'production' // Use staging for development
    }),
    cloudflare: new CloudFlare({
      apiToken: requiredVars.apiToken!,
      zoneId: requiredVars.zoneId!,
      domain: requiredVars.domain!
    }),
    useWildcardSSL: true // Enable efficient wildcard SSL certificates
  });
}

const subdomainManager = createSubdomainManager();
console.log('SubdomainManager ready with wildcard SSL support');
```

### Advanced Usage - Wildcard SSL Benefits

```typescript
import { SubdomainManager } from 'hasyx';

const subdomainManager = new SubdomainManager({
  nginx: new Nginx(),
  ssl: new SSL({ email: process.env.LETSENCRYPT_EMAIL }),
  cloudflare: new CloudFlare({
    apiToken: process.env.CLOUDFLARE_API_TOKEN!,
    zoneId: process.env.CLOUDFLARE_ZONE_ID!,
    domain: process.env.HASYX_DNS_DOMAIN!
  }),
  useWildcardSSL: true // Single wildcard certificate covers all subdomains
});

// Create multiple subdomains efficiently - they all share the same wildcard certificate
const subdomains = [
  { name: 'app', port: 3000, description: 'Main application' },
  { name: 'api', port: 4000, description: 'API backend' },
  { name: 'admin', port: 5000, description: 'Admin panel' },
  { name: 'docs', port: 6000, description: 'Documentation' },
  { name: 'staging', port: 7000, description: 'Staging environment' },
  { name: 'dev', port: 8000, description: 'Development environment' }
];

console.log('🌟 Creating subdomains with wildcard SSL (efficient & fast)');

// First subdomain will create the wildcard certificate (takes 1-2 minutes)
console.log('Creating first subdomain (will generate wildcard certificate)...');
await subdomainManager.define(subdomains[0].name, {
  ip: '149.102.136.233',
  port: subdomains[0].port
});
console.log(`✅ ${subdomains[0].description}: https://${subdomains[0].name}.${process.env.HASYX_DNS_DOMAIN}`);

// Subsequent subdomains reuse the wildcard certificate (very fast)
console.log('Creating remaining subdomains (reusing wildcard certificate)...');
for (let i = 1; i < subdomains.length; i++) {
  const subdomain = subdomains[i];
  
  await subdomainManager.define(subdomain.name, {
    ip: '149.102.136.233',
    port: subdomain.port
  });
  
  console.log(`✅ ${subdomain.description}: https://${subdomain.name}.${process.env.HASYX_DNS_DOMAIN}`);
}

console.log('🎉 All subdomains created with shared wildcard SSL certificate!');
console.log('💡 Benefits: Fast creation, reduced Let\'s Encrypt rate limits, easy management');
```

## Configuration Options

### SubdomainConfig Interface

```typescript
interface SubdomainConfig {
  port: number;              // Local port for reverse proxy
  ip?: string;               // IP address (defaults to manager's defaultIp)
  ssl?: boolean;             // Enable SSL (default: true)
  proxied?: boolean;         // CloudFlare proxy (default: false)
  ttl?: number;              // DNS TTL in seconds (default: 300)
  customNginxConfig?: string; // Custom nginx configuration
}
```

### SubdomainManagerConfig Interface

```typescript
interface SubdomainManagerConfig {
  domain: string;            // Primary domain name
  cloudflare: {             // CloudFlare configuration
    apiToken: string;
    zoneId: string;
    domain: string;
  };
  ssl: {                    // SSL configuration
    email: string;
  };
  defaultIp: string;        // Default IP for subdomains
  nginx?: {                 // Optional nginx configuration
    sitesAvailablePath?: string;
    sitesEnabledPath?: string;
  };
}
```

### Environment Variables

```bash
# Required
HASYX_DNS_DOMAIN=yourdomain.com
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_ZONE_ID=your_zone_id_here
LETSENCRYPT_EMAIL=admin@yourdomain.com

# Optional
SERVER_IP=149.102.136.233
```

## Core Methods

### Subdomain Operations

#### `define(subdomain: string, config: SubdomainConfig): Promise<void>`
Creates complete HTTPS subdomain (DNS + SSL + Nginx). Safe operation that won't fail if subdomain already exists.

```typescript
// Create complete HTTPS subdomain
await subdomainManager.define('app', {
  port: 3000,
  ip: '149.102.136.233'
});

// Subdomain with custom configuration
await subdomainManager.define('api', {
  port: 4000,
  ssl: true,
  proxied: false,
  ttl: 600,
  customNginxConfig: `
location /health {
    return 200 "healthy";
    add_header Content-Type text/plain;
}
`
});
```

#### `undefine(subdomain: string): Promise<void>`
Removes subdomain completely (DNS + SSL + Nginx). Safe operation that won't fail if subdomain doesn't exist.

```typescript
// Safe removal - won't fail if subdomain doesn't exist
await subdomainManager.undefine('app');
console.log('Subdomain removed completely');
```

#### `list(): Promise<string[]>`
Returns list of active subdomains (only subdomains with complete DNS + SSL + Nginx configuration).

```typescript
const activeSubdomains = await subdomainManager.list();
console.log(`Active subdomains: ${activeSubdomains.join(', ')}`);

// Check each subdomain status
for (const subdomain of activeSubdomains) {
  const status = await subdomainManager.status(subdomain);
  console.log(`${subdomain}: DNS=${status.dns}, SSL=${status.ssl}, Nginx=${status.nginx}`);
}
```

#### `status(subdomain: string): Promise<SubdomainStatus>`
Returns detailed status of subdomain components.

```typescript
const status = await subdomainManager.status('app');
console.log(`DNS Record: ${status.dns ? 'exists' : 'missing'}`);
console.log(`SSL Certificate: ${status.ssl ? 'valid' : 'missing'}`);
console.log(`Nginx Configuration: ${status.nginx ? 'configured' : 'missing'}`);
console.log(`HTTPS Working: ${status.https ? 'yes' : 'no'}`);

if (status.sslExpiry) {
  const daysLeft = Math.ceil((status.sslExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  console.log(`SSL expires in ${daysLeft} days`);
}
```

## Workflow Details

### Complete Subdomain Creation Process

When you call `define()`, the SubdomainManager executes this workflow:

1. **DNS Record Creation**: Creates CloudFlare A record pointing to specified IP
2. **DNS Propagation Wait**: Waits for DNS to propagate globally (up to 2 minutes)
3. **SSL Certificate Creation**: Obtains Let's Encrypt certificate via certbot
4. **Nginx Configuration**: Creates nginx site with SSL and reverse proxy
5. **Nginx Reload**: Reloads nginx to activate the new configuration

```typescript
// This single call handles the entire workflow:
await subdomainManager.define('app', { port: 3000 });

// Equivalent to manual workflow:
// 1. cloudflare.define('app', { ip: '149.102.136.233' })
// 2. ssl.wait('app.yourdomain.com', '149.102.136.233')
// 3. ssl.define('app.yourdomain.com')
// 4. nginx.define('app.yourdomain.com', { ... })
```

### Error Handling and Cleanup

If any step fails, the SubdomainManager automatically cleans up partial configurations:

```typescript
try {
  await subdomainManager.define('app', { port: 3000 });
} catch (error) {
  // Automatic cleanup has already been performed:
  // - DNS record removed if created
  // - SSL certificate removed if created  
  // - Nginx configuration removed if created
  console.error('Subdomain creation failed:', error.message);
  
  // You can safely retry
  await subdomainManager.define('app', { port: 3000 });
}
```

## Integration Examples

### With Express.js Application

```typescript
import express from 'express';
import { SubdomainManager } from 'hasyx';

const app = express();
const PORT = 3000;

app.get('/', (req, res) => {
  res.json({ message: 'Hello from subdomain!', host: req.headers.host });
});

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  // Create subdomain pointing to this app
  const subdomainManager = new SubdomainManager({
    domain: process.env.HASYX_DNS_DOMAIN!,
    cloudflare: {
      apiToken: process.env.CLOUDFLARE_API_TOKEN!,
      zoneId: process.env.CLOUDFLARE_ZONE_ID!,
      domain: process.env.HASYX_DNS_DOMAIN!
    },
    ssl: { email: process.env.LETSENCRYPT_EMAIL! },
    defaultIp: '149.102.136.233'
  });

  await subdomainManager.define('myapp', { port: PORT });
  console.log(`🚀 App available at: https://myapp.${process.env.HASYX_DNS_DOMAIN}`);
});
```

### Multi-Service Deployment

```typescript
import { SubdomainManager } from 'hasyx';

const subdomainManager = new SubdomainManager({
  domain: process.env.HASYX_DNS_DOMAIN!,
  cloudflare: {
    apiToken: process.env.CLOUDFLARE_API_TOKEN!,
    zoneId: process.env.CLOUDFLARE_ZONE_ID!,
    domain: process.env.HASYX_DNS_DOMAIN!
  },
  ssl: { email: process.env.LETSENCRYPT_EMAIL! },
  defaultIp: '149.102.136.233'
});

// Deploy multiple services
const services = [
  { name: 'frontend', port: 3000, repo: 'https://github.com/user/frontend' },
  { name: 'backend', port: 4000, repo: 'https://github.com/user/backend' },
  { name: 'docs', port: 5000, repo: 'https://github.com/user/docs' }
];

async function deployServices() {
  for (const service of services) {
    console.log(`Deploying ${service.name}...`);
    
    // Create subdomain
    await subdomainManager.define(service.name, {
      port: service.port,
      ip: '149.102.136.233'
    });
    
    console.log(`✅ ${service.name} deployed: https://${service.name}.${process.env.HASYX_DNS_DOMAIN}`);
  }
  
  console.log('🎉 All services deployed successfully!');
}

deployServices();
```

## SubdomainStatus Structure

```typescript
interface SubdomainStatus {
  subdomain: string;         // Subdomain name
  domain: string;            // Full domain name
  dns: boolean;              // DNS record exists
  ssl: boolean;              // SSL certificate exists and valid
  nginx: boolean;            // Nginx configuration exists
  https: boolean;            // HTTPS is working end-to-end
  ip?: string;               // Current IP address
  port?: number;             // Configured port
  sslExpiry?: Date;          // SSL certificate expiration
  lastChecked: Date;         // When status was last checked
}
```

## Error Handling

### Common Error Scenarios

```typescript
import { SubdomainManager } from 'hasyx';

const subdomainManager = new SubdomainManager({
  domain: process.env.HASYX_DNS_DOMAIN!,
  cloudflare: {
    apiToken: process.env.CLOUDFLARE_API_TOKEN!,
    zoneId: process.env.CLOUDFLARE_ZONE_ID!,
    domain: process.env.HASYX_DNS_DOMAIN!
  },
  ssl: { email: process.env.LETSENCRYPT_EMAIL! },
  defaultIp: '149.102.136.233'
});

try {
  await subdomainManager.define('app', { port: 3000 });
} catch (error) {
  if (error.message.includes('DNS propagation timeout')) {
    console.log('DNS propagation took too long, retrying...');
    await subdomainManager.define('app', { port: 3000 });
  } else if (error.message.includes('Certificate creation failed')) {
    console.log('SSL certificate creation failed, check certbot and domain');
  } else if (error.message.includes('Nginx configuration')) {
    console.log('Nginx configuration failed, check nginx service');
  } else if (error.message.includes('not configured')) {
    console.log('Environment not configured. Run: npx hasyx assist dns');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Configuration Validation

```typescript
function validateEnvironment() {
  const required = [
    'HASYX_DNS_DOMAIN',
    'CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_ZONE_ID', 
    'LETSENCRYPT_EMAIL'
  ];
  
  const missing = required.filter(var_name => !process.env[var_name]);
  
  if (missing.length > 0) {
    console.error(`Missing environment variables: ${missing.join(', ')}`);
    console.error('Run: npx hasyx assist dns');
    process.exit(1);
  }
  
  console.log('✅ Environment configuration valid');
}

validateEnvironment();
```

## Best Practices

### 1. Use Environment Configuration

```typescript
// ✅ GOOD: Environment-based configuration
const subdomainManager = new SubdomainManager({
  domain: process.env.HASYX_DNS_DOMAIN!,
  cloudflare: {
    apiToken: process.env.CLOUDFLARE_API_TOKEN!,
    zoneId: process.env.CLOUDFLARE_ZONE_ID!,
    domain: process.env.HASYX_DNS_DOMAIN!
  },
  ssl: { email: process.env.LETSENCRYPT_EMAIL! },
  defaultIp: process.env.SERVER_IP || '149.102.136.233'
});

// ❌ AVOID: Hardcoded configuration
const subdomainManager = new SubdomainManager({
  domain: 'example.com',
  cloudflare: {
    apiToken: 'hardcoded_token',
    zoneId: 'hardcoded_zone',
    domain: 'example.com'
  },
  ssl: { email: 'admin@example.com' },
  defaultIp: '149.102.136.233'
});
```

### 2. Always Use Define/Undefine

```typescript
// ✅ GOOD: Safe operations
await subdomainManager.define('app', { port: 3000 });    // Won't fail if exists
await subdomainManager.undefine('app');                  // Won't fail if missing

// ❌ AVOID: Manual component management
await cloudflare.create('app', { ip: '149.102.136.233' }); // May fail if exists
await ssl.create('app.example.com');                       // May fail if exists
await nginx.create('app.example.com', { ... });           // May fail if exists
```

### 3. Check Status Before Operations

```typescript
// Check subdomain status before modifications
const status = await subdomainManager.status('app');
if (status.https) {
  console.log('Subdomain is fully operational');
} else {
  console.log('Subdomain needs attention:');
  console.log(`  DNS: ${status.dns ? '✅' : '❌'}`);
  console.log(`  SSL: ${status.ssl ? '✅' : '❌'}`);
  console.log(`  Nginx: ${status.nginx ? '✅' : '❌'}`);
}
```

### 4. Monitor SSL Expiration

```typescript
// Regular SSL certificate monitoring
const subdomains = await subdomainManager.list();

for (const subdomain of subdomains) {
  const status = await subdomainManager.status(subdomain);
  
  if (status.sslExpiry) {
    const daysLeft = Math.ceil((status.sslExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    if (daysLeft < 30) {
      console.log(`⚠️  SSL certificate for ${subdomain} expires in ${daysLeft} days`);
      // Trigger renewal process
    }
  }
}
```

## Troubleshooting

### Common Issues

**Environment not configured:**
```bash
# Configure all required variables
npx hasyx assist dns

# Verify configuration
echo "Domain: $HASYX_DNS_DOMAIN"
echo "CloudFlare Token: ${CLOUDFLARE_API_TOKEN:0:10}..."
echo "Zone ID: ${CLOUDFLARE_ZONE_ID:0:10}..."
echo "Email: $LETSENCRYPT_EMAIL"
```

**DNS propagation timeout:**
```typescript
// Increase DNS propagation timeout
await subdomainManager.define('app', { 
  port: 3000,
  // DNS propagation can take longer for some domains
  maxDnsPropagationAttempts: 20  // Wait up to 3+ minutes
});
```

**SSL certificate creation fails:**
```bash
# Check certbot installation and nginx
sudo apt install certbot python3-certbot-nginx

# Check nginx configuration
sudo nginx -t

# Check domain accessibility
curl -I http://yourdomain.com
```

**Nginx configuration issues:**
```bash
# Check nginx service status
sudo systemctl status nginx

# Check nginx error logs
sudo tail -f /var/log/nginx/error.log

# Restart nginx if needed
sudo systemctl restart nginx
```

**Port conflicts:**
```typescript
// Check if port is available before creating subdomain
const isPortAvailable = (port) => {
  return new Promise((resolve) => {
    const server = require('net').createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on('error', () => resolve(false));
  });
};

if (await isPortAvailable(3000)) {
  await subdomainManager.define('app', { port: 3000 });
} else {
  console.error('Port 3000 is already in use');
}
```

See [CLOUDFLARE.md](CLOUDFLARE.md), [SSL.md](SSL.md), and [NGINX.md](NGINX.md) for detailed information about individual components. 