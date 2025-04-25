import type { NextConfig } from "next";
import fs from 'fs';
import path from 'path';

// Detect if we're building for client (Capacitor) based on build script name
const isBuildingForClient = process.env.npm_lifecycle_event === 'build:client';

let config: NextConfig = {
  output: isBuildingForClient ? 'export' : undefined,
  distDir: isBuildingForClient ? 'client' : '.next',
  trailingSlash: isBuildingForClient, // Helps with static file paths
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
    unoptimized: isBuildingForClient, // Only unoptimize for client build
  },
  // For App Router static export
  skipTrailingSlashRedirect: isBuildingForClient,
  skipMiddlewareUrlNormalize: isBuildingForClient,
  // Disable type checking and linting during client build
  typescript: {
    ignoreBuildErrors: isBuildingForClient,
  },
  eslint: {
    ignoreDuringBuilds: isBuildingForClient,
  },
};

// If we're building for client, exclude API routes completely
if (isBuildingForClient) {
  config = {
    ...config,
    eslint: {
      ignoreDuringBuilds: true, // Skip ESLint checks for client builds
    },
    typescript: {
      ignoreBuildErrors: true, // Skip TypeScript errors for client builds
    },
    onDemandEntries: {
      // Don't keep pages in memory during client builds
      maxInactiveAge: 1,
    },
  };
  
  // Create a temporary patch to exclude API routes from static export
  // This is a temporary workaround until Next.js provides better static export controls
  if (fs.existsSync('app/api')) {
    const tmpApiBackupDir = path.join('app', '_api_backup');
    if (!fs.existsSync(tmpApiBackupDir)) {
      fs.mkdirSync(tmpApiBackupDir, { recursive: true });
    }
    
    try {
      // Move the api directory temporarily
      fs.renameSync(path.join('app', 'api'), path.join(tmpApiBackupDir, 'api'));
      
      // Create a callback to restore the API directory after build
      process.on('exit', () => {
        if (fs.existsSync(path.join(tmpApiBackupDir, 'api'))) {
          try {
            fs.renameSync(path.join(tmpApiBackupDir, 'api'), path.join('app', 'api'));
            fs.rmdirSync(tmpApiBackupDir);
            console.log('✅ API routes restored after client build');
          } catch (err) {
            console.error('❌ Error restoring API routes:', err);
          }
        }
      });
      
      // Also handle early termination signals
      ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
        process.on(signal, () => {
          process.exit(0);
        });
      });
      
      console.log('✅ API routes temporarily removed for static export');
    } catch (err) {
      console.error('❌ Error handling API routes for static export:', err);
    }
  }
}

export default config;
