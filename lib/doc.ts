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

export interface DocSection {
  title: string;
  items: {
    title: string;
    url: string;
    items?: {
      title: string;
      url: string;
    }[];
  }[];
}

export interface DocNavigation {
  items: {
    title: string;
    url: string;
    items?: {
      title: string;
      url: string;
    }[];
  }[];
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
  
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      const id = slugify(text);
      
      headings.push({
        level,
        text,
        id
      });
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
 * Fetches documentation index from public/_doc/index.json
 */
export async function getDocumentationIndex(): Promise<DocIndex> {
  try {
    const response = await fetch('/_doc/index.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch documentation index: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.warn('Failed to load documentation index:', error);
    return {
      files: [],
      lastUpdated: new Date().toISOString()
    };
  }
}

/**
 * Fetches markdown files from documentation index
 */
export async function getMarkdownFiles(): Promise<MarkdownFile[]> {
  const index = await getDocumentationIndex();
  return index.files;
}

/**
 * Creates navigation structure for sidebar from static md.json file
 * This function is kept for backward compatibility but now uses static data
 */
export async function createDocNavigation(): Promise<DocSection> {
  try {
    // Try to fetch from static md.json file first
    const response = await fetch('/_doc/md.json');
    if (response.ok) {
      const docNavigation: DocNavigation = await response.json();
      return {
        title: "Documentation",
        items: docNavigation.items
      };
    }
  } catch (error) {
    console.warn('Failed to load static documentation navigation, falling back to dynamic generation:', error);
  }
  
  // Fallback to dynamic generation if static file is not available
  const markdownFiles = await getMarkdownFiles();
  
  const docSection: DocSection = {
    title: "Documentation",
    items: []
  };
  
  for (const file of markdownFiles) {
    const baseUrl = `/hasyx/doc/${encodeURIComponent(file.filename.replace('.md', ''))}`;
    
    // Create main item for the file
    const mainItem = {
      title: file.title,
      url: baseUrl,
      items: [] as { title: string; url: string; }[]
    };
    
    // Add sub-headings as sub-items (only level 2 and 3 headings)
    for (const heading of file.headings) {
      if (heading.level >= 2 && heading.level <= 3) {
        mainItem.items.push({
          title: heading.text,
          url: `${baseUrl}#${heading.id}`
        });
      }
    }
    
    docSection.items.push(mainItem);
  }
  
  return docSection;
}

/**
 * Gets markdown file by filename
 */
export async function getMarkdownFile(filename: string): Promise<MarkdownFile | null> {
  try {
    const index = await getDocumentationIndex();
    const fileInfo = index.files.find(file => 
      file.filename.replace('.md', '') === filename ||
      file.filename === filename
    );
    
    if (!fileInfo) {
      return null;
    }
    
    // Fetch the actual content
    const response = await fetch(`/_doc/${fileInfo.filename}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch markdown file: ${response.status}`);
    }
    
    const content = await response.text();
    
    return {
      ...fileInfo,
      content
    };
  } catch (error) {
    console.warn(`Failed to load markdown file: ${filename}`, error);
    return null;
  }
} 