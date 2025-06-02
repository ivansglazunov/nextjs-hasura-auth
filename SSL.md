# SSL Certificate Management

SSL Certificate Management (`SSL.md`)

This document describes the `SSL` class and related utilities provided in `lib/ssl.ts`, which enable automated SSL certificate management using Let's Encrypt and certbot with support for both individual and wildcard certificates.

## Purpose

The `SSL` class provides comprehensive SSL certificate management that:
- Automatically creates SSL certificates using Let's Encrypt via certbot
- **Supports wildcard certificates** using DNS-01 validation with CloudFlare
- Manages certificate lifecycle (creation, deletion, renewal)
- Provides DNS propagation waiting functionality
- Supports both define/undefine patterns for idempotent operations
- Integrates seamlessly with nginx and CloudFlare DNS management

⚠️ **Important**: This module requires proper environment configuration. Use the assist command to configure required environment variables.

<details>
<summary>Core Exports (`lib/ssl.ts`)</summary>

* `SSL`: Main class for SSL certificate management
* `SSLConfig`: Interface for SSL configuration options
* `CertificateInfo`: Interface describing individual certificate information and status
* `WildcardCertificateInfo`: Interface describing wildcard certificate information and coverage
* `DNSPropagationResult`: Interface for DNS propagation check results

</details>

## Core Features

### Certificate Management
- **Individual Certificates**: Standard SSL certificates for specific domains
- **Wildcard Certificates**: Covers all subdomains under a domain (*.example.com)
- **DNS-01 Validation**: Uses CloudFlare DNS API for domain validation
- **Automatic Renewal**: Certificate renewal based on expiration date
- **Status Checking**: Certificate existence and expiration monitoring

### Wildcard SSL Support
- **DNS-01 Challenge**: Automatic CloudFlare DNS challenge creation/cleanup
- **Subdomain Coverage**: Wildcard certificates cover unlimited subdomains
- **Rate Limit Friendly**: Reduces Let's Encrypt rate limit usage
- **Production Ready**: Suitable for high-scale subdomain management

### DNS Integration
- **Propagation Waiting**: Automatic DNS propagation checking before certificate creation
- **Multiple DNS Servers**: Uses Google DNS (8.8.8.8) for reliable checking
- **Configurable Timeouts**: Adjustable wait times and retry attempts

### Idempotent Operations
- **Define/Undefine Pattern**: Safe operations that don't fail on non-existing resources
- **Error Tolerance**: Graceful handling of missing certificates and failed operations

## Prerequisites and Configuration

Before using the SSL module, you must configure the environment:

1. **Install certbot**: The system must have certbot installed
2. **Install certbot-dns-cloudflare**: Required for wildcard certificate DNS-01 validation
3. **Configure email**: Set `LETSENCRYPT_EMAIL` environment variable
4. **CloudFlare API access**: Required for DNS-01 challenges (wildcard certificates)
5. **Setup nginx**: Ensure nginx is properly configured for SSL

### System Requirements

```bash
# Ubuntu/Debian
sudo apt install certbot python3-certbot-dns-cloudflare

# CentOS/RHEL
sudo yum install certbot python3-certbot-dns-cloudflare

# Or via pip
pip install certbot-dns-cloudflare
```

### Environment Configuration with Assist

⚠️ **Required Setup**: Configure environment variables for SSL management:

```bash
npx hasyx assist dns
```

This will prompt you to configure:
- `LETSENCRYPT_EMAIL`: Email address for Let's Encrypt notifications
- `CLOUDFLARE_API_TOKEN`: API token for DNS-01 challenges (wildcard certificates)
- `CLOUDFLARE_ZONE_ID`: Zone ID for DNS management
- Domain configuration for subdomain management

**Example assist session:**
```bash
$ npx hasyx assist dns

🌐 DNS Management Configuration
===============================

Do you want to configure DNS/SSL/Cloudflare management? (y/n): y

Enter your DNS domain (e.g., example.com): yourdomain.com
✅ DNS domain set to: yourdomain.com

Enter LetsEncrypt email for SSL certificates: admin@yourdomain.com
✅ SSL email configuration completed

☁️ Cloudflare Configuration (Required for Wildcard SSL)
========================================================

Enter Cloudflare API Token: your_api_token_here
✅ Cloudflare API Token configured

Enter Cloudflare Zone ID: your_zone_id_here
✅ Cloudflare Zone ID configured

💾 Configuration saved to .env file
```

### Manual Environment Configuration

Alternatively, set environment variables manually:

```bash
# Required for SSL certificate creation
LETSENCRYPT_EMAIL=admin@yourdomain.com

# Required for wildcard certificates (DNS-01 validation)
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_ZONE_ID=your_zone_id_here

# Optional domain for subdomain management
HASYX_DNS_DOMAIN=yourdomain.com

# Optional custom certbot path
CERTBOT_PATH=/usr/bin/certbot
```

### Environment Variables Usage

```typescript
import { SSL } from 'hasyx';

// Recommended: Use environment variables
const ssl = new SSL(); // Automatically uses LETSENCRYPT_EMAIL from env

// Verify configuration
if (!process.env.LETSENCRYPT_EMAIL) {
  console.error('LETSENCRYPT_EMAIL not configured. Run: npx hasyx assist dns');
  process.exit(1);
}

// Alternative: Explicit configuration
const ssl = new SSL({
  email: process.env.LETSENCRYPT_EMAIL || 'admin@yourdomain.com',
  certbotPath: process.env.CERTBOT_PATH || 'certbot',
  staging: false // Set to true for testing
});
```

## Usage

### Basic Individual Certificate Usage

```typescript
import { SSL } from 'hasyx';

// Create SSL manager instance (uses environment variables)
const ssl = new SSL();

// Create SSL certificate for specific domain
await ssl.create('app.yourdomain.com');

// Check certificate status
const info = await ssl.get('app.yourdomain.com');
console.log(`Certificate expires: ${info?.expiresAt}`);
console.log(`Days remaining: ${info?.daysLeft}`);
```

### Wildcard Certificate Usage

```typescript
import { SSL, CloudFlare } from 'hasyx';

const ssl = new SSL();

// Set up CloudFlare for DNS-01 validation
const cloudflare = new CloudFlare({
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
  zoneId: process.env.CLOUDFLARE_ZONE_ID!,
  domain: 'yourdomain.com'
});

// Generate CloudFlare credentials file for certbot
const credentialsPath = cloudflare.generateCredentialsFile();

try {
  // Create wildcard certificate for *.yourdomain.com
  await ssl.createWildcard('yourdomain.com', credentialsPath);
  
  // Get wildcard certificate information
  const wildcardInfo = await ssl.getWildcard('yourdomain.com');
  console.log(`Wildcard domain: ${wildcardInfo?.wildcardDomain}`);
  console.log(`Covers subdomains: ${wildcardInfo?.coversSubdomain('app')}`);
  console.log(`Days remaining: ${wildcardInfo?.daysLeft}`);
  
} finally {
  // Clean up credentials file
  fs.unlinkSync(credentialsPath);
}
```

### Environment-Based Configuration

```typescript
import { SSL } from 'hasyx';

// Environment variables configuration
const ssl = new SSL({
  email: process.env.LETSENCRYPT_EMAIL, // From assist or manual setup
  certbotPath: process.env.CERTBOT_PATH || 'certbot',
  staging: process.env.NODE_ENV !== 'production' // Use staging for development
});

// Validate configuration
if (!ssl.defaultEmail) {
  throw new Error('Email configuration required. Run: npx hasyx assist dns');
}

console.log(`SSL configured with email: ${ssl.defaultEmail}`);
```

### Advanced Usage with DNS Waiting

```typescript
import { SSL } from 'hasyx';

const ssl = new SSL();

// Wait for DNS propagation before creating certificate
try {
  // First wait for DNS to propagate
  const dnsResult = await ssl.wait('newapp.yourdomain.com', '149.102.136.233', 12);
  console.log(`DNS propagated after ${dnsResult.attempts} attempts`);
  
  // Then create SSL certificate
  await ssl.create('newapp.yourdomain.com');
  console.log('SSL certificate created successfully');
} catch (error) {
  console.error('Failed to create SSL certificate:', error);
}
```

## Configuration Options

### SSLConfig Interface

```typescript
interface SSLConfig {
  email?: string;          // Email for Let's Encrypt (or use LETSENCRYPT_EMAIL env)
  webroot?: string;        // Web root path for challenges (optional)
  certbotPath?: string;    // Path to certbot binary (default: 'certbot')
  staging?: boolean;       // Use Let's Encrypt staging environment for testing
}
```

### WildcardCertificateInfo Interface

```typescript
interface WildcardCertificateInfo {
  domain: string;                                    // Base domain (example.com)
  wildcardDomain: string;                           // Wildcard domain (*.example.com)
  exists: boolean;                                  // Certificate exists
  expiresAt?: Date;                                // Expiration date
  daysLeft?: number;                               // Days until expiration
  coversSubdomain: (subdomain: string) => boolean; // Check if subdomain is covered
  path?: {                                         // Certificate file paths
    certificate: string;
    privateKey: string;
    fullchain: string;
  };
}
```

### Environment Variables

```bash
# Required
LETSENCRYPT_EMAIL=admin@yourdomain.com

# Required for wildcard certificates
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_ZONE_ID=your_zone_id_here

# Optional
CERTBOT_PATH=/usr/bin/certbot
HASYX_DNS_DOMAIN=yourdomain.com
```

## Core Methods

### Certificate Information

#### `get(domain: string): Promise<CertificateInfo | null>`
Returns certificate information or null if certificate doesn't exist.

```typescript
const info = await ssl.get('app.yourdomain.com');
if (info) {
  console.log(`Certificate exists, expires: ${info.expiresAt}`);
  console.log(`Days left: ${info.daysLeft}`);
  console.log(`Certificate path: ${info.path?.certificate}`);
} else {
  console.log('Certificate does not exist');
}
```

#### `getWildcard(domain: string): Promise<WildcardCertificateInfo | null>`
Returns wildcard certificate information or null if wildcard certificate doesn't exist.

```typescript
const wildcardInfo = await ssl.getWildcard('yourdomain.com');
if (wildcardInfo) {
  console.log(`Wildcard domain: ${wildcardInfo.wildcardDomain}`);
  console.log(`Covers subdomains: ${wildcardInfo.coversSubdomain('app')}`);
  console.log(`Expires: ${wildcardInfo.expiresAt}, Days left: ${wildcardInfo.daysLeft}`);
  console.log(`Certificate path: ${wildcardInfo.path?.fullchain}`);
} else {
  console.log('Wildcard certificate does not exist');
}
```

#### `check(domain: string): Promise<CertificateInfo>`
Returns certificate status (always returns object, even for non-existing certificates).

```typescript
const status = await ssl.check('app.yourdomain.com');
console.log(`Certificate exists: ${status.exists}`);
if (status.exists) {
  console.log(`Expires: ${status.expiresAt}, Days left: ${status.daysLeft}`);
}
```

### Certificate Operations

#### `create(domain: string, email?: string): Promise<void>`
Creates SSL certificate for domain. Throws error if certificate already exists.

```typescript
try {
  await ssl.create('newapp.yourdomain.com', 'admin@yourdomain.com');
  console.log('Certificate created successfully');
} catch (error) {
  console.error('Certificate creation failed:', error);
}
```

#### `createWildcard(domain: string, credentialsPath: string, email?: string): Promise<void>`
Creates wildcard SSL certificate for domain using DNS-01 validation. Requires CloudFlare credentials file.

```typescript
import { CloudFlare } from 'hasyx';

const cloudflare = new CloudFlare({
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
  zoneId: process.env.CLOUDFLARE_ZONE_ID!,
  domain: 'yourdomain.com'
});

const credentialsPath = cloudflare.generateCredentialsFile();

try {
  await ssl.createWildcard('yourdomain.com', credentialsPath, 'admin@yourdomain.com');
  console.log('Wildcard certificate created successfully');
} catch (error) {
  console.error('Wildcard certificate creation failed:', error);
} finally {
  // Clean up credentials file
  fs.unlinkSync(credentialsPath);
}
```

#### `delete(domain: string): Promise<void>`
Deletes SSL certificate for domain. Throws error if certificate doesn't exist.

```typescript
try {
  await ssl.delete('oldapp.yourdomain.com');
  console.log('Certificate deleted successfully');
} catch (error) {
  console.error('Certificate deletion failed:', error);
}
```

### Idempotent Operations

#### `define(domain: string, email?: string): Promise<void>`
Ensures certificate exists (creates if missing, replaces if exists).

```typescript
// Safe operation - won't fail if certificate already exists
await ssl.define('app.yourdomain.com');
console.log('Certificate is now defined');
```

#### `undefine(domain: string): Promise<void>`
Ensures certificate doesn't exist (deletes if exists, succeeds if missing).

```typescript
// Safe operation - won't fail if certificate doesn't exist
await ssl.undefine('app.yourdomain.com');
console.log('Certificate is now undefined');
```

### DNS and Renewal Operations

#### `wait(domain: string, ip: string, maxAttempts?: number): Promise<DNSPropagationResult>`
Waits for DNS propagation before certificate operations.

```typescript
try {
  const result = await ssl.wait('app.yourdomain.com', '149.102.136.233', 12);
  console.log(`DNS propagated: ${result.propagated}`);
  console.log(`Actual IP: ${result.actualIp}`);
  console.log(`Attempts: ${result.attempts}`);
} catch (error) {
  console.error('DNS propagation timeout:', error);
}
```

#### `renew(domain: string, daysBeforeExpiry?: number): Promise<boolean>`
Renews certificate if close to expiration.

```typescript
// Renew if certificate expires within 30 days (default)
const renewed = await ssl.renew('app.yourdomain.com');
if (renewed) {
  console.log('Certificate renewed successfully');
} else {
  console.log('Certificate renewal not needed');
}

// Custom renewal threshold (10 days)
const renewed = await ssl.renew('app.yourdomain.com', 10);
```

### Helper Methods

#### `wildcardCovers(subdomain: string, domain: string): boolean`
Checks if a subdomain is covered by a wildcard certificate for the given domain.

```typescript
const ssl = new SSL();

// Check if wildcard *.yourdomain.com covers app.yourdomain.com
const covers = ssl.wildcardCovers('app', 'yourdomain.com');
console.log(`Wildcard covers app: ${covers}`); // true

// Check if wildcard *.yourdomain.com covers deep.app.yourdomain.com  
const coversDeep = ssl.wildcardCovers('deep.app', 'yourdomain.com');
console.log(`Wildcard covers deep.app: ${coversDeep}`); // false (too deep)
```

#### `validateCertbotAvailable(): void`
Validates that certbot is available on the system.

```typescript
try {
  ssl.validateCertbotAvailable();
  console.log('Certbot is available');
} catch (error) {
  console.error('Certbot not available:', error);
}
```

#### `validateCertbotDnsCloudflareAvailable(): void`
Validates that certbot-dns-cloudflare plugin is available (required for wildcard certificates).

```typescript
try {
  ssl.validateCertbotDnsCloudflareAvailable();
  console.log('Certbot DNS CloudFlare plugin is available');
} catch (error) {
  console.error('Certbot DNS CloudFlare plugin not available:', error);
}
```

## Integration with Other Modules

### With CloudFlare DNS

```typescript
import { SSL } from 'hasyx';
import { CloudFlare } from 'hasyx';

const ssl = new SSL();
const cloudflare = new CloudFlare({
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
  zoneId: process.env.CLOUDFLARE_ZONE_ID!,
  domain: 'yourdomain.com'
});

// Create DNS record first
await cloudflare.define('app', { ip: '149.102.136.233' });

// Wait for DNS propagation
await ssl.wait('app.yourdomain.com', '149.102.136.233');

// Create SSL certificate
await ssl.define('app.yourdomain.com');
```

### With Nginx

```typescript
import { SSL, Nginx } from 'hasyx';

const ssl = new SSL();
const nginx = new Nginx();

// Create SSL certificate first
await ssl.define('app.yourdomain.com');

// Get certificate paths
const certInfo = await ssl.get('app.yourdomain.com');

// Configure nginx with SSL
await nginx.define('app.yourdomain.com', {
  serverName: 'app.yourdomain.com',
  ssl: true,
  sslCertificate: certInfo?.path?.fullchain,
  sslCertificateKey: certInfo?.path?.privateKey,
  proxyPass: 'http://localhost:3000'
});
```

## Certificate Information Structure

### CertificateInfo Interface

```typescript
interface CertificateInfo {
  exists: boolean;           // Whether certificate exists
  domain?: string;           // Domain name
  expiresAt?: Date;         // Expiration date
  daysLeft?: number;        // Days until expiration
  path?: {                  // Certificate file paths
    certificate: string;    // cert.pem path
    privateKey: string;     // privkey.pem path  
    fullchain: string;      // fullchain.pem path
  };
}
```

### DNSPropagationResult Interface

```typescript
interface DNSPropagationResult {
  domain: string;           // Domain being checked
  expectedIp: string;       // Expected IP address
  actualIp: string;         // Actual resolved IP
  propagated: boolean;      // Whether DNS propagated successfully
  attempts: number;         // Number of attempts made
}
```

## Error Handling

### Common Error Scenarios

```typescript
import { SSL } from 'hasyx';

const ssl = new SSL();

try {
  await ssl.create('app.yourdomain.com');
} catch (error) {
  if (error.message.includes('already exists')) {
    console.log('Certificate already exists - use define() instead');
    await ssl.define('app.yourdomain.com');
  } else if (error.message.includes('Email is required')) {
    console.log('Set LETSENCRYPT_EMAIL environment variable');
    console.log('Run: npx hasyx assist dns');
  } else if (error.message.includes('Certbot is not available')) {
    console.log('Install certbot: sudo apt install certbot python3-certbot-nginx');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Validation Checks

```typescript
// Check if certbot is available
try {
  ssl.validateCertbotAvailable();
  console.log('Certbot is ready');
} catch (error) {
  console.error('Certbot not available:', error.message);
}

// Check certificate existence before operations
if (ssl.checkCertificateExists('app.yourdomain.com')) {
  console.log('Certificate files exist on disk');
}
```

## Best Practices

### 1. Use Define/Undefine for Idempotency

```typescript
// ✅ GOOD: Safe operations
await ssl.define('app.yourdomain.com');  // Won't fail if exists
await ssl.undefine('app.yourdomain.com'); // Won't fail if missing

// ❌ AVOID: May fail
await ssl.create('app.yourdomain.com');  // Fails if exists
await ssl.delete('app.yourdomain.com');  // Fails if missing
```

### 2. Always Wait for DNS Propagation

```typescript
// ✅ GOOD: Wait for DNS before SSL
await cloudflare.define('app', { ip: '149.102.136.233' });
await ssl.wait('app.yourdomain.com', '149.102.136.233');
await ssl.define('app.yourdomain.com');

// ❌ AVOID: SSL creation may fail without DNS
await cloudflare.define('app', { ip: '149.102.136.233' });
await ssl.define('app.yourdomain.com'); // May fail
```

### 3. Monitor Certificate Expiration

```typescript
// Set up automated renewal checking
const domains = ['app.yourdomain.com', 'api.yourdomain.com'];

for (const domain of domains) {
  const info = await ssl.check(domain);
  if (info.exists && info.daysLeft && info.daysLeft < 30) {
    console.log(`Certificate for ${domain} expires in ${info.daysLeft} days`);
    await ssl.renew(domain);
  }
}
```

### 4. Environment Configuration

```bash
# Configure via assist command (recommended)
npx hasyx assist dns

# Or set manually
LETSENCRYPT_EMAIL=admin@yourdomain.com
HASYX_DNS_DOMAIN=yourdomain.com
```

## Security Considerations

### Certificate Storage
- Certificates are stored in `/etc/letsencrypt/live/` by default
- Private keys are protected with appropriate file permissions
- Use proper backup strategies for certificate directories

### Email Security
- Use a monitored email address for Let's Encrypt notifications
- Consider using a dedicated email for certificate management
- Let's Encrypt sends expiration warnings to the configured email

### DNS Security
- Ensure DNS records are properly secured
- Use Cloudflare's security features when available
- Monitor DNS changes and certificate issuance

## Troubleshooting

### Common Issues

**Email not configured:**
```bash
# Configure via assist (recommended)
npx hasyx assist dns

# Or set environment variable manually
export LETSENCRYPT_EMAIL=admin@yourdomain.com
```

**Certbot not found:**
```bash
# Ubuntu/Debian
sudo apt install certbot python3-certbot-nginx

# CentOS/RHEL
sudo yum install certbot python3-certbot-nginx

# macOS
brew install certbot
```

**DNS propagation timeout:**
```typescript
// Increase timeout for slow DNS
await ssl.wait('app.yourdomain.com', '149.102.136.233', 20); // 20 attempts
```

**Certificate creation fails:**
```bash
# Check nginx configuration
nginx -t

# Ensure domain points to server
dig app.yourdomain.com

# Check certbot logs
tail -f /var/log/letsencrypt/letsencrypt.log
```

See [NGINX.md](NGINX.md) for nginx integration details and [CLOUDFLARE.md](CLOUDFLARE.md) for CloudFlare DNS management. 