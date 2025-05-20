import Debug from './debug';

const debug = Debug('pg');

/**
 * PostgreSQL connection options
 */
export interface PgConnectionOptions {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: boolean;
  sslmode?: string;
}

/**
 * Converts a PostgreSQL connection URL to connection options object
 * 
 * @example
 * urlToOptions('postgres://user:pass@host:5432/dbname')
 * // Returns { host: 'host', port: 5432, user: 'user', password: 'pass', database: 'dbname' }
 */
export function urlToOptions(url: string): PgConnectionOptions {
  debug('Converting URL to connection options');
  
  try {
    // Parse the URL
    const parsedUrl = new URL(url);
    
    if (parsedUrl.protocol !== 'postgres:' && parsedUrl.protocol !== 'postgresql:') {
      throw new Error('Invalid PostgreSQL URL protocol');
    }
    
    // Extract connection details
    const host = parsedUrl.hostname;
    const port = parseInt(parsedUrl.port || '5432', 10);
    const user = parsedUrl.username;
    const password = parsedUrl.password;
    
    // Extract database name from pathname (remove leading slash)
    const database = parsedUrl.pathname.substring(1).split('?')[0];
    
    // Parse options from search params
    const params = parsedUrl.searchParams;
    const sslmode = params.get('sslmode') || undefined;
    
    // Create and return the options object
    const options: PgConnectionOptions = {
      host,
      port,
      user,
      password,
      database,
    };
    
    // Add SSL if specified
    if (sslmode) {
      options.sslmode = sslmode;
      if (sslmode === 'require') {
        options.ssl = true;
      }
    }
    
    return options;
  } catch (error: any) {
    debug('Error parsing PostgreSQL URL:', error);
    throw new Error(`Invalid PostgreSQL URL: ${error.message}`);
  }
}

/**
 * Converts connection options object to a PostgreSQL connection URL
 * 
 * @example
 * optionsToUrl({ host: 'host', port: 5432, user: 'user', password: 'pass', database: 'dbname' })
 * // Returns 'postgres://user:pass@host:5432/dbname'
 */
export function optionsToUrl(options: PgConnectionOptions): string {
  debug('Converting connection options to URL');
  
  try {
    const { host, port, user, password, database, sslmode } = options;
    
    // Construct the base URL
    let url = `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
    
    // Add query parameters if needed
    const params = new URLSearchParams();
    
    if (sslmode) {
      params.append('sslmode', sslmode);
    }
    
    // Append query string if we have parameters
    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
    
    return url;
  } catch (error: any) {
    debug('Error creating PostgreSQL URL:', error);
    throw new Error(`Failed to create PostgreSQL URL: ${error.message}`);
  }
}

/**
 * Get PostgreSQL connection configuration from environment variables
 * 
 * Looks for either:
 * 1. A single POSTGRES_URL environment variable
 * 2. Individual environment variables: PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE
 * 
 * @returns Connection configuration object or undefined if not configured
 */
export function getPgConfig(): { options: PgConnectionOptions, url: string } | undefined {
  debug('Getting PostgreSQL configuration from environment');
  
  // Check for POSTGRES_URL
  const databaseUrl = process.env.POSTGRES_URL || process.env.POSTGRES_URL;
  
  if (databaseUrl) {
    debug('Found POSTGRES_URL environment variable');
    const options = urlToOptions(databaseUrl);
    return { options, url: databaseUrl };
  }
  
  // Check for individual environment variables
  const host = process.env.PGHOST;
  const port = process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432;
  const user = process.env.PGUSER;
  const password = process.env.PGPASSWORD;
  const database = process.env.PGDATABASE;
  
  if (host && user && password && database) {
    debug('Found individual PostgreSQL environment variables');
    const options: PgConnectionOptions = {
      host,
      port,
      user,
      password,
      database,
    };
    
    // Add SSL mode if specified
    if (process.env.PGSSLMODE) {
      options.sslmode = process.env.PGSSLMODE;
      if (options.sslmode === 'require') {
        options.ssl = true;
      }
    }
    
    const url = optionsToUrl(options);
    return { options, url };
  }
  
  debug('No PostgreSQL configuration found in environment');
  return undefined;
} 