import { NextRequest, NextResponse } from 'next/server';
import pckg from '@/package.json';

export async function GET(request: NextRequest) {
  // Get build timestamp or version
  const version = pckg.version;
  const buildTime = process.env.BUILD_TIME || new Date().toISOString();
  
  // Prevent caching of this endpoint
  const headers = {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  };

  const versionInfo = {
    version,
    timestamp: buildTime,
    nodeVersion: process.version,
    platform: process.platform,
    lastModified: new Date().toISOString()
  };

  return NextResponse.json(versionInfo, { headers });
} 