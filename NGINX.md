# Nginx Configuration Management

Nginx Configuration Management (`NGINX.md`)

This document describes the `Nginx` class and related utilities provided in `lib/nginx.ts`, which enable automated nginx server configuration management with SSL support and automatic path detection.

## Purpose

The `Nginx` class provides comprehensive nginx configuration management that:
- Automatically detects nginx installation paths across different distributions
- Manages site configurations with SSL and reverse proxy support
- Provides automatic nginx testing and reloading
- Implements define/undefine patterns for idempotent operations
- Supports both sites-available/sites-enabled and direct configuration patterns

⚠️ **Important**: This module works with existing nginx installations and does not require additional assist configuration beyond having nginx installed and proper system permissions.

<details>
<summary>Core Exports (`lib/nginx.ts`)</summary>

* `Nginx`: Main class for nginx configuration management
* `NginxConfig`: Interface for nginx path configuration
* `SiteConfig`: Interface describing site configuration options

</details>

## Core Features

### Path Auto-Detection
- **Cross-Platform Support**: Works with Ubuntu/Debian, CentOS/RHEL, FreeBSD, macOS
- **Configuration Detection**: Automatically finds nginx configuration directories
- **Symlink Management**: Handles both sites-available/enabled and direct config patterns

### Site Management
- **SSL Support**: Automatic SSL configuration with Let's Encrypt certificates
- **Reverse Proxy**: Built-in reverse proxy configuration with WebSocket support
- **Custom Configurations**: Support for custom nginx directives and configurations

### Safety Features
- **Configuration Testing**: Automatic nginx configuration validation before applying
- **Atomic Operations**: Safe configuration updates with rollback on failure
- **Idempotent Operations**: Define/undefine patterns that handle existing configurations

## Prerequisites

Before using the Nginx module:

1. **Install nginx**: System must have nginx installed and running
2. **Proper permissions**: User must have write access to nginx configuration directories
3. **Service management**: System must support nginx service control (systemctl/service)

```bash
# Ubuntu/Debian
sudo apt install nginx

# CentOS/RHEL
sudo yum install nginx

# macOS
brew install nginx
```

## Usage

### Basic Usage

```typescript
import { Nginx } from 'hasyx';

// Create nginx manager instance (auto-detects paths)
const nginx = new Nginx();

// Create basic HTTP site
await nginx.create('example.com', {
  serverName: 'example.com',
  listen: 80,
  proxyPass: 'http://localhost:3000'
});

// Get site configuration
const config = await nginx.get('example.com');
console.log(`Site server name: ${config?.serverName}`);
```

### Custom Path Configuration

```typescript
import { Nginx } from 'hasyx';

// Explicit path configuration
const nginx = new Nginx({
  sitesAvailablePath: '/etc/nginx/sites-available',
  sitesEnabledPath: '/etc/nginx/sites-enabled'
});

// Or for distributions that use conf.d
const nginx = new Nginx({
  sitesAvailablePath: '/etc/nginx/conf.d',
  sitesEnabledPath: '/etc/nginx/conf.d'
});
```

### SSL Configuration

```typescript
import { Nginx } from 'hasyx';

const nginx = new Nginx();

// Create HTTPS site with SSL certificates
await nginx.create('secure.example.com', {
  serverName: 'secure.example.com',
  ssl: true,
  sslCertificate: '/etc/letsencrypt/live/secure.example.com/fullchain.pem',
  sslCertificateKey: '/etc/letsencrypt/live/secure.example.com/privkey.pem',
  proxyPass: 'http://localhost:3000'
});
```

## Configuration Options

### NginxConfig Interface

```typescript
interface NginxConfig {
  sitesAvailablePath?: string;  // Path to sites-available directory
  sitesEnabledPath?: string;    // Path to sites-enabled directory
}
```

### SiteConfig Interface

```typescript
interface SiteConfig {
  serverName: string;           // Server name (domain)
  listen?: number;              // Port to listen on (default: 80)
  proxyPass?: string;           // Reverse proxy target URL
  ssl?: boolean;                // Enable SSL configuration
  sslCertificate?: string;      // Path to SSL certificate
  sslCertificateKey?: string;   // Path to SSL private key
  customConfig?: string;        // Custom nginx configuration directives
}
```

## Core Methods

### Site Information

#### `get(siteName: string): Promise<SiteConfig | null>`
Returns site configuration or null if site doesn't exist.

```typescript
const config = await nginx.get('example.com');
if (config) {
  console.log(`Server name: ${config.serverName}`);
  console.log(`Listen port: ${config.listen}`);
  console.log(`Proxy pass: ${config.proxyPass}`);
  console.log(`SSL enabled: ${config.ssl}`);
} else {
  console.log('Site configuration does not exist');
}
```

#### `list(): Promise<string[]>`
Returns list of all configured site names.

```typescript
const sites = await nginx.list();
console.log(`Configured sites: ${sites.join(', ')}`);

// Process each site
for (const siteName of sites) {
  const config = await nginx.get(siteName);
  console.log(`${siteName}: ${config?.ssl ? 'HTTPS' : 'HTTP'}`);
}
```

### Site Operations

#### `create(siteName: string, config: SiteConfig): Promise<void>`
Creates new site configuration. Throws error if site already exists.

```typescript
try {
  await nginx.create('newsite.example.com', {
    serverName: 'newsite.example.com',
    listen: 80,
    proxyPass: 'http://localhost:4000'
  });
  console.log('Site created successfully');
} catch (error) {
  console.error('Site creation failed:', error);
}
```

#### `delete(siteName: string): Promise<void>`
Deletes site configuration. Throws error if site doesn't exist.

```typescript
try {
  await nginx.delete('oldsite.example.com');
  console.log('Site deleted successfully');
} catch (error) {
  console.error('Site deletion failed:', error);
}
```

### Idempotent Operations

#### `define(siteName: string, config: SiteConfig): Promise<void>`
Ensures site exists with specified configuration (creates or updates).

```typescript
// Safe operation - won't fail if site already exists
await nginx.define('app.example.com', {
  serverName: 'app.example.com',
  ssl: true,
  sslCertificate: '/etc/letsencrypt/live/app.example.com/fullchain.pem',
  sslCertificateKey: '/etc/letsencrypt/live/app.example.com/privkey.pem',
  proxyPass: 'http://localhost:3000'
});
console.log('Site is now defined');
```

#### `undefine(siteName: string): Promise<void>`
Ensures site doesn't exist (deletes if exists, succeeds if missing).

```typescript
// Safe operation - won't fail if site doesn't exist
await nginx.undefine('app.example.com');
console.log('Site is now undefined');
```

### Enable/Disable Operations

#### `isEnabled(siteName: string): Promise<boolean>`
Checks if site is enabled (relevant for sites-available/enabled pattern).

```typescript
const enabled = await nginx.isEnabled('example.com');
console.log(`Site enabled: ${enabled}`);
```

#### `enable(siteName: string): Promise<void>`
Enables site (creates symlink if using sites-available/enabled pattern).

```typescript
await nginx.enable('example.com');
console.log('Site enabled');
```

#### `disable(siteName: string): Promise<void>`
Disables site (removes symlink if using sites-available/enabled pattern).

```typescript
await nginx.disable('example.com');
console.log('Site disabled');
```

## Configuration Examples

### Basic HTTP Reverse Proxy

```typescript
await nginx.define('api.example.com', {
  serverName: 'api.example.com',
  listen: 80,
  proxyPass: 'http://localhost:4000'
});
```

### HTTPS with SSL Certificates

```typescript
await nginx.define('secure.example.com', {
  serverName: 'secure.example.com',
  ssl: true,
  sslCertificate: '/etc/letsencrypt/live/secure.example.com/fullchain.pem',
  sslCertificateKey: '/etc/letsencrypt/live/secure.example.com/privkey.pem',
  proxyPass: 'http://localhost:3000'
});
```

### Custom Configuration with Multiple Locations

```typescript
await nginx.define('complex.example.com', {
  serverName: 'complex.example.com',
  ssl: true,
  sslCertificate: '/etc/letsencrypt/live/complex.example.com/fullchain.pem',
  sslCertificateKey: '/etc/letsencrypt/live/complex.example.com/privkey.pem',
  customConfig: `
location /api/ {
    proxy_pass http://backend-api/;
    proxy_set_header X-API-Key $http_x_api_key;
}

location /static/ {
    root /var/www/static;
    expires 1y;
    add_header Cache-Control "public, immutable";
}

location /ws/ {
    proxy_pass http://websocket-server/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
`
});
```

## Integration with Other Modules

### With SSL Management

```typescript
import { Nginx, SSL } from 'hasyx';

const nginx = new Nginx();
const ssl = new SSL();

// Create SSL certificate first
await ssl.define('app.example.com');

// Get certificate paths
const certInfo = await ssl.get('app.example.com');

// Configure nginx with SSL
await nginx.define('app.example.com', {
  serverName: 'app.example.com',
  ssl: true,
  sslCertificate: certInfo?.path?.fullchain,
  sslCertificateKey: certInfo?.path?.privateKey,
  proxyPass: 'http://localhost:3000'
});
```

### With CloudFlare DNS

```typescript
import { Nginx, CloudFlare, SSL } from 'hasyx';

const nginx = new Nginx();
const cloudflare = new CloudFlare({
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
  zoneId: process.env.CLOUDFLARE_ZONE_ID!,
  domain: 'example.com'
});
const ssl = new SSL();

async function createSecureSubdomain(subdomain: string, port: number) {
  const domain = `${subdomain}.example.com`;
  const ip = '149.102.136.233';
  
  // 1. Create DNS record
  await cloudflare.define(subdomain, { ip });
  
  // 2. Wait for DNS propagation
  await ssl.wait(domain, ip);
  
  // 3. Create SSL certificate
  await ssl.define(domain);
  
  // 4. Configure nginx with SSL
  const certInfo = await ssl.get(domain);
  await nginx.define(domain, {
    serverName: domain,
    ssl: true,
    sslCertificate: certInfo?.path?.fullchain,
    sslCertificateKey: certInfo?.path?.privateKey,
    proxyPass: `http://localhost:${port}`
  });
  
  console.log(`✅ Secure subdomain created: https://${domain}`);
}

await createSecureSubdomain('app', 3000);
await createSecureSubdomain('api', 4000);
```

## Generated Configuration

### HTTP Only Configuration

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name example.com;

    location / {
        proxy_pass http://localhost:3000;
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
}
```

### HTTPS with Redirect Configuration

```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name secure.example.com;

    ssl_certificate /etc/letsencrypt/live/secure.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/secure.example.com/privkey.pem;
    
    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    location / {
        proxy_pass http://localhost:3000;
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
}

# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name secure.example.com;
    
    return 301 https://$host$request_uri;
}
```

## Path Detection Logic

The Nginx class automatically detects configuration paths in this order:

1. **From nginx -V output**: Extracts `--conf-path` and derives directories
2. **Common distribution paths**:
   - Ubuntu/Debian: `/etc/nginx/sites-available`, `/etc/nginx/sites-enabled`
   - CentOS/RHEL: `/etc/nginx/conf.d`
   - FreeBSD: `/usr/local/etc/nginx/sites-available`
   - macOS Homebrew: `/usr/local/etc/nginx/sites-available`
3. **Fallback**: Default Ubuntu/Debian paths

### Supported Distributions

| Distribution | Sites Available | Sites Enabled | Symlinks |
|-------------|----------------|---------------|----------|
| Ubuntu/Debian | `/etc/nginx/sites-available` | `/etc/nginx/sites-enabled` | ✅ |
| CentOS/RHEL | `/etc/nginx/conf.d` | `/etc/nginx/conf.d` | ❌ |
| FreeBSD | `/usr/local/etc/nginx/sites-available` | `/usr/local/etc/nginx/sites-enabled` | ✅ |
| macOS (Homebrew) | `/usr/local/etc/nginx/sites-available` | `/usr/local/etc/nginx/sites-enabled` | ✅ |

## Error Handling

### Common Error Scenarios

```typescript
import { Nginx } from 'hasyx';

const nginx = new Nginx();

try {
  await nginx.create('example.com', {
    serverName: 'example.com',
    proxyPass: 'http://localhost:3000'
  });
} catch (error) {
  if (error.message.includes('already exists')) {
    console.log('Site already exists - use define() instead');
    await nginx.define('example.com', {
      serverName: 'example.com',
      proxyPass: 'http://localhost:3000'
    });
  } else if (error.message.includes('configuration test failed')) {
    console.log('Invalid nginx configuration generated');
  } else if (error.message.includes('Failed to reload nginx')) {
    console.log('Nginx reload failed - check service status');
  } else {
    console.error('Unexpected nginx error:', error);
  }
}
```

### Configuration Validation

The module automatically validates nginx configurations before applying them:

```typescript
// Configuration is tested with 'nginx -t' before being applied
await nginx.create('test.example.com', {
  serverName: 'test.example.com',
  proxyPass: 'invalid://url'  // This will fail validation
});
// Throws: "Nginx configuration test failed"
```

## Best Practices

### 1. Use Define/Undefine for Idempotency

```typescript
// ✅ GOOD: Safe operations
await nginx.define('app.example.com', config);    // Won't fail if exists
await nginx.undefine('app.example.com');          // Won't fail if missing

// ❌ AVOID: May fail
await nginx.create('app.example.com', config);    // Fails if exists
await nginx.delete('app.example.com');            // Fails if missing
```

### 2. Always Use SSL in Production

```typescript
// ✅ GOOD: HTTPS with proper SSL configuration
await nginx.define('app.example.com', {
  serverName: 'app.example.com',
  ssl: true,
  sslCertificate: '/etc/letsencrypt/live/app.example.com/fullchain.pem',
  sslCertificateKey: '/etc/letsencrypt/live/app.example.com/privkey.pem',
  proxyPass: 'http://localhost:3000'
});

// ❌ AVOID: HTTP only in production
await nginx.define('app.example.com', {
  serverName: 'app.example.com',
  listen: 80,
  proxyPass: 'http://localhost:3000'
});
```

### 3. Configure Proper Proxy Headers

The module automatically includes essential proxy headers:
- `Host`: Preserves original host header
- `X-Real-IP`: Client's real IP address
- `X-Forwarded-For`: Proxy chain information
- `X-Forwarded-Proto`: Original protocol (http/https)
- WebSocket support headers

### 4. Use Custom Configuration for Complex Setups

```typescript
await nginx.define('complex.example.com', {
  serverName: 'complex.example.com',
  ssl: true,
  sslCertificate: '/path/to/cert.pem',
  sslCertificateKey: '/path/to/key.pem',
  customConfig: `
# Custom rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

location /api/ {
    limit_req zone=api burst=20 nodelay;
    proxy_pass http://api-backend/;
}

location /uploads/ {
    client_max_body_size 100M;
    proxy_pass http://upload-backend/;
}
`
});
```

## Security Considerations

### SSL Configuration
- Uses modern SSL protocols (TLSv1.2, TLSv1.3)
- Secure cipher suites with forward secrecy
- Proper session caching and timeout settings
- Automatic HTTP to HTTPS redirects

### Proxy Security
- Proper header forwarding prevents IP spoofing
- WebSocket upgrade security
- Request timeout protection
- No server version disclosure

### File Permissions
- Configuration files created with appropriate permissions
- Symlink security in sites-enabled directories
- Validation prevents arbitrary file inclusion

## Troubleshooting

### Common Issues

**Nginx not found:**
```bash
# Check if nginx is installed
nginx -v

# Install if missing
sudo apt install nginx  # Ubuntu/Debian
sudo yum install nginx  # CentOS/RHEL
brew install nginx      # macOS
```

**Configuration test fails:**
```bash
# Test configuration manually
sudo nginx -t

# Check nginx error logs
sudo tail -f /var/log/nginx/error.log
```

**Permission denied:**
```bash
# Ensure user has proper permissions
sudo chown -R $USER:$USER /etc/nginx/sites-available
sudo chmod 755 /etc/nginx/sites-available

# Or run with appropriate privileges
```

**Service reload fails:**
```bash
# Check nginx service status
sudo systemctl status nginx

# Start nginx if stopped
sudo systemctl start nginx

# Enable nginx auto-start
sudo systemctl enable nginx
```

See [SSL.md](SSL.md) and [CLOUDFLARE.md](CLOUDFLARE.md) for integration with SSL certificates and DNS management. 