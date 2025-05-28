import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';

// Configure marked to use terminal renderer
marked.setOptions({
  renderer: new TerminalRenderer({
    // Code blocks
    code: (code: string, lang?: string) => {
      return `\n\x1b[90m\x1b[47m ${lang || 'code'} \x1b[0m\n\x1b[100m\x1b[37m${code}\x1b[0m\n`;
    },
    
    // Block quotes
    blockquote: (quote: string) => {
      return `\x1b[90m│ \x1b[0m${quote.replace(/\n/g, '\n\x1b[90m│ \x1b[0m')}`;
    },
    
    // Headers
    heading: (text: string, level: number) => {
      const colors = [
        '\x1b[95m', // H1 - Bright Magenta
        '\x1b[94m', // H2 - Bright Blue  
        '\x1b[93m', // H3 - Bright Yellow
        '\x1b[92m', // H4 - Bright Green
        '\x1b[96m', // H5 - Bright Cyan
        '\x1b[91m'  // H6 - Bright Red
      ];
      const color = colors[level - 1] || '\x1b[97m';
      const prefix = '#'.repeat(level);
      return `\n${color}${prefix} ${text}\x1b[0m\n`;
    },
    
    // Horizontal rules
    hr: () => {
      return '\n\x1b[90m' + '─'.repeat(50) + '\x1b[0m\n';
    },
    
    // Lists
    list: (body: string, ordered: boolean) => {
      return body;
    },
    
    listitem: (text: string) => {
      return `\x1b[96m• \x1b[0m${text}`;
    },
    
    // Paragraphs
    paragraph: (text: string) => {
      return `${text}\n`;
    },
    
    // Tables
    table: (header: string, body: string) => {
      return `\n${header}${body}\n`;
    },
    
    tablerow: (content: string) => {
      return `${content}\n`;
    },
    
    tablecell: (content: string, flags: any) => {
      return `${content} `;
    },
    
    // Inline formatting
    strong: (text: string) => {
      return `\x1b[1m${text}\x1b[0m`;
    },
    
    em: (text: string) => {
      return `\x1b[3m${text}\x1b[0m`;
    },
    
    codespan: (text: string) => {
      return `\x1b[100m\x1b[37m ${text} \x1b[0m`;
    },
    
    del: (text: string) => {
      return `\x1b[9m${text}\x1b[0m`;
    },
    
    link: (href: string, title: string, text: string) => {
      return `\x1b[94m\x1b[4m${text}\x1b[0m \x1b[90m(${href})\x1b[0m`;
    },
    
    image: (href: string, title: string, text: string) => {
      return `\x1b[93m[Image: ${text}]\x1b[0m \x1b[90m(${href})\x1b[0m`;
    }
  })
});

/**
 * Format markdown text for beautiful terminal output
 */
export async function formatMarkdown(markdown: string): Promise<string> {
  try {
    const result = await marked(markdown);
    return typeof result === 'string' ? result : String(result);
  } catch (error) {
    console.error('Error formatting markdown:', error);
    return markdown; // Fallback to original text
  }
}

/**
 * Print markdown to terminal with beautiful formatting
 */
export async function printMarkdown(markdown: string): Promise<void> {
  const formatted = await formatMarkdown(markdown);
  console.log(formatted);
}

/**
 * Format and return markdown with custom styling
 */
export async function formatMarkdownCustom(markdown: string, options?: {
  codeTheme?: 'dark' | 'light';
  linkStyle?: 'underline' | 'brackets';
  headerStyle?: 'hash' | 'underline';
}): Promise<string> {
  const opts = {
    codeTheme: 'dark',
    linkStyle: 'underline',
    headerStyle: 'hash',
    ...options
  };

  // Create custom renderer based on options
  const customRenderer = new TerminalRenderer({
    code: (code: string, lang?: string) => {
      if (opts.codeTheme === 'light') {
        return `\n\x1b[30m\x1b[107m ${lang || 'code'} \x1b[0m\n\x1b[107m\x1b[30m${code}\x1b[0m\n`;
      }
      return `\n\x1b[90m\x1b[47m ${lang || 'code'} \x1b[0m\n\x1b[100m\x1b[37m${code}\x1b[0m\n`;
    },
    
    link: (href: string, title: string, text: string) => {
      if (opts.linkStyle === 'brackets') {
        return `\x1b[94m${text}\x1b[0m \x1b[90m[${href}]\x1b[0m`;
      }
      return `\x1b[94m\x1b[4m${text}\x1b[0m \x1b[90m(${href})\x1b[0m`;
    },
    
    heading: (text: string, level: number) => {
      if (opts.headerStyle === 'underline') {
        const colors = ['\x1b[95m', '\x1b[94m', '\x1b[93m', '\x1b[92m', '\x1b[96m', '\x1b[91m'];
        const color = colors[level - 1] || '\x1b[97m';
        const underline = level <= 2 ? '='.repeat(text.length) : '-'.repeat(text.length);
        return `\n${color}${text}\x1b[0m\n\x1b[90m${underline}\x1b[0m\n`;
      }
      const colors = ['\x1b[95m', '\x1b[94m', '\x1b[93m', '\x1b[92m', '\x1b[96m', '\x1b[91m'];
      const color = colors[level - 1] || '\x1b[97m';
      const prefix = '#'.repeat(level);
      return `\n${color}${prefix} ${text}\x1b[0m\n`;
    }
  });

  const tempMarked = marked.setOptions({ renderer: customRenderer });
  const result = await tempMarked(markdown);
  return typeof result === 'string' ? result : String(result);
}

/**
 * Utility to strip ANSI colors from formatted text
 */
export function stripColors(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Get terminal width for responsive formatting
 */
export function getTerminalWidth(): number {
  return process.stdout.columns || 80;
}

/**
 * Wrap text to terminal width
 */
export function wrapText(text: string, width?: number): string {
  const termWidth = width || getTerminalWidth();
  const lines = text.split('\n');
  const wrappedLines: string[] = [];
  
  for (const line of lines) {
    if (stripColors(line).length <= termWidth) {
      wrappedLines.push(line);
    } else {
      // Simple word wrapping (preserving ANSI codes is complex)
      const words = line.split(' ');
      let currentLine = '';
      
      for (const word of words) {
        if (stripColors(currentLine + ' ' + word).length <= termWidth) {
          currentLine += (currentLine ? ' ' : '') + word;
        } else {
          if (currentLine) wrappedLines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) wrappedLines.push(currentLine);
    }
  }
  
  return wrappedLines.join('\n');
}

export default {
  formatMarkdown,
  printMarkdown,
  formatMarkdownCustom,
  stripColors,
  getTerminalWidth,
  wrapText
}; 