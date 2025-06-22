import { v4 as uuidv4 } from 'uuid';
import { API_URL } from './url';
import Debug from './debug';

const debug = Debug('passive:client');

interface PassiveOptions {
  onDone: (jwt: string) => void;
}

export class PassiveClient {
  public id: string = '';
  public interval: number | null = null;
  public time: number = 1000;
  private onDone: (jwt: string) => void;

  constructor(options: PassiveOptions) {
    this.onDone = options.onDone;
    this.update();
  }

  update(): void {
    debug('Updating passive client ID');
    this.id = uuidv4();
    
    if (this.interval !== null) {
      this.stop();
      this.start();
    }
  }

  async check(): Promise<void> {
    debug(`Checking passive auth status for ID: ${this.id}`);
    
    try {
      const response = await fetch(`${API_URL}/api/auth_passive?passive=${this.id}`);
      const data = await response.json();
      
      debug('Passive auth response:', data);
      
      switch (data.status) {
        case 'lost':
          debug('Passive auth lost, stopping interval');
          this.stop();
          // Remove from localStorage if exists
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('nextauth_passive_id');
          }
          break;
        case 'await':
          debug('Passive auth still waiting');
          break;
        case 'done':
          debug('Passive auth completed, calling onDone');
          this.stop();
          // Remove from localStorage
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('nextauth_passive_id');
          }
          this.onDone(data.jwt);
          break;
        default:
          debug('Unknown passive auth status:', data.status);
      }
    } catch (error) {
      debug('Error checking passive auth status:', error);
    }
  }

  start(): void {
    debug(`Starting passive auth interval with ${this.time}ms delay`);
    
    if (this.interval !== null) {
      this.stop();
    }
    
    // Save to localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('nextauth_passive_id', this.id);
    }
    
    this.interval = setInterval(() => {
      this.check();
    }, this.time) as any;
  }

  stop(): void {
    debug('Stopping passive auth interval');
    
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

// Auto-start passive client if ID exists in localStorage
export function initPassiveClient(): PassiveClient | null {
  const savedPassiveId = localStorage.getItem('nextauth_passive_id');
  if (!savedPassiveId) return null;
  
  debug('Found saved passive ID, initializing client');
  
  const client = new PassiveClient({
    onDone: (jwt: string) => {
      debug('Passive authentication completed, saving JWT');
      localStorage.setItem('nextauth_jwt', jwt);
      localStorage.removeItem('nextauth_passive_id');
      localStorage.removeItem('nextauth_passive_redirect');
    }
  });
  
  // Use the saved ID instead of generating new one
  client.id = savedPassiveId;
  client.start();
  
  return client;
} 