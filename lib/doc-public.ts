#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

export interface MarkdownHeading {
  level: number;
  text: string;
  id: string;
}

export interface MarkdownFile {
  filename: string;
  title: string;
  headings: MarkdownHeading[];
  content: string;
  path: string;
}

export interface DocIndex {
  files: MarkdownFile[];
  lastUpdated: string;
}

export interface SidebarItem {
  title: string;
  url: string;
  collapse?: boolean;
  items?: SidebarItem[];
  level?: number;
}

export interface DocNavigation {
  items: SidebarItem[];
  lastUpdated: string;
}

/**
 * Converts text to URL-friendly slug
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Parses markdown content and extracts headings
 */
export function parseMarkdownHeadings(content: string): MarkdownHeading[] {
  const headings: MarkdownHeading[] = [];
  const lines = content.split('\n');
  
  let inCodeBlock = false;
  let codeBlockDelimiter = '';
  
  for (const line of lines) {
    // Check for code block start/end
    const trimmedLine = line.trim();
    
    // Check for fenced code blocks (``` or ```)
    if (trimmedLine.startsWith('```') || trimmedLine.startsWith('~~~')) {
      if (!inCodeBlock) {
        // Starting a code block
        inCodeBlock = true;
        codeBlockDelimiter = trimmedLine.substring(0, 3);
      } else if (trimmedLine.startsWith(codeBlockDelimiter)) {
        // Ending a code block
        inCodeBlock = false;
        codeBlockDelimiter = '';
      }
      continue;
    }
    
    // Skip processing if we're inside a code block
    if (inCodeBlock) {
      continue;
    }
    
    // Check for inline code spans and skip lines that are primarily code
    // This handles cases like `# some code` or lines with multiple inline code blocks
    const inlineCodeRegex = /`[^`]*`/g;
    const lineWithoutInlineCode = line.replace(inlineCodeRegex, '');
    
    // Only process the line without inline code for heading detection
    const match = lineWithoutInlineCode.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      // Get the original text from the line, but clean it up
      const originalMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (originalMatch) {
        const text = originalMatch[2].trim();
        const id = slugify(text);
        
        headings.push({
          level,
          text,
          id
        });
      }
    }
  }
  
  return headings;
}

/**
 * Gets the first heading from markdown content as title
 */
export function getMarkdownTitle(content: string): string {
  const headings = parseMarkdownHeadings(content);
  return headings.length > 0 ? headings[0].text : 'Untitled';
}

/**
 * Scans directory for markdown files and returns their metadata
 */
export function scanMarkdownFiles(rootDir: string = process.cwd()): MarkdownFile[] {
  const markdownFiles: MarkdownFile[] = [];
  
  function scanDirectory(dir: string) {
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Skip node_modules, .git, and other common directories
          if (!item.startsWith('.') && item !== 'node_modules' && item !== 'dist' && item !== 'build' && item !== 'public') {
            scanDirectory(fullPath);
          }
        } else if (item.endsWith('.md') && !item.endsWith('.experiment.md')) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const headings = parseMarkdownHeadings(content);
            const title = getMarkdownTitle(content);
            const relativePath = path.relative(rootDir, fullPath);
            
            markdownFiles.push({
              filename: item,
              title,
              headings,
              content,
              path: relativePath
            });
          } catch (error) {
            console.warn(`Failed to read markdown file: ${fullPath}`, error);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to scan directory: ${dir}`, error);
    }
  }
  
  scanDirectory(rootDir);
  return markdownFiles;
}

/**
 * Creates navigation structure for sidebar from markdown files
 */
export function createDocNavigationStructure(markdownFiles: MarkdownFile[]): SidebarItem[] {
  const items: SidebarItem[] = [];
  
  for (const file of markdownFiles) {
    const safeFilename = file.filename.replace(/[^a-zA-Z0-9.-]/g, '_').replace('.md', '');
    const mainItem: SidebarItem = {
      title: file.title,
      url: `/hasyx/doc/${encodeURIComponent(safeFilename)}`,
      collapse: true, // Make each document collapsible
      items: [],
      level: file.headings[0]?.level
    };
    
    // Add sub-headings as nested items (only level 2 and 3 headings)
    if (file.headings && file.headings.length > 1) {
      for (const heading of file.headings.slice(1)) {
        if (heading.level <= 3) {
          mainItem.items!.push({
            title: heading.text,
            url: `/hasyx/doc/${encodeURIComponent(safeFilename)}#${heading.id}`,
            level: heading.level
          });
        }
      }
    }
    
    // Only add items array if there are sub-items
    if (mainItem.items!.length === 0) {
      delete mainItem.items;
      delete mainItem.collapse; // No need to collapse if no sub-items
    }
    
    items.push(mainItem);
  }
  
  return items;
}

/**
 * Copies markdown files to public/doc directory and creates index
 */
export function buildDocumentation(rootDir: string = process.cwd()) {
  console.log('📚 Building documentation...');
  console.log('ℹ️ Ignoring *.experiment.md files');
  
  const publicDocDir = path.join(rootDir, 'public', '_doc');
  const appDocDir = path.join(rootDir, 'app', 'hasyx', 'doc');
  
  // Ensure directories exist
  if (!fs.existsSync(publicDocDir)) {
    fs.mkdirSync(publicDocDir, { recursive: true });
  }
  if (!fs.existsSync(appDocDir)) {
    fs.mkdirSync(appDocDir, { recursive: true });
  }
  
  // Clean existing files
  const existingFiles = fs.readdirSync(publicDocDir);
  for (const file of existingFiles) {
    if (file.endsWith('.md') || file === 'index.json' || file === 'md.json') {
      fs.unlinkSync(path.join(publicDocDir, file));
    }
  }
  
  // Scan for markdown files
  const markdownFiles = scanMarkdownFiles(rootDir);
  
  console.log(`Found ${markdownFiles.length} markdown files`);
  
  // Copy files and create index
  const docIndex: DocIndex = {
    files: [],
    lastUpdated: new Date().toISOString()
  };
  
  for (const file of markdownFiles) {
    // Create unique filename to avoid conflicts
    const safeFilename = file.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const targetPath = path.join(publicDocDir, safeFilename);
    
    // Copy markdown file
    fs.writeFileSync(targetPath, file.content);
    
    // Add to index (without content to keep it lightweight)
    docIndex.files.push({
      filename: safeFilename,
      title: file.title,
      headings: file.headings,
      content: '', // Don't include content in index
      path: file.path
    });
    
    console.log(`  ✓ ${file.path} -> ${safeFilename}`);
  }
  
  // Write index file
  fs.writeFileSync(
    path.join(publicDocDir, 'index.json'),
    JSON.stringify(docIndex, null, 2)
  );
  
  // Create navigation structure for sidebar
  const navigationItems = createDocNavigationStructure(markdownFiles);
  const docNavigation: DocNavigation = {
    items: navigationItems,
    lastUpdated: new Date().toISOString()
  };
  
  // Write md.json file to app/hasyx/doc/
  fs.writeFileSync(
    path.join(appDocDir, 'md.json'),
    JSON.stringify(docNavigation, null, 2)
  );
  
  // Also write md.json to public/_doc/ for HTTP access
  fs.writeFileSync(
    path.join(publicDocDir, 'md.json'),
    JSON.stringify(docNavigation, null, 2)
  );
  
  console.log(`✅ Documentation built successfully! ${markdownFiles.length} files processed.`);
  console.log(`📄 Navigation structure saved to app/hasyx/doc/md.json`);
  console.log(`🌐 Navigation structure also available at /_doc/md.json`);
}

// Run if called directly
if (require.main === module) {
  buildDocumentation();
} 