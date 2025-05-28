# Code Execution Engine (`EXEC.md`)

This document describes the `Exec` class and related utilities provided in `lib/exec.ts`, which enable secure JavaScript code execution in both Node.js and browser environments using VM contexts.

## Purpose

The `Exec` class provides a universal JavaScript execution environment that:
- Works consistently in both Node.js and browser environments
- Provides isolated execution contexts with controlled global access
- Supports both synchronous and asynchronous code execution
- Handles promises and async/await patterns automatically
- Offers configurable timeouts and error handling
- Maintains separate contexts for different execution sessions

<details>
<summary>Core Exports (`lib/exec.ts`)</summary>

* `Exec`: Main class for creating isolated JavaScript execution environments
* `createExec(context?, options?)`: Factory function for easier Exec instantiation
* `ExecOptions`: Interface defining execution configuration options
* `ExecContext`: Interface for defining execution context variables
* `Exec.getEnvironment()`: Static method to detect runtime environment ('node' | 'browser')
* `Exec.isSecureContext()`: Static method to check if running in secure context

</details>

## Core Features

### Environment Detection
The Exec class automatically detects whether it's running in Node.js or browser environment and provides appropriate globals:

**Node.js Environment:**
- Full Node.js globals (process, require, Buffer, etc.)
- Native VM module for execution

**Browser Environment:**
- Browser-safe alternatives for Node.js-specific globals
- Uses vm-browserify for execution context
- Provides mock process object with essential properties

### Execution Context Management
Each Exec instance maintains its own isolated context that includes:
- Environment-appropriate global objects
- User-provided initial context variables
- Fresh context creation for each execution to prevent variable leakage

## Usage

### Basic Usage

```typescript
import { Exec, createExec } from 'hasyx';

// Create an Exec instance
const exec = new Exec();

// Execute simple expressions
const result = await exec.exec('1 + 1'); // Returns: 2

// Execute complex code with variables
const complexResult = await exec.exec(`
  const x = 10;
  const y = 20;
  x + y
`); // Returns: 30
```

### Factory Function

```typescript
import { createExec } from 'hasyx';

// Create with initial context and options
const exec = createExec(
  { customVar: 'hello world' }, // Initial context
  { timeout: 5000 }             // Options
);

const result = await exec.exec('customVar'); // Returns: 'hello world'
```

### Advanced Context Management

```typescript
const exec = new Exec({ globalVar: 'initial' });

// Update context
exec.updateContext({ newVar: 'added' });

// Get current context
const context = exec.getContext();
console.log(context); // { globalVar: 'initial', newVar: 'added' }

// Clear context (keeps only environment globals)
exec.clearContext();
```

### Execution with Context Extension

```typescript
const exec = new Exec();

// Extend context for single execution
const result = await exec.exec('x + y', { x: 10, y: 20 }); // Returns: 30

// Context extension doesn't persist
await exec.exec('x'); // Throws ReferenceError
```

## Configuration Options

### ExecOptions Interface

```typescript
interface ExecOptions {
  timeout?: number;        // Execution timeout in milliseconds (default: 30000)
  displayErrors?: boolean; // Whether to display detailed errors (default: true)
}
```

### Example with Options

```typescript
const exec = new Exec({}, {
  timeout: 5000,      // 5 second timeout
  displayErrors: true // Show detailed error messages
});
```

## Async/Await Support

The Exec class automatically handles asynchronous code:

```typescript
const exec = new Exec();

// Async functions work seamlessly
const result = await exec.exec(`
  async function fetchData() {
    return Promise.resolve('async result');
  }
  await fetchData()
`); // Returns: 'async result'

// Promise handling
const promiseResult = await exec.exec(`
  new Promise(resolve => {
    setTimeout(() => resolve('timeout result'), 10);
  })
`); // Returns: 'timeout result'
```

## Built-in Objects and Functions

### Available Globals

All Exec contexts include these standard JavaScript objects:
- `console` - For logging and debugging
- `setTimeout`, `clearTimeout` - Timer functions
- `setInterval`, `clearInterval` - Interval functions
- `URL` - URL constructor
- `Error`, `Date`, `Math`, `JSON` - Standard built-ins
- `Promise` - Promise constructor

### Environment-Specific Globals

**Node.js Only:**
```typescript
const exec = new Exec();

// Access Node.js specific globals
const result = await exec.exec(`
  process.platform // Returns actual platform
`);

const bufferResult = await exec.exec(`
  const buf = Buffer.from('hello');
  buf.toString() // Returns: 'hello'
`);
```

**Browser Environment:**
```typescript
// In browser, process is mocked safely
const result = await exec.exec(`
  process.version // Returns: 'browser'
`);
```

## Error Handling

### Syntax Errors
```typescript
const exec = new Exec();

try {
  await exec.exec('const x = ;'); // Invalid syntax
} catch (error) {
  console.log(error.message); // "Execution error: Unexpected token ';'"
}
```

### Runtime Errors
```typescript
try {
  await exec.exec('throw new Error("custom error")');
} catch (error) {
  console.log(error.message); // "Execution error: custom error"
}
```

### Timeout Handling
```typescript
const exec = new Exec({}, { timeout: 100 });

try {
  await exec.exec('while(true) {}'); // Infinite loop
} catch (error) {
  console.log('Execution timed out');
}
```

## Advanced Examples

### Complex Data Processing

```typescript
const exec = new Exec();

const result = await exec.exec(`
  const data = [
    { name: 'Alice', age: 30 },
    { name: 'Bob', age: 25 },
    { name: 'Charlie', age: 35 }
  ];
  
  const adults = data
    .filter(person => person.age >= 25)
    .map(person => ({ ...person, isAdult: true }))
    .sort((a, b) => a.age - b.age);
  
  adults.length
`); // Returns: 3
```

### Async Data Processing

```typescript
const exec = new Exec();

const result = await exec.exec(`
  async function processData() {
    const data = await Promise.resolve([1, 2, 3, 4, 5]);
    const processed = await Promise.all(
      data.map(async (num) => {
        return await Promise.resolve(num * 2);
      })
    );
    return processed.reduce((sum, num) => sum + num, 0);
  }
  
  await processData()
`); // Returns: 30
```

### Function Definitions and Execution

```typescript
const exec = new Exec();

// Define and use functions
const result = await exec.exec(`
  function factorial(n) {
    return n <= 1 ? 1 : n * factorial(n - 1);
  }
  factorial(5)
`); // Returns: 120

// Arrow functions
const arrowResult = await exec.exec(`
  const multiply = (a, b) => a * b;
  multiply(6, 7)
`); // Returns: 42
```

## Environment Detection

### Static Methods

```typescript
// Detect current environment
const env = Exec.getEnvironment(); // 'node' | 'browser'

// Check if running in secure context
const isSecure = Exec.isSecureContext(); // boolean
```

### Usage in Code

```typescript
const exec = new Exec();

if (Exec.getEnvironment() === 'node') {
  // Node.js specific logic
  const result = await exec.exec('process.cwd()');
} else {
  // Browser specific logic
  const result = await exec.exec('window.location.href');
}
```

## Security Considerations

### Context Isolation
- Each execution creates a fresh context to prevent variable leakage
- Variables defined in one execution don't persist to the next
- Only explicitly provided context variables are available

### Timeout Protection
- Default 30-second timeout prevents infinite loops
- Configurable timeout for different use cases
- Automatic cleanup on timeout

### Environment Safety
- Browser environment doesn't expose Node.js-specific APIs like `require`
- Mock objects provided for compatibility without security risks
- Secure context detection for browser environments

## Testing

The Exec class includes comprehensive tests covering:
- Basic arithmetic and variable operations
- Function definitions and execution
- Async/await patterns and Promise handling
- Object and array operations
- Built-in object access
- Environment-specific globals
- Context management and isolation
- Error handling and timeouts
- Complex nested operations

See `lib/exec.test.ts` for complete test coverage and usage examples.

## Integration Examples

### CLI Tool Integration

```typescript
// Example: Interactive JavaScript REPL
import { createExec } from 'hasyx';

const exec = createExec({
  // Provide helpful utilities in context
  _: require('lodash'),
  moment: require('moment')
});

// Execute user input
const userCode = 'moment().format("YYYY-MM-DD")';
const result = await exec.exec(userCode);
console.log(result); // Current date
```

### Dynamic Code Evaluation

```typescript
// Example: Safe evaluation of user-provided formulas
const exec = new Exec({}, { timeout: 1000 });

async function evaluateFormula(formula: string, variables: Record<string, number>) {
  try {
    return await exec.exec(formula, variables);
  } catch (error) {
    throw new Error(`Formula evaluation failed: ${error.message}`);
  }
}

// Usage
const result = await evaluateFormula('(x + y) * z', { x: 10, y: 5, z: 2 }); // Returns: 30
```

## Best Practices

1. **Always use timeouts** for user-provided code to prevent infinite loops
2. **Validate input** before execution when dealing with untrusted code
3. **Use context extension** for temporary variables rather than updating the main context
4. **Handle errors gracefully** and provide meaningful error messages to users
5. **Consider environment differences** when writing code that needs to work in both Node.js and browser
6. **Test thoroughly** with both sync and async code patterns
7. **Use factory function** for simpler instantiation when you don't need class methods 