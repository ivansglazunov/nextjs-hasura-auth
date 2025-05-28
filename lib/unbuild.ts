import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';
import Debug from './debug';
import { findProjectRoot } from './cli-hasyx';

const debug = Debug('unbuild');

export const unbuildCommand = async () => {
  debug('Executing "unbuild" command.');
  console.log('🧹 Removing compiled files (.js, .d.ts) from lib, components, and hooks directories...');
  
  const projectRoot = findProjectRoot();
  debug(`Project root: ${projectRoot}`);
  
  // Directories to clean
  const dirsToClean = ['lib', 'components', 'hooks'];
  
  // Files to remove
  const patterns = [
    '**/*.js',
    '**/*.d.ts'
  ];
  
  let totalFilesRemoved = 0;
  
  for (const dir of dirsToClean) {
    const dirPath = path.join(projectRoot, dir);
    
    if (!fs.existsSync(dirPath)) {
      console.log(`⏩ Skipped ${dir}/ (directory does not exist)`);
      debug(`Directory does not exist: ${dirPath}`);
      continue;
    }
    
    console.log(`🔍 Cleaning ${dir}/ directory...`);
    debug(`Cleaning directory: ${dirPath}`);
    
    for (const pattern of patterns) {
      try {
        const files = await glob(pattern, {
          cwd: dirPath,
          absolute: true,
          ignore: [
            '**/types/**', // Preserve types directory
            '**/node_modules/**'
          ]
        });
        
        debug(`Found ${files.length} files matching pattern ${pattern} in ${dir}/`);
        
        for (const file of files) {
          try {
            await fs.remove(file);
            const relativePath = path.relative(projectRoot, file);
            console.log(`🗑️  Removed: ${relativePath}`);
            debug(`Removed file: ${file}`);
            totalFilesRemoved++;
          } catch (error) {
            console.warn(`⚠️ Failed to remove ${file}:`, error);
            debug(`Failed to remove file ${file}: ${error}`);
          }
        }
      } catch (error) {
        console.warn(`⚠️ Error finding files with pattern ${pattern} in ${dir}/:`, error);
        debug(`Error with glob pattern ${pattern} in ${dirPath}: ${error}`);
      }
    }
  }
  
  // Remove TypeScript build info file
  const tsBuildInfoPath = path.join(projectRoot, 'tsconfig.lib.tsbuildinfo');
  if (fs.existsSync(tsBuildInfoPath)) {
    try {
      await fs.remove(tsBuildInfoPath);
      console.log('🗑️  Removed: tsconfig.lib.tsbuildinfo');
      debug('Removed TypeScript build info file');
      totalFilesRemoved++;
    } catch (error) {
      console.warn('⚠️ Failed to remove tsconfig.lib.tsbuildinfo:', error);
      debug(`Failed to remove TypeScript build info: ${error}`);
    }
  } else {
    debug('TypeScript build info file does not exist');
  }
  
  // Remove .next build cache if it exists
  const nextBuildPath = path.join(projectRoot, '.next');
  if (fs.existsSync(nextBuildPath)) {
    try {
      await fs.remove(nextBuildPath);
      console.log('🗑️  Removed: .next/ (build cache)');
      debug('Removed Next.js build cache');
      totalFilesRemoved++;
    } catch (error) {
      console.warn('⚠️ Failed to remove .next/ build cache:', error);
      debug(`Failed to remove Next.js build cache: ${error}`);
    }
  } else {
    debug('Next.js build cache does not exist');
  }
  
  console.log(`✅ Cleaned ${totalFilesRemoved} compiled files (types directory preserved)`);
  console.log('✨ Unbuild completed successfully!');
  debug(`Finished "unbuild" command. Total files removed: ${totalFilesRemoved}`);
}; 