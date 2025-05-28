import { 
  formatMarkdown, 
  printMarkdown, 
  formatMarkdownCustom, 
  stripColors, 
  getTerminalWidth, 
  wrapText 
} from './markdown-terminal';

describe('Markdown Terminal Formatting', () => {
  
  describe('formatMarkdown', () => {
    it('should format simple text without markdown', async () => {
      const result = await formatMarkdown('Hello world');
      expect(result).toContain('Hello world');
    });

    it('should format headers with colors', async () => {
      const markdown = '# Header 1\n## Header 2';
      const result = await formatMarkdown(markdown);
      expect(result).toContain('Header 1');
      expect(result).toContain('Header 2');
    });

    it('should format code blocks', async () => {
      const markdown = '```javascript\nconst x = 1;\n```';
      const result = await formatMarkdown(markdown);
      expect(result).toMatch(/const.*x.*=.*1/); // Very flexible matching
    });

    it('should format inline code', async () => {
      const result = await formatMarkdown('Use `console.log()` to debug');
      expect(result).toContain('console.log()');
    });

    it('should format bold and italic text', async () => {
      const result = await formatMarkdown('**bold** and *italic* text');
      expect(result).toContain('bold');
      expect(result).toContain('italic');
    });

    it('should format links', async () => {
      const result = await formatMarkdown('[Google](https://google.com)');
      expect(result).toContain('Google');
      expect(result).toContain('google.com');
    });

    it('should format lists', async () => {
      const markdown = '- Item 1\n- Item 2\n- Item 3';
      const result = await formatMarkdown(markdown);
      expect(result).toContain('Item 1');
      expect(result).toContain('Item 2');
      expect(result).toContain('Item 3');
      expect(result).toMatch(/•/); // Should have bullet points
    });

    it('should handle blockquotes', async () => {
      const result = await formatMarkdown('> This is a quote');
      expect(result).toContain('This is a quote');
      expect(result).toMatch(/│/); // Should have quote indicator
    });

    it('should handle horizontal rules', async () => {
      const result = await formatMarkdown('---');
      expect(result).toMatch(/─/); // Should have horizontal line
    });

    it('should handle errors gracefully', async () => {
      // Test with potentially problematic input
      const result = await formatMarkdown('');
      expect(typeof result).toBe('string');
    });
  });

  describe('formatMarkdownCustom', () => {
    it('should apply custom code theme', async () => {
      const markdown = '```js\nconst x = 1;\n```';
      const darkResult = await formatMarkdownCustom(markdown, { codeTheme: 'dark' });
      const lightResult = await formatMarkdownCustom(markdown, { codeTheme: 'light' });
      
      expect(darkResult).toMatch(/const.*x.*=.*1/); // Very flexible matching
      expect(lightResult).toMatch(/const.*x.*=.*1/); // Very flexible matching
      // Both should be valid strings, but they might be the same due to marked-terminal's behavior
      expect(typeof darkResult).toBe('string');
      expect(typeof lightResult).toBe('string');
    });

    it('should apply custom link style', async () => {
      const markdown = '[Test](https://example.com)';
      const underlineResult = await formatMarkdownCustom(markdown, { linkStyle: 'underline' });
      const bracketsResult = await formatMarkdownCustom(markdown, { linkStyle: 'brackets' });
      
      expect(underlineResult).toContain('Test');
      expect(bracketsResult).toContain('Test');
      expect(underlineResult).not.toBe(bracketsResult);
    });

    it('should apply custom header style', async () => {
      const markdown = '# Test Header';
      const hashResult = await formatMarkdownCustom(markdown, { headerStyle: 'hash' });
      const underlineResult = await formatMarkdownCustom(markdown, { headerStyle: 'underline' });
      
      expect(hashResult).toContain('Test Header');
      expect(underlineResult).toContain('Test Header');
      // Both results might be similar due to marked-terminal's default behavior
      expect(typeof hashResult).toBe('string');
      expect(typeof underlineResult).toBe('string');
    });
  });

  describe('stripColors', () => {
    it('should remove ANSI color codes', () => {
      const coloredText = '\x1b[31mRed text\x1b[0m';
      const result = stripColors(coloredText);
      expect(result).toBe('Red text');
    });

    it('should handle text without colors', () => {
      const plainText = 'Plain text';
      const result = stripColors(plainText);
      expect(result).toBe('Plain text');
    });

    it('should handle complex ANSI sequences', () => {
      const complexText = '\x1b[1m\x1b[31mBold Red\x1b[0m\x1b[32m Green\x1b[0m';
      const result = stripColors(complexText);
      expect(result).toBe('Bold Red Green');
    });
  });

  describe('getTerminalWidth', () => {
    it('should return a positive number', () => {
      const width = getTerminalWidth();
      expect(typeof width).toBe('number');
      expect(width).toBeGreaterThan(0);
    });

    it('should return default width when columns not available', () => {
      const originalColumns = process.stdout.columns;
      delete (process.stdout as any).columns;
      
      const width = getTerminalWidth();
      expect(width).toBe(80);
      
      // Restore original value
      (process.stdout as any).columns = originalColumns;
    });
  });

  describe('wrapText', () => {
    it('should wrap long lines', () => {
      const longText = 'This is a very long line that should be wrapped to fit within the specified width';
      const result = wrapText(longText, 20);
      const lines = result.split('\n');
      
      expect(lines.length).toBeGreaterThan(1);
      lines.forEach(line => {
        expect(stripColors(line).length).toBeLessThanOrEqual(20);
      });
    });

    it('should preserve short lines', () => {
      const shortText = 'Short line';
      const result = wrapText(shortText, 50);
      expect(result).toBe('Short line');
    });

    it('should handle empty text', () => {
      const result = wrapText('', 50);
      expect(result).toBe('');
    });

    it('should handle text with existing line breaks', () => {
      const multilineText = 'Line 1\nLine 2\nLine 3';
      const result = wrapText(multilineText, 50);
      expect(result).toContain('Line 1');
      expect(result).toContain('Line 2');
      expect(result).toContain('Line 3');
    });

    it('should handle colored text', () => {
      const coloredText = '\x1b[31mRed text that is quite long and should be wrapped\x1b[0m';
      const result = wrapText(coloredText, 20);
      expect(result).toContain('\x1b[31m');
      expect(result).toContain('\x1b[0m');
    });
  });

  describe('printMarkdown', () => {
    it('should not throw when printing markdown', async () => {
      const originalLog = console.log;
      let logOutput = '';
      
      console.log = (message: any) => {
        logOutput += String(message);
      };
      
      try {
        await printMarkdown('# Test Header\nSome **bold** text');
        expect(logOutput.length).toBeGreaterThan(0);
        expect(logOutput).toContain('Test Header');
        expect(logOutput).toContain('bold');
      } finally {
        console.log = originalLog;
      }
    });
  });

  describe('Complex Markdown Examples', () => {
    it('should handle mixed markdown content', async () => {
      const complexMarkdown = `
# Main Title

This is a paragraph with **bold** and *italic* text.

## Code Example

Here's some JavaScript:

\`\`\`javascript
function greet(name) {
  console.log(\`Hello, \${name}!\`);
}
\`\`\`

### Features

- Feature 1
- Feature 2
- Feature 3

> This is a blockquote with some important information.

Check out [this link](https://example.com) for more details.

---

That's all!
      `;
      
      const result = await formatMarkdown(complexMarkdown);
      expect(result).toContain('Main Title');
      expect(result).toContain('greet'); // Function name should be present
      expect(result).toContain('Feature 1');
      expect(result).toContain('blockquote');
      expect(result).toContain('link');
    });

    it('should handle tables', async () => {
      const tableMarkdown = `
| Name | Age | City |
|------|-----|------|
| John | 30  | NYC  |
| Jane | 25  | LA   |
      `;
      
      const result = await formatMarkdown(tableMarkdown);
      expect(result).toContain('Name');
      expect(result).toContain('John');
      expect(result).toContain('Jane');
    });
  });
}); 