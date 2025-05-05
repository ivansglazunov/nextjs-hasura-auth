import type { NextConfig } from "next";
// Removed fs, path imports as they are no longer needed here

// Use environment variables to determine build mode and base path
const buildTarget = process.env.NEXT_PUBLIC_BUILD_TARGET;
const isBuildingForClient = buildTarget === 'client';

// Read basePath directly from environment. 
const basePath = process.env.NEXT_PUBLIC_BASE_PATH;

// basePath and distDir are now removed, relying on actions/configure-pages@v5 or defaults
console.log(`Building config: isClient=${isBuildingForClient}, basePath=${basePath}`);

const config: NextConfig = {
  // Conditionally set output to 'export'
  output: isBuildingForClient ? 'export' : undefined,
  // Explicitly set distDir again
  distDir: isBuildingForClient ? 'client' : '.next',
  // Explicitly set basePath again
  basePath: basePath, 
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
  
  // Add CORS headers to all API routes
  async headers() {
    return [
      {
        // Apply CORS headers to all API routes - used for regular requests
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-Hasura-Role, X-Hasura-User-Id, apollo-require-preflight, X-Apollo-Operation-Name, X-Apollo-Operation-Id, X-Apollo-Tracing, x-apollo-tracing' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Max-Age', value: '86400' },
        ],
      },
    ];
  },
};

// REMOVED the entire block that was moving the app/api directory.
// Next.js with output: 'export' will handle API routes appropriately 
// (either build them if static GET, or error if dynamic).

export default config;
