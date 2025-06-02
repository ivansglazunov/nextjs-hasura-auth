# CloudFlare DNS Management

CloudFlare DNS Management (`CLOUDFLARE.md`)

This document describes the `CloudFlare` class and related utilities provided in `lib/cloudflare.ts`, which enable automated DNS record management via CloudFlare API.

## Purpose

The `CloudFlare` class provides comprehensive DNS management that:
- Manages DNS A records through CloudFlare API
- Supports subdomain creation, deletion, and modification
- Provides bulk DNS record listing and filtering
- Implements define/undefine patterns for idempotent operations
- Integrates seamlessly with SSL certificate and nginx management

⚠️ **Important**: This module requires proper CloudFlare API configuration. Use the assist command to configure required API credentials.

<details>
<summary>Core Exports (`lib/cloudflare.ts`)</summary>

* `CloudFlare`: Main class for CloudFlare DNS management
* `CloudflareConfig`: Interface for CloudFlare API configuration
* `DnsRecord`: Interface describing DNS record structure
* `SubdomainDnsConfig`: Interface for subdomain DNS configuration
* `CloudflareResponse`: Interface for CloudFlare API responses

</details>

## Core Features

### DNS Record Management
- **Creation**: Create A records for subdomains with IP addresses
- **Deletion**: Remove DNS records safely with validation
- **Listing**: Retrieve all DNS records for a domain
- **Querying**: Get specific DNS records by subdomain name

### SSL Integration Support
- **ACME Challenge Support**: Create and delete TXT records for DNS-01 validation
- **Wildcard SSL Integration**: Automatic challenge record management for wildcard certificates
- **Credentials File Generation**: Creates certbot-dns-cloudflare compatible credentials

### API Integration
- **Authentication**: Secure API token-based authentication
- **Error Handling**: Comprehensive CloudFlare API error processing
- **Rate Limiting**: Built-in request management and retry logic
- **Pagination**: Automatic handling of large DNS record sets

### Idempotent Operations
- **Define/Undefine Pattern**: Safe operations that don't fail on existing/missing records
- **Conflict Resolution**: Graceful handling of duplicate records and deletions

## Prerequisites and Configuration

Before using the CloudFlare module, you must configure the environment:

1. **CloudFlare Account**: Domain must be managed by CloudFlare
2. **API Token**: Create token with Zone:Edit permissions
3. **Zone ID**: Get Zone ID from CloudFlare dashboard
4. **Domain Configuration**: Set primary domain for subdomain management

### Environment Configuration with Assist

⚠️ **Required Setup**: Configure CloudFlare API credentials:

```bash
npx hasyx assist dns
```

This will prompt you to configure:
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

✅ Cloudflare configuration completed successfully!
💾 Configuration saved to .env file
```

### Manual Environment Configuration

Alternatively, set environment variables manually:

```bash
# Required for CloudFlare DNS management
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_ZONE_ID=your_zone_id_here
HASYX_DNS_DOMAIN=yourdomain.com

# Optional for SSL integration
LETSENCRYPT_EMAIL=admin@yourdomain.com
```

### Getting CloudFlare Credentials

1. **API Token**: Visit [CloudFlare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
   - Click "Create Token"
   - Use "Custom token" template
   - Permissions: Zone:Edit
   - Zone Resources: Include your domain

2. **Zone ID**: In CloudFlare Dashboard
   - Select your domain
   - Look for Zone ID in the right sidebar under "API"

### Environment Variables Usage

```typescript
import { CloudFlare } from 'hasyx';

// Recommended: Use environment variables
const cloudflare = new CloudFlare({
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
  zoneId: process.env.CLOUDFLARE_ZONE_ID!,
  domain: process.env.HASYX_DNS_DOMAIN!
});

// Verify configuration
if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ZONE_ID) {
  console.error('CloudFlare credentials not configured. Run: npx hasyx assist dns');
  process.exit(1);
}

console.log(`CloudFlare configured for domain: ${process.env.HASYX_DNS_DOMAIN}`);
```

## Usage

### Basic Usage

```typescript
import { CloudFlare } from 'hasyx';

// Create CloudFlare manager instance (uses environment variables)
const cloudflare = new CloudFlare({
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
  zoneId: process.env.CLOUDFLARE_ZONE_ID!,
  domain: process.env.HASYX_DNS_DOMAIN!
});

// Create DNS A record for subdomain
await cloudflare.create('app', { 
  ip: '149.102.136.233',
  ttl: 300,
  proxied: false 
});

// Get DNS record information
const record = await cloudflare.get('app');
console.log(`DNS record: ${record?.name} → ${record?.content}`);
```

### Environment-Based Configuration

```typescript
import { CloudFlare } from 'hasyx';

// Environment variables configuration (from assist or manual setup)
const cloudflare = new CloudFlare({
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
  zoneId: process.env.CLOUDFLARE_ZONE_ID!,
  domain: process.env.HASYX_DNS_DOMAIN!
});

// Configuration validation
if (!cloudflare) {
  throw new Error('CloudFlare configuration incomplete. Run: npx hasyx assist dns');
}

console.log(`CloudFlare DNS manager ready for domain: ${process.env.HASYX_DNS_DOMAIN}`);
```

### Advanced Usage

```typescript
import { CloudFlare } from 'hasyx';

const cloudflare = new CloudFlare({
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
  zoneId: process.env.CLOUDFLARE_ZONE_ID!,
  domain: process.env.HASYX_DNS_DOMAIN!
});

// List all DNS A records
const records = await cloudflare.list();
console.log(`Found ${records.length} DNS records`);

// Create multiple subdomains
const subdomains = ['app', 'api', 'admin'];
for (const subdomain of subdomains) {
  await cloudflare.define(subdomain, { ip: '149.102.136.233' });
  console.log(`Created: ${subdomain}.${process.env.HASYX_DNS_DOMAIN}`);
}

// Update existing record (replace)
await cloudflare.define('app', { 
  ip: '192.168.1.100',
  ttl: 600,
  proxied: true 
});
```

## Configuration Options

### CloudflareConfig Interface

```typescript
interface CloudflareConfig {
  apiToken: string;    // CloudFlare API token with Zone:Edit permissions
  zoneId: string;      // CloudFlare Zone ID for your domain
  domain: string;      // Primary domain name (e.g., 'example.com')
}
```

### SubdomainDnsConfig Interface

```typescript
interface SubdomainDnsConfig {
  ip: string;           // IP address for A record
  ttl?: number;         // TTL in seconds (default: 300)
  proxied?: boolean;    // Whether to proxy through CloudFlare (default: false)
}
```

### Environment Variables

```bash
# Required
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_ZONE_ID=your_zone_id_here
HASYX_DNS_DOMAIN=yourdomain.com

# Optional
LETSENCRYPT_EMAIL=admin@yourdomain.com
```

## Core Methods

### DNS Record Information

#### `get(subdomain: string): Promise<DnsRecord | null>`
Returns DNS record information or null if record doesn't exist.

```typescript
const record = await cloudflare.get('app');
if (record) {
  console.log(`Record ID: ${record.id}`);
  console.log(`Name: ${record.name}`);
  console.log(`IP: ${record.content}`);
  console.log(`TTL: ${record.ttl}`);
  console.log(`Proxied: ${record.proxied}`);
} else {
  console.log('DNS record does not exist');
}
```

#### `list(): Promise<DnsRecord[]>`
Returns all DNS A records for the domain.

```typescript
const records = await cloudflare.list();
console.log(`Total DNS records: ${records.length}`);

records.forEach(record => {
  console.log(`${record.name} → ${record.content} (TTL: ${record.ttl})`);
});

// Filter subdomains only
const subdomains = records.filter(r => r.name !== process.env.HASYX_DNS_DOMAIN);
console.log(`Subdomains: ${subdomains.length}`);
```

### DNS Record Operations

#### `create(subdomain: string, config: SubdomainDnsConfig): Promise<DnsRecord>`
Creates DNS A record for subdomain. Throws error if record already exists.

```typescript
try {
  const record = await cloudflare.create('newapp', { 
    ip: '149.102.136.233',
    ttl: 300,
    proxied: false 
  });
  console.log(`Created DNS record: ${record.id}`);
} catch (error) {
  console.error('DNS creation failed:', error);
}
```

#### `delete(subdomain: string): Promise<void>`
Deletes DNS record for subdomain. Throws error if record doesn't exist.

```typescript
try {
  await cloudflare.delete('oldapp');
  console.log('DNS record deleted successfully');
} catch (error) {
  console.error('DNS deletion failed:', error);
}
```

### Idempotent Operations

#### `define(subdomain: string, config: SubdomainDnsConfig): Promise<DnsRecord>`
Ensures DNS record exists with specified configuration (creates or updates).

```typescript
// Safe operation - won't fail if record already exists
const record = await cloudflare.define('app', { 
  ip: '149.102.136.233',
  ttl: 300,
  proxied: false 
});
console.log('DNS record is now defined');
```

#### `undefine(subdomain: string): Promise<void>`
Ensures DNS record doesn't exist (deletes if exists, succeeds if missing).

```typescript
// Safe operation - won't fail if DNS record doesn't exist
await cloudflare.undefine('app');
console.log('DNS record is now undefined');
```

### SSL Integration Methods

#### `generateCredentialsFile(): string`
Creates CloudFlare credentials file for certbot-dns-cloudflare plugin. Returns path to created file.

```typescript
const credentialsPath = cloudflare.generateCredentialsFile();
console.log(`Credentials file created: ${credentialsPath}`);

// Use with SSL wildcard certificate creation
await ssl.createWildcard('yourdomain.com', credentialsPath);

// Clean up after use
fs.unlinkSync(credentialsPath);
```

#### `createAcmeChallenge(token: string): Promise<DnsRecord>`
Creates TXT record for ACME DNS-01 challenge validation (used internally by SSL module).

```typescript
// Used internally by SSL module for wildcard certificate validation
const challengeRecord = await cloudflare.createAcmeChallenge('challenge_token_here');
console.log(`ACME challenge created: ${challengeRecord.id}`);
```

#### `deleteAcmeChallenge(): Promise<void>`
Deletes all ACME challenge TXT records for the domain (cleanup after certificate creation).

```typescript
// Used internally by SSL module for cleanup after wildcard certificate validation
await cloudflare.deleteAcmeChallenge();
console.log('ACME challenge records cleaned up');
```

## DNS Record Structure

### DnsRecord Interface

```typescript
interface DnsRecord {
  id: string;           // CloudFlare record ID
  name: string;         // Full domain name (e.g., 'app.yourdomain.com')
  content: string;      // IP address
  type: string;         // Record type ('A' for IP addresses)
  ttl: number;          // Time to live in seconds
  proxied: boolean;     // Whether proxied through CloudFlare
}
```

## Integration with Other Modules

### With SSL Management

```typescript
import { CloudFlare, SSL } from 'hasyx';

const cloudflare = new CloudFlare({
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
  zoneId: process.env.CLOUDFLARE_ZONE_ID!,
  domain: process.env.HASYX_DNS_DOMAIN!
});

const ssl = new SSL();

// Create DNS record first
await cloudflare.define('app', { ip: '149.102.136.233' });

// Wait for DNS propagation
await ssl.wait(`app.${process.env.HASYX_DNS_DOMAIN}`, '149.102.136.233');

// Create SSL certificate
await ssl.define(`app.${process.env.HASYX_DNS_DOMAIN}`);
```

### With Nginx Configuration

```typescript
import { CloudFlare, Nginx } from 'hasyx';

const cloudflare = new CloudFlare({
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
  zoneId: process.env.CLOUDFLARE_ZONE_ID!,
  domain: process.env.HASYX_DNS_DOMAIN!
});

const nginx = new Nginx();

// Create DNS record
await cloudflare.define('app', { ip: '149.102.136.233' });

// Configure nginx
await nginx.define(`app.${process.env.HASYX_DNS_DOMAIN}`, {
  serverName: `app.${process.env.HASYX_DNS_DOMAIN}`,
  proxyPass: 'http://localhost:3000'
});
```

### Complete Subdomain Setup

```typescript
import { CloudFlare, SSL, Nginx } from 'hasyx';

const cloudflare = new CloudFlare({
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
  zoneId: process.env.CLOUDFLARE_ZONE_ID!,
  domain: process.env.HASYX_DNS_DOMAIN!
});

const ssl = new SSL();
const nginx = new Nginx();

async function createSubdomain(subdomain: string, port: number) {
  const domain = `${subdomain}.${process.env.HASYX_DNS_DOMAIN}`;
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
  
  console.log(`✅ Subdomain created: https://${domain}`);
}

// Create multiple subdomains
await createSubdomain('app', 3000);
await createSubdomain('api', 4000);
await createSubdomain('admin', 5000);
```

## Error Handling

### Common Error Scenarios

```typescript
import { CloudFlare } from 'hasyx';

const cloudflare = new CloudFlare({
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
  zoneId: process.env.CLOUDFLARE_ZONE_ID!,
  domain: process.env.HASYX_DNS_DOMAIN!
});

try {
  await cloudflare.create('app', { ip: '149.102.136.233' });
} catch (error) {
  if (error.message.includes('already exists')) {
    console.log('DNS record already exists - use define() instead');
    await cloudflare.define('app', { ip: '149.102.136.233' });
  } else if (error.message.includes('authentication')) {
    console.log('Check CLOUDFLARE_API_TOKEN configuration');
    console.log('Run: npx hasyx assist dns');
  } else if (error.message.includes('zone')) {
    console.log('Check CLOUDFLARE_ZONE_ID configuration');
    console.log('Run: npx hasyx assist dns');
  } else {
    console.error('Unexpected CloudFlare API error:', error);
  }
}
```

### Configuration Validation

```typescript
try {
  const cloudflare = new CloudFlare({
    apiToken: process.env.CLOUDFLARE_API_TOKEN || '',
    zoneId: process.env.CLOUDFLARE_ZONE_ID || '',
    domain: process.env.HASYX_DNS_DOMAIN || ''
  });
} catch (error) {
  console.error('Configuration error:', error.message);
  console.log('Run: npx hasyx assist dns');
  // "CloudFlare configuration incomplete: apiToken, zoneId, and domain are required"
}
```

## Best Practices

### 1. Use Define/Undefine for Idempotency

```typescript
// ✅ GOOD: Safe operations
await cloudflare.define('app', { ip: '149.102.136.233' });    // Won't fail if exists
await cloudflare.undefine('app');                             // Won't fail if missing

// ❌ AVOID: May fail
await cloudflare.create('app', { ip: '149.102.136.233' });   // Fails if exists
await cloudflare.delete('app');                               // Fails if missing
```

### 2. Configure TTL Appropriately

```typescript
// ✅ GOOD: Short TTL for development, longer for production
const config = process.env.NODE_ENV === 'production' 
  ? { ip: '149.102.136.233', ttl: 3600 }     // 1 hour for production
  : { ip: '149.102.136.233', ttl: 300 };     // 5 minutes for development

await cloudflare.define('app', config);
```

### 3. Use Proxied Records Wisely

```typescript
// ✅ GOOD: Proxy for web traffic, direct for API/services
await cloudflare.define('www', { 
  ip: '149.102.136.233', 
  proxied: true          // Proxy web traffic for DDoS protection
});

await cloudflare.define('api', { 
  ip: '149.102.136.233', 
  proxied: false         // Direct connection for API endpoints
});
```

### 4. Environment-Based Configuration

```bash
# Configure via assist command (recommended)
npx hasyx assist dns

# Or set manually
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_ZONE_ID=your_zone_id_here
HASYX_DNS_DOMAIN=yourdomain.com
```

## Security Considerations

### API Token Security
- Use tokens with minimal required permissions (Zone:Edit only)
- Rotate API tokens regularly
- Store tokens securely in environment variables
- Never commit tokens to version control

### DNS Security
- Use CloudFlare's security features (DDoS protection, WAF)
- Monitor DNS changes for unauthorized modifications
- Enable two-factor authentication on CloudFlare account
- Set up alerts for DNS record changes

### Domain Management
- Verify domain ownership before API operations
- Use separate zones for production and development
- Implement DNS record naming conventions
- Regular backup of DNS configurations

## Troubleshooting

### Common Issues

**Credentials not configured:**
```bash
# Configure via assist (recommended)
npx hasyx assist dns

# Or set environment variables manually
export CLOUDFLARE_API_TOKEN=your_api_token_here
export CLOUDFLARE_ZONE_ID=your_zone_id_here
export HASYX_DNS_DOMAIN=yourdomain.com
```

**Invalid API token:**
```bash
# Verify token has correct permissions
curl -X GET "https://api.cloudflare.com/client/v4/user/tokens/verify" \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# Check Zone:Edit permission
curl -X GET "https://api.cloudflare.com/client/v4/zones/YOUR_ZONE_ID" \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

**Wrong Zone ID:**
```bash
# List all zones to find correct ID
curl -X GET "https://api.cloudflare.com/client/v4/zones" \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

**DNS propagation issues:**
```bash
# Check DNS propagation globally
dig app.yourdomain.com @8.8.8.8
dig app.yourdomain.com @1.1.1.1

# Check CloudFlare DNS specifically
dig app.yourdomain.com @janet.ns.cloudflare.com
```

**Rate limiting:**
```typescript
// Implement delays for bulk operations
const subdomains = ['app1', 'app2', 'app3'];
for (const subdomain of subdomains) {
  await cloudflare.define(subdomain, { ip: '149.102.136.233' });
  await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
}
```

See [SSL.md](SSL.md) for SSL certificate integration and [NGINX.md](NGINX.md) for nginx configuration management. 