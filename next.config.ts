import type { NextConfig } from "next";
// Removed fs, path imports as they are no longer needed here

// Use environment variables to determine build mode
const buildTarget = process.env.NEXT_PUBLIC_BUILD_TARGET;
const isBuildingForClient = buildTarget === 'client';

// basePath and distDir are now removed, relying on actions/configure-pages@v5 or defaults
console.log(`Building config: isClient=${isBuildingForClient}`);

const config: NextConfig = {
  // Conditionally set output to 'export'
  output: isBuildingForClient ? 'export' : undefined,
  // distDir: isBuildingForClient ? 'client' : '.next', // REMOVED
  // basePath: process.env.NEXT_PUBLIC_BASE_PATH, // REMOVED
  // trailingSlash should likely be true for static exports compatibility, especially with basePath
  trailingSlash: isBuildingForClient, 
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
    // keep unoptimized for static export
    unoptimized: isBuildingForClient,
  },
  // Keep these if needed for client export compatibility
  skipTrailingSlashRedirect: isBuildingForClient,
  skipMiddlewareUrlNormalize: isBuildingForClient,
  
  // Keep ignoring errors during client build if necessary, 
  // but be aware this might hide real issues with static export incompatibility.
  // Consider removing these ignore flags later to see actual Next.js errors.
  typescript: {
    ignoreBuildErrors: isBuildingForClient,
  },
  eslint: {
    ignoreDuringBuilds: isBuildingForClient,
  },
  // Remove onDemandEntries if not specifically needed
  // onDemandEntries: isBuildingForClient ? { maxInactiveAge: 1 } : undefined,
};

// REMOVED the entire block that was moving the app/api directory.
// Next.js with output: 'export' will handle API routes appropriately 
// (either build them if static GET, or error if dynamic).

export default config;
