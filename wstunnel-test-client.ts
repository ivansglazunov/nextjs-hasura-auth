import { createServer, Server } from 'http';
import { parse } from 'url';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { spawn, ChildProcess } from 'child_process';
import { findPort } from './lib/find-port';
import Debug from './lib/debug';

const debug = Debug('wstunnel-test-client');

interface TestClientConfig {
  uuid?: string;
  port?: number;
  wstunnelUrl?: string;
  autoRegister?: boolean; // Default: true, set to false to only start HTTP server
}

export class WstunnelTestClient {
  private uuid: string;
  private port: number;
  private wstunnelUrl: string;
  private autoRegister: boolean;
  private server: Server | null = null;
  private wstunnelProcess: ChildProcess | null = null;

  constructor(config: TestClientConfig = {}) {
    this.uuid = config.uuid || process.env.UUID || uuidv4();
    this.port = config.port || parseInt(process.env.PORT || '0');
    
    // Use PORT environment variable for server URL (default 3003 from .env)
    const serverPort = process.env.PORT || '3003';
    this.wstunnelUrl = config.wstunnelUrl || process.env.WSTUNNEL || `http://localhost:${serverPort}/api/wstunnel`;
    this.autoRegister = config.autoRegister !== false; // Default to true
    
    debug(`WstunnelTestClient initialized with UUID: ${this.uuid}, Port: ${this.port}, WSTUNNEL: ${this.wstunnelUrl}`);
  }

  async start(): Promise<void> {
    debug('Starting test client...');
    
    try {
      // Find available port if not specified
      if (this.port === 0) {
        this.port = await findPort(3001, 4000);
        debug(`Found available port: ${this.port}`);
      }

      // Create HTTP server
      this.server = createServer((req, res) => {
        const parsedUrl = parse(req.url || '', true);
        const pathname = parsedUrl.pathname;

        // Enable CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          res.end();
          return;
        }

        if (pathname === '/') {
          debug(`Received GET request, responding with UUID: ${this.uuid}`);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/plain');
          res.end(this.uuid);
        } else if (pathname === '/health') {
          debug('Health check request');
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ 
            status: 'ok', 
            uuid: this.uuid, 
            port: this.port,
            timestamp: new Date().toISOString()
          }));
        } else {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'text/plain');
          res.end('Not Found');
        }
      });

      // Start server
      await new Promise<void>((resolve, reject) => {
        this.server!.listen(this.port, (err?: Error) => {
          if (err) {
            reject(err);
          } else {
            debug(`Test server started on port ${this.port}`);
            resolve();
          }
        });
      });

      // Only register if autoRegister is enabled
      if (this.autoRegister) {
        // Register with wstunnel service
        await this.registerWithWstunnel();
        
        // Start wstunnel client
        await this.startWstunnelClient();
      } else {
        debug('Auto-registration disabled, only HTTP server started');
      }
      
      debug('Test client started successfully');
      
    } catch (error) {
      debug(`Error starting test client: ${error}`);
      throw error;
    }
  }

  private async registerWithWstunnel(): Promise<void> {
    debug('Registering with wstunnel service...');
    
    try {
      const response = await axios.post(`${this.wstunnelUrl}/${this.uuid}`, {}, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000
      });

      debug('Registration result:', response.data);

      if (!response.data.success) {
        throw new Error(`Registration failed: ${response.data.error}`);
      }

      debug(`Successfully registered tunnel: ${response.data.subdomain}`);
      
    } catch (error) {
      debug(`Error registering with wstunnel: ${error}`);
      throw error;
    }
  }

  private async startWstunnelClient(): Promise<void> {
    debug('Starting wstunnel client...');
    
    try {
      // Extract domain from wstunnel URL for WebSocket connection
      const url = new URL(this.wstunnelUrl);
      const domain = url.hostname === 'localhost' ? 'deep.foundation' : url.hostname;
      const wsUrl = `ws://${this.uuid}.${domain}:5000`;
      
      debug(`Starting wstunnel client: ws -> ${wsUrl}, local -> localhost:${this.port}`);
      
      // Start wstunnel client process
      const clientCommand = [
        'wstunnel', 'client', wsUrl, '--to', `localhost:${this.port}`
      ];
      
      this.wstunnelProcess = spawn(clientCommand[0], clientCommand.slice(1), {
        stdio: 'pipe',
        detached: false
      });

      this.wstunnelProcess.stdout?.on('data', (data) => {
        debug(`wstunnel client stdout: ${data}`);
      });

      this.wstunnelProcess.stderr?.on('data', (data) => {
        debug(`wstunnel client stderr: ${data}`);
      });

      this.wstunnelProcess.on('error', (error) => {
        debug(`wstunnel client error: ${error}`);
      });

      this.wstunnelProcess.on('exit', (code) => {
        debug(`wstunnel client exited with code: ${code}`);
      });

      // Wait a bit for client to connect
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      debug('Wstunnel client started');
      
    } catch (error) {
      debug(`Error starting wstunnel client: ${error}`);
      throw error;
    }
  }

  async stop(): Promise<void> {
    debug('Stopping test client...');
    
    try {
      // Only unregister if we registered
      if (this.autoRegister) {
        // Unregister from wstunnel service
        await this.unregisterFromWstunnel();
        
        // Stop wstunnel client
        if (this.wstunnelProcess) {
          debug('Killing wstunnel client process');
          this.wstunnelProcess.kill('SIGTERM');
          this.wstunnelProcess = null;
        }
      }
      
      // Stop server
      if (this.server) {
        debug('Closing HTTP server');
        await new Promise<void>((resolve) => {
          this.server!.close(() => {
            resolve();
          });
        });
        this.server = null;
      }
      
      debug('Test client stopped successfully');
      
    } catch (error) {
      debug(`Error stopping test client: ${error}`);
      throw error;
    }
  }

  private async unregisterFromWstunnel(): Promise<void> {
    debug('Unregistering from wstunnel service...');
    
    try {
      const response = await axios.post(`${this.wstunnelUrl}/${this.uuid}?undefine=1`, {}, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000
      });

      debug('Unregistration result:', response.data);

      if (!response.data.success) {
        throw new Error(`Unregistration failed: ${response.data.error}`);
      }

      debug('Successfully unregistered from wstunnel');
      
    } catch (error) {
      debug(`Error unregistering from wstunnel: ${error}`);
      throw error;
    }
  }

  getUuid(): string {
    return this.uuid;
  }

  getPort(): number {
    return this.port;
  }

  getWstunnelUrl(): string {
    return this.wstunnelUrl;
  }
}

// CLI usage
// CLI usage for ES modules
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  const client = new WstunnelTestClient();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    debug('Received SIGINT, shutting down...');
    await client.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    debug('Received SIGTERM, shutting down...');
    await client.stop();
    process.exit(0);
  });

  client.start().catch((error) => {
    console.error('Failed to start test client:', error);
    process.exit(1);
  });
} 