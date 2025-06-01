import { v4 as uuidv4 } from 'uuid';
import { spawn, ChildProcess } from 'child_process';
import { SubdomainManager } from './subdomain';
import { CloudFlare } from './cloudflare';
import { SSL } from './ssl';
import { Nginx } from './nginx';
import { findPort } from './find-port';
import Debug from './debug';

const debug = Debug('wstunnel');

export interface WstunnelOptions {
  uuid?: string;
  undefine?: boolean;
}

export interface WstunnelResult {
  success: boolean;
  error?: string;
  uuid?: string;
  port?: number;
  subdomain?: string;
}

export class Wstunnel {
  private _id: string;
  private _list: Map<string, number>;
  private subdomainManager: SubdomainManager;

  constructor(subdomainManager: SubdomainManager) {
    this._id = uuidv4();
    this._list = new Map();
    this.subdomainManager = subdomainManager;
    debug(`Wstunnel instance created with ID: ${this._id}`);
    
    // Set up process exit handlers for cleanup
    process.on('SIGINT', () => this.handleExit('SIGINT'));
    process.on('SIGTERM', () => this.handleExit('SIGTERM'));
    process.on('exit', () => this.handleExit('exit'));
  }

  private async handleExit(signal: string): Promise<void> {
    debug(`Process ${signal} received, cleaning up wstunnel instances`);
    try {
      await this.clear();
    } catch (error) {
      debug(`Error during cleanup: ${error}`);
    }
  }

  async define(uuid: string, port: number): Promise<void> {
    debug(`Defining wstunnel for UUID: ${uuid}, port: ${port}`);
    
    try {
      // Create subdomain
      const fullDomain = `${uuid}.${this.subdomainManager.domain}`;
      debug(`Creating subdomain: ${fullDomain} -> 127.0.0.1:${port}`);
      
      await this.subdomainManager.define(uuid, {
        ip: '127.0.0.1',
        port: port
      });
      
      // Start tmux session with wstunnel
      const sessionName = `hasyx_${this._id}_${uuid}`;
      debug(`Starting tmux session: ${sessionName}`);
      
      // Create tmux session and run wstunnel server
      const tmuxCommand = [
        'tmux', 'new-session', '-d', '-s', sessionName,
        'wstunnel', 'server', `ws://0.0.0.0:${port}`, '--to', 'localhost:5000'
      ];
      
      const tmuxProcess = spawn(tmuxCommand[0], tmuxCommand.slice(1), {
        stdio: 'pipe',
        detached: true
      });
      
      tmuxProcess.on('error', (error) => {
        debug(`Error starting tmux session ${sessionName}: ${error}`);
        throw error;
      });
      
      // Wait a bit for tmux to start
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify tmux session is running
      const checkResult = spawn('tmux', ['has-session', '-t', sessionName], { stdio: 'pipe' });
      
      await new Promise((resolve, reject) => {
        checkResult.on('exit', (code) => {
          if (code === 0) {
            debug(`Tmux session ${sessionName} started successfully`);
            resolve(void 0);
          } else {
            reject(new Error(`Failed to start tmux session ${sessionName}`));
          }
        });
      });
      
      // Store the mapping
      this._list.set(uuid, port);
      debug(`Wstunnel defined successfully for UUID: ${uuid}`);
      
    } catch (error) {
      debug(`Error defining wstunnel for UUID ${uuid}: ${error}`);
      // Cleanup on failure
      try {
        await this.undefine(uuid);
      } catch (cleanupError) {
        debug(`Error during cleanup: ${cleanupError}`);
      }
      throw error;
    }
  }

  async undefine(uuid: string): Promise<void> {
    debug(`Undefining wstunnel for UUID: ${uuid}`);
    
    try {
      // Kill tmux session
      const sessionName = `hasyx_${this._id}_${uuid}`;
      debug(`Killing tmux session: ${sessionName}`);
      
      const killResult = spawn('tmux', ['kill-session', '-t', sessionName], { stdio: 'pipe' });
      
      await new Promise((resolve) => {
        killResult.on('exit', (code) => {
          if (code === 0) {
            debug(`Tmux session ${sessionName} killed successfully`);
          } else {
            debug(`Tmux session ${sessionName} was not running or already killed`);
          }
          resolve(void 0);
        });
      });
      
      // Remove subdomain
      try {
        await this.subdomainManager.undefine(uuid);
        debug(`Subdomain undefined for UUID: ${uuid}`);
      } catch (error) {
        debug(`Error undefining subdomain for UUID ${uuid}: ${error}`);
      }
      
      // Remove from list
      this._list.delete(uuid);
      debug(`Wstunnel undefined successfully for UUID: ${uuid}`);
      
    } catch (error) {
      debug(`Error undefining wstunnel for UUID ${uuid}: ${error}`);
      throw error;
    }
  }

  async clearUnused(): Promise<void> {
    debug('Clearing unused tmux sessions');
    
    try {
      // Get list of tmux sessions
      const listResult = spawn('tmux', ['list-sessions', '-F', '#{session_name}'], { stdio: 'pipe' });
      
      let output = '';
      listResult.stdout?.on('data', (data) => {
        output += data.toString();
      });
      
      await new Promise((resolve) => {
        listResult.on('exit', () => resolve(void 0));
      });
      
      const sessions = output.trim().split('\n').filter(s => s.length > 0);
      debug(`Found tmux sessions: ${sessions.join(', ')}`);
      
      // Kill sessions that match hasyx pattern but don't belong to this instance or aren't in our list
      for (const session of sessions) {
        if (session.startsWith('hasyx_')) {
          const parts = session.split('_');
          if (parts.length === 3) {
            const [, sessionId, uuid] = parts;
            
            // Kill if it's not our instance or not in our list
            if (sessionId !== this._id || !this._list.has(uuid)) {
              debug(`Killing unused session: ${session}`);
              spawn('tmux', ['kill-session', '-t', session], { stdio: 'pipe' });
            }
          }
        }
      }
      
    } catch (error) {
      debug(`Error clearing unused sessions: ${error}`);
    }
  }

  async clear(): Promise<void> {
    debug('Clearing all wstunnel instances for this manager');
    
    try {
      // Kill all sessions belonging to this instance
      const sessions = Array.from(this._list.keys());
      
      for (const uuid of sessions) {
        await this.undefine(uuid);
      }
      
      debug('All wstunnel instances cleared');
      
    } catch (error) {
      debug(`Error clearing wstunnel instances: ${error}`);
      throw error;
    }
  }

  getList(): Map<string, number> {
    return new Map(this._list);
  }

  getId(): string {
    return this._id;
  }
}

// Global instance storage
let globalWstunnelInstance: Wstunnel | null = null;

export async function handleWstunnel(options: WstunnelOptions): Promise<WstunnelResult> {
  debug('Handling wstunnel request with options:', options);
  
  try {
    // Check if running in Vercel environment
    if (process.env.VERCEL) {
      throw new Error('Wstunnel is not supported in serverless Vercel environment');
    }
    
    // Validate required environment variables
    const requiredEnvVars = [
      'HASYX_DNS_DOMAIN',
      'CLOUDFLARE_API_TOKEN',
      'CLOUDFLARE_ZONE_ID',
      'LETSENCRYPT_EMAIL'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
    
    // Create or reuse global Wstunnel instance
    if (!globalWstunnelInstance) {
      debug('Creating new Wstunnel instance');
      
      const subdomainManager = new SubdomainManager({
        cloudflare: new CloudFlare({
          apiToken: process.env.CLOUDFLARE_API_TOKEN!,
          zoneId: process.env.CLOUDFLARE_ZONE_ID!,
          domain: process.env.HASYX_DNS_DOMAIN!
        }),
        ssl: new SSL({
          email: process.env.LETSENCRYPT_EMAIL!
        }),
        nginx: new Nginx()
      });
      
      globalWstunnelInstance = new Wstunnel(subdomainManager);
    }
    
    // Clear unused sessions first
    await globalWstunnelInstance.clearUnused();
    
    if (options.undefine && options.uuid) {
      // Undefine specific UUID
      debug(`Undefining wstunnel for UUID: ${options.uuid}`);
      await globalWstunnelInstance.undefine(options.uuid);
      
      return {
        success: true,
        uuid: options.uuid
      };
    } else if (options.uuid) {
      // Define new tunnel for specific UUID
      debug(`Defining wstunnel for UUID: ${options.uuid}`);
      
      // Find available port
      const port = await findPort(5000, 6000);
      
      await globalWstunnelInstance.define(options.uuid, port);
      
      return {
        success: true,
        uuid: options.uuid,
        port: port,
        subdomain: `${options.uuid}.${process.env.HASYX_DNS_DOMAIN}`
      };
    } else {
      throw new Error('UUID must be provided');
    }
    
  } catch (error) {
    debug(`Error handling wstunnel request: ${error}`);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
} 