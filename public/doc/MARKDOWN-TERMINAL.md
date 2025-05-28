# Markdown Terminal

Markdown Terminal Formatting

The Markdown Terminal module provides beautiful formatting for markdown content in terminal environments. It transforms plain markdown text into colorful, well-structured terminal output with syntax highlighting, proper spacing, and visual elements.

## Features

- **🎨 Beautiful Formatting**: Transform markdown into visually appealing terminal output
- **📝 Full Markdown Support**: Headers, code blocks, lists, tables, links, and more
- **🌈 Color Coding**: Syntax highlighting and color-coded elements
- **⚙️ Customizable Themes**: Light/dark themes and custom styling options
- **📱 Responsive**: Automatic text wrapping and terminal width detection
- **🔧 Utility Functions**: Strip colors, wrap text, and format detection

## Installation

Markdown Terminal is included with Hasyx. No additional installation required.

```typescript
import { formatMarkdown, printMarkdown } from 'hasyx/server';
// or
import { formatMarkdown, printMarkdown } from 'hasyx/lib/markdown-terminal';
```

## Basic Usage

### Simple Formatting

```typescript
import { formatMarkdown, printMarkdown } from 'hasyx/server';

// Format markdown and get the result
const formatted = await formatMarkdown('# Hello **World**!');
console.log(formatted);

// Print markdown directly to terminal
await printMarkdown(`
# Welcome to Markdown Terminal!

This is a **bold** statement and this is *italic* text.

Here's some \`inline code\` and a [link](https://example.com).
`);
```

### Code Blocks

```typescript
const codeExample = `
## JavaScript Example

\`\`\`javascript
function greet(name) {
  console.log(\`Hello, \${name}!\`);
  return \`Welcome, \${name}\`;
}

// Usage
const message = greet('World');
\`\`\`
`;

await printMarkdown(codeExample);
```

### Lists and Tables

```typescript
const listExample = `
### Features

- ✅ Beautiful terminal formatting
- ✅ Syntax highlighting for code
- ✅ Support for all markdown elements
- ✅ Customizable themes

| Feature | Status | Notes |
|---------|--------|-------|
| Headers | ✅ Yes | H1-H6 support |
| Code | ✅ Yes | Syntax highlighting |
| Tables | ✅ Yes | Proper borders |
`;

await printMarkdown(listExample);
```

## Advanced Usage

### Custom Themes

```typescript
import { formatMarkdownCustom } from 'hasyx/server';

const markdown = `
# Custom Formatting Example

This demonstrates different \`code themes\` and [link styles](https://example.com).

\`\`\`bash
npm install marked marked-terminal
\`\`\`
`;

// Light theme
const lightFormatted = await formatMarkdownCustom(markdown, {
  codeTheme: 'light',
  linkStyle: 'brackets',
  headerStyle: 'underline'
});

// Dark theme
const darkFormatted = await formatMarkdownCustom(markdown, {
  codeTheme: 'dark',
  linkStyle: 'underline',
  headerStyle: 'hash'
});
```

### Utility Functions

```typescript
import { 
  stripColors, 
  getTerminalWidth, 
  wrapText 
} from 'hasyx/server';

// Remove ANSI color codes
const plainText = stripColors('\x1b[31mRed text\x1b[0m');
console.log(plainText); // "Red text"

// Get terminal width
const width = getTerminalWidth();
console.log(`Terminal width: ${width} columns`);

// Wrap text to specific width
const longText = 'This is a very long line that should be wrapped';
const wrapped = wrapText(longText, 20);
console.log(wrapped);
```

## Supported Markdown Elements

### Headers

```markdown
# H1 Header (Bright Magenta)
## H2 Header (Bright Blue)
### H3 Header (Bright Yellow)
#### H4 Header (Bright Green)
##### H5 Header (Bright Cyan)
###### H6 Header (Bright Red)
```

### Text Formatting

```markdown
**Bold text** - Rendered with bold ANSI codes
*Italic text* - Rendered with italic ANSI codes
`Inline code` - Highlighted with background color
~~Strikethrough~~ - Rendered with strikethrough codes
```

### Code Blocks

```markdown
\`\`\`javascript
function example() {
  console.log('Syntax highlighted!');
}
\`\`\`

\`\`\`python
def hello_world():
    print("Hello, World!")
\`\`\`
```

### Lists

```markdown
- Unordered list item 1
- Unordered list item 2
  - Nested item

1. Ordered list item 1
2. Ordered list item 2
   1. Nested numbered item
```

### Links and Images

```markdown
[Link text](https://example.com) - Underlined with URL display
![Image alt text](image.jpg) - Special image indicator
```

### Blockquotes

```markdown
> This is a blockquote
> It can span multiple lines
> And will be formatted with border indicators
```

### Tables

```markdown
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Data A   | Data B   | Data C   |
```

### Horizontal Rules

```markdown
---
```

## Configuration Options

### FormatMarkdownCustom Options

```typescript
interface CustomOptions {
  codeTheme?: 'dark' | 'light';      // Code block theme
  linkStyle?: 'underline' | 'brackets'; // Link display style
  headerStyle?: 'hash' | 'underline';   // Header formatting style
}
```

#### Code Themes

- **`dark`** (default): Dark background with light text
- **`light`**: Light background with dark text

#### Link Styles

- **`underline`** (default): Underlined text with URL in parentheses
- **`brackets`**: Plain text with URL in square brackets

#### Header Styles

- **`hash`** (default): Headers with # prefix and colors
- **`underline`**: Headers with underline characters

## Integration Examples

### With Ask Command

The `ask` command automatically uses markdown terminal formatting:

```bash
npm run ask -- -e "Write a React component with TypeScript"
```

Output will be beautifully formatted with:
- Colored headers
- Syntax-highlighted code blocks
- Properly formatted lists and tables

### With Custom CLI Tools

```typescript
#!/usr/bin/env node
import { printMarkdown } from 'hasyx/server';

async function showHelp() {
  await printMarkdown(`
# My CLI Tool

## Commands

- \`help\` - Show this help message
- \`build\` - Build the project
- \`test\` - Run tests

## Examples

\`\`\`bash
# Build the project
my-cli build

# Run tests with coverage
my-cli test --coverage
\`\`\`

> **Note:** Use \`--verbose\` flag for detailed output.
  `);
}

showHelp();
```

### With Documentation Generators

```typescript
import { formatMarkdown } from 'hasyx/server';

async function generateDocs(markdownContent: string) {
  const formatted = await formatMarkdown(markdownContent);
  
  // Save to file or display in terminal
  console.log(formatted);
}
```

## API Reference

### Functions

#### `formatMarkdown(markdown: string): Promise<string>`

Formats markdown text for terminal output.

**Parameters:**
- `markdown` - The markdown text to format

**Returns:** Promise resolving to formatted string with ANSI codes

#### `printMarkdown(markdown: string): Promise<void>`

Prints formatted markdown directly to terminal.

**Parameters:**
- `markdown` - The markdown text to print

#### `formatMarkdownCustom(markdown: string, options?: CustomOptions): Promise<string>`

Formats markdown with custom styling options.

**Parameters:**
- `markdown` - The markdown text to format
- `options` - Custom formatting options

**Returns:** Promise resolving to formatted string

#### `stripColors(text: string): string`

Removes ANSI color codes from text.

**Parameters:**
- `text` - Text containing ANSI codes

**Returns:** Plain text without color codes

#### `getTerminalWidth(): number`

Gets the current terminal width.

**Returns:** Terminal width in columns (default: 80)

#### `wrapText(text: string, width?: number): string`

Wraps text to specified width.

**Parameters:**
- `text` - Text to wrap
- `width` - Maximum line width (default: terminal width)

**Returns:** Wrapped text

## Examples

### Complete Example

```typescript
import { 
  formatMarkdown, 
  printMarkdown, 
  formatMarkdownCustom 
} from 'hasyx/server';

async function demonstrateMarkdown() {
  const complexMarkdown = `
# 📚 Complete Markdown Guide

## Introduction

Welcome to the **complete markdown guide** for terminal formatting!

## Code Examples

### JavaScript

\`\`\`javascript
async function fetchData(url) {
  try {
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}
\`\`\`

## Features List

- **Bold text** formatting
- *Italic text* styling
- \`Inline code\` highlighting
- [Links](https://example.com) with URLs

### Comparison Table

| Feature | Supported | Notes |
|---------|-----------|-------|
| Headers | ✅ Yes | H1-H6 |
| Code | ✅ Yes | Highlighted |
| Tables | ✅ Yes | Bordered |

> **Important:** This library provides beautiful terminal output for all markdown elements.

---

## Conclusion

Happy formatting! 🎉
  `;

  console.log('🎨 Standard Formatting:');
  await printMarkdown(complexMarkdown);

  console.log('\n🌙 Dark Theme:');
  const darkFormatted = await formatMarkdownCustom(complexMarkdown, {
    codeTheme: 'dark',
    linkStyle: 'underline',
    headerStyle: 'hash'
  });
  console.log(darkFormatted);

  console.log('\n☀️ Light Theme:');
  const lightFormatted = await formatMarkdownCustom(complexMarkdown, {
    codeTheme: 'light',
    linkStyle: 'brackets',
    headerStyle: 'underline'
  });
  console.log(lightFormatted);
}

demonstrateMarkdown();
```

### Testing Example

```typescript
import { formatMarkdown, stripColors } from 'hasyx/server';

describe('Markdown Terminal', () => {
  it('should format headers with colors', async () => {
    const result = await formatMarkdown('# Test Header');
    expect(result).toContain('Test Header');
    expect(result).toMatch(/\x1b\[\d+m/); // Contains ANSI codes
  });

  it('should strip colors correctly', () => {
    const colored = '\x1b[31mRed text\x1b[0m';
    const plain = stripColors(colored);
    expect(plain).toBe('Red text');
  });
});
```

## Best Practices

### 1. Use Appropriate Functions

```typescript
// ✅ Good: Use printMarkdown for direct output
await printMarkdown(helpText);

// ✅ Good: Use formatMarkdown when you need the string
const formatted = await formatMarkdown(content);
logToFile(formatted);

// ✅ Good: Use stripColors for plain text
const plainText = stripColors(formatted);
```

### 2. Handle Long Content

```typescript
// ✅ Good: Wrap long content
const longContent = generateLongMarkdown();
const wrapped = wrapText(await formatMarkdown(longContent));
console.log(wrapped);
```

### 3. Choose Appropriate Themes

```typescript
// ✅ Good: Use light theme for light terminals
const lightTerminal = process.env.TERM_THEME === 'light';
const formatted = await formatMarkdownCustom(content, {
  codeTheme: lightTerminal ? 'light' : 'dark'
});
```

### 4. Error Handling

```typescript
// ✅ Good: Handle formatting errors gracefully
try {
  await printMarkdown(userContent);
} catch (error) {
  console.error('Failed to format markdown:', error);
  console.log(userContent); // Fallback to plain text
}
```

## Troubleshooting

### Common Issues

1. **Colors not showing**
   - Check if terminal supports ANSI colors
   - Verify `process.stdout.isTTY` is true

2. **Text wrapping issues**
   - Use `wrapText()` for manual control
   - Check terminal width with `getTerminalWidth()`

3. **Performance with large content**
   - Consider chunking large markdown files
   - Use streaming for very large documents

### Debug Mode

```typescript
// Enable debug output
const formatted = await formatMarkdown(content);
console.log('Formatted length:', formatted.length);
console.log('Contains colors:', /\x1b\[\d+m/.test(formatted));
```

## Dependencies

The markdown terminal functionality uses:

- **marked**: Markdown parsing and rendering
- **marked-terminal**: Terminal-specific markdown renderer
- **Node.js built-ins**: `process.stdout` for terminal detection

These dependencies are automatically included with Hasyx.

## Related Documentation

- **[ASK.md](ASK.md)**: AI assistant that uses markdown terminal formatting
- **[EXEC.md](EXEC.md)**: Code execution engine that can output formatted results
- **[OPENROUTER.md](OPENROUTER.md)**: AI integration with formatted responses 