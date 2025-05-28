#!/usr/bin/env node

import { formatMarkdown, printMarkdown, formatMarkdownCustom } from '../lib/markdown-terminal';

async function main() {
  console.log('🎨 Markdown Terminal Formatting Examples\n');

  // Example 1: Simple markdown
  const simpleMarkdown = `
# Welcome to Markdown Terminal!

This is a **bold** statement and this is *italic* text.

Here's some \`inline code\` and a [link](https://example.com).
  `;

  console.log('📝 Example 1: Simple Formatting');
  await printMarkdown(simpleMarkdown);

  // Example 2: Code blocks
  const codeMarkdown = `
## Code Example

Here's a JavaScript function:

\`\`\`javascript
function greet(name) {
  console.log(\`Hello, \${name}!\`);
  return \`Welcome, \${name}\`;
}

// Usage
const message = greet('World');
\`\`\`

And here's some TypeScript:

\`\`\`typescript
interface User {
  id: number;
  name: string;
  email: string;
}

const user: User = {
  id: 1,
  name: 'John Doe',
  email: 'john@example.com'
};
\`\`\`
  `;

  console.log('\n💻 Example 2: Code Blocks');
  await printMarkdown(codeMarkdown);

  // Example 3: Lists and quotes
  const listsMarkdown = `
### Features

- ✅ Beautiful terminal formatting
- ✅ Syntax highlighting for code
- ✅ Support for all markdown elements
- ✅ Customizable themes

> **Note:** This library uses marked-terminal under the hood for consistent and reliable markdown rendering in terminal environments.

#### Numbered List

1. Install the package
2. Import the functions
3. Format your markdown
4. Enjoy beautiful output!
  `;

  console.log('\n📋 Example 3: Lists and Quotes');
  await printMarkdown(listsMarkdown);

  // Example 4: Tables
  const tableMarkdown = `
### Comparison Table

| Feature | marked-terminal | Other Solutions |
|---------|----------------|-----------------|
| Colors | ✅ Yes | ❌ Limited |
| Code Blocks | ✅ Yes | ⚠️ Basic |
| Tables | ✅ Yes | ❌ No |
| Links | ✅ Yes | ⚠️ Basic |
| Customizable | ✅ Yes | ❌ No |
  `;

  console.log('\n📊 Example 4: Tables');
  await printMarkdown(tableMarkdown);

  // Example 5: Custom formatting
  const customMarkdown = `
# Custom Formatting Example

This demonstrates different \`code themes\` and [link styles](https://example.com).

\`\`\`bash
npm install marked marked-terminal
\`\`\`
  `;

  console.log('\n🎨 Example 5: Custom Light Theme');
  const lightFormatted = await formatMarkdownCustom(customMarkdown, {
    codeTheme: 'light',
    linkStyle: 'brackets',
    headerStyle: 'underline'
  });
  console.log(lightFormatted);

  console.log('\n🌙 Example 6: Custom Dark Theme');
  const darkFormatted = await formatMarkdownCustom(customMarkdown, {
    codeTheme: 'dark',
    linkStyle: 'underline',
    headerStyle: 'hash'
  });
  console.log(darkFormatted);

  // Example 7: Complex document
  const complexMarkdown = `
# 📚 Complete Markdown Guide

## Introduction

Welcome to the **complete markdown guide** for terminal formatting! This document showcases all the features available.

## Code Examples

### JavaScript

\`\`\`javascript
// Async/await example
async function fetchData(url) {
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
}
\`\`\`

### Python

\`\`\`python
def fibonacci(n):
    """Generate Fibonacci sequence up to n terms."""
    if n <= 0:
        return []
    elif n == 1:
        return [0]
    elif n == 2:
        return [0, 1]
    
    sequence = [0, 1]
    for i in range(2, n):
        sequence.append(sequence[i-1] + sequence[i-2])
    
    return sequence

# Usage
fib_sequence = fibonacci(10)
print(f"First 10 Fibonacci numbers: {fib_sequence}")
\`\`\`

## Features List

### Text Formatting
- **Bold text** using \`**text**\`
- *Italic text* using \`*text*\`
- \`Inline code\` using backticks
- ~~Strikethrough~~ using \`~~text~~\`

### Links and Images
- [External link](https://github.com/ivansglazunov/hasyx)
- [Documentation](https://hasyx.vercel.app/)

### Blockquotes

> This is a blockquote. It can contain multiple lines
> and will be formatted with a nice border indicator.
> 
> Perfect for highlighting important information!

### Horizontal Rules

---

## Advanced Features

### Nested Lists

1. **Primary item**
   - Sub-item A
   - Sub-item B
     - Nested sub-item
2. **Secondary item**
   - Another sub-item
3. **Tertiary item**

### Task Lists

- [x] Implement markdown parsing
- [x] Add terminal formatting
- [x] Create comprehensive tests
- [ ] Add more themes
- [ ] Optimize performance

---

## Conclusion

This markdown terminal formatter provides a **powerful** and *flexible* way to display formatted text in terminal applications. Perfect for CLI tools, documentation, and interactive applications!

\`\`\`bash
# Try it yourself!
npm install marked marked-terminal
\`\`\`

Happy formatting! 🎉
  `;

  console.log('\n📖 Example 7: Complex Document');
  await printMarkdown(complexMarkdown);
}

// Run the examples
if (typeof(require) !== 'undefined' && require.main === module) {
  main().catch(console.error);
}

export { main as runMarkdownExamples }; 