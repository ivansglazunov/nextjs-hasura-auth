import { createServer } from 'net';
import Debug from './debug';

const debug = Debug('find-port');

/**
 * Find a random available port in the specified range
 * @param start Starting port number
 * @param end Ending port number
 * @returns Promise resolving to an available port number
 */
export async function findPort(start: number, end: number): Promise<number> {
  debug(`Finding available port in range ${start}-${end}`);
  
  if (start > end) {
    throw new Error('Start port must be less than or equal to end port');
  }
  
  const checkPort = (port: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const server = createServer();
      
      server.listen(port, () => {
        server.close(() => {
          debug(`Port ${port} is available`);
          resolve(true);
        });
      });
      
      server.on('error', () => {
        debug(`Port ${port} is not available`);
        resolve(false);
      });
    });
  };
  
  // Try random ports in the range to avoid sequential allocation
  const range = end - start + 1;
  const attempts = Math.min(range, 100); // Limit attempts to avoid infinite loop
  
  for (let i = 0; i < attempts; i++) {
    const randomOffset = Math.floor(Math.random() * range);
    const port = start + randomOffset;
    
    if (await checkPort(port)) {
      debug(`Found available port: ${port}`);
      return port;
    }
  }
  
  throw new Error(`No available port found in range ${start}-${end} after ${attempts} attempts`);
} 