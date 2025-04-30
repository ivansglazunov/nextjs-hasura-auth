import type { NextConfig } from "next";
// Removed fs, path imports as they are no longer needed here

// Use environment variables to determine build mode and base path
const buildTarget = process.env.NEXT_PUBLIC_BUILD_TARGET;
const isBuildingForClient = buildTarget === 'client';
// Read basePath from environment, default to undefined if not set

let basePath = process.env.NEXT_PUBLIC_BASE_PATH;

// Fallback for GitHub Actions if basePath is not explicitly set
if (!basePath && process.env.GITHUB_REPOSITORY) {
  const repoName = process.env.GITHUB_REPOSITORY.split('/')[1];
  basePath = `/${repoName}`; // Correct: Generate path like /hasyx
  console.log(`   -> Using GitHub Repository for basePath: ${basePath}`);
}

console.log(`Building config: isClient=${isBuildingForClient}, basePath=${basePath}`);

const config: NextConfig = {
  // Conditionally set output to 'export'
  output: isBuildingForClient ? 'export' : undefined,
  // Conditionally set distDir
  distDir: isBuildingForClient ? 'client' : '.next',
  // Set basePath from environment variable (will be undefined for non-client or default client builds)
  basePath: basePath, 
  // Keep trailingSlash for client build if needed for Capacitor/static server paths
  trailingSlash: isBuildingForClient, // basePath affects this, ensure compatibility
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
    // Keep unoptimized for client build (often needed for static export)
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
