# TypeScript Execution

ExecTs - TypeScript Code Execution Engine

ExecTs is a TypeScript-aware code execution engine that extends the base `Exec` class to provide seamless TypeScript compilation and execution in memory.

## Features

- **In-memory TypeScript compilation** - Compiles TypeScript code to JavaScript without creating files
- **Automatic tsconfig.lib.json loading** - Loads project TypeScript configuration at module level
- **Deep configuration cloning** - Uses lodash for safe configuration manipulation
- **TypeScript syntax detection** - Automatically detects TypeScript-specific syntax
- **Context inheritance** - Inherits all capabilities from the base Exec class
- **Configurable compiler options** - Allows custom TypeScript compiler settings

## Persistent State Management

ExecTs inherits the powerful persistent state management from the base `Exec` class, allowing you to store and share complex TypeScript objects between executions:

### Using results[uuid] for Persistent State

```typescript
import { ExecTs } from 'hasyx';

const execTs = new ExecTs();

// Store a complex TypeScript object with types
await execTs.execTs(`
  interface UserData {
    id: string;
    name: string;
    preferences: {
      theme: 'light' | 'dark';
      notifications: boolean;
    };
  }

  class UserManager {
    private data: UserData;
    
    constructor(userData: UserData) {
      this.data = userData;
    }
    
    updatePreferences(prefs: Partial<UserData['preferences']>): void {
      this.data.preferences = { ...this.data.preferences, ...prefs };
    }
    
    getData(): UserData {
      return this.data;
    }
  }

  const manager = new UserManager({
    id: '123',
    name: 'John Doe',
    preferences: { theme: 'light', notifications: true }
  });

  // Store the manager instance for later use
  results['userManager'] = manager;
  
  return "UserManager stored successfully";
`);

// Later execution - use the stored TypeScript object
const userData = await execTs.execTs(`
  const manager: any = results['userManager'];
  manager.updatePreferences({ theme: 'dark' });
  return manager.getData();
`);

console.log(userData); 
// { id: '123', name: 'John Doe', preferences: { theme: 'dark', notifications: true } }
```

### TypeScript Browser Automation Example

```typescript
// Step 1: Launch browser with TypeScript types
await execTs.execTs(`
  const puppeteer = await use('puppeteer');

  interface BrowserSession {
    browser: any;
    currentPage: any;
    visitedUrls: string[];
  }

  async function createSession(): Promise<BrowserSession> {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    return {
      browser,
      currentPage: page,
      visitedUrls: []
    };
  }

  const session = await createSession();
  await session.currentPage.goto('https://example.com');
  session.visitedUrls.push('https://example.com');

  // Store typed session
  results['browserSession'] = session;
  
  return session.currentPage.title();
`);

// Step 2: Continue with the same browser session
await execTs.execTs(`
  const session: any = results['browserSession'];
  
  // Navigate to a new page
  await session.currentPage.goto('https://github.com');
  session.visitedUrls.push('https://github.com');
  
  const title = await session.currentPage.title();
  
  // Update the stored session
  results['browserSession'] = session;
  
  return {
    currentTitle: title,
    visitedUrls: session.visitedUrls
  };
`);
```

### Database Connection with Types

```typescript
// TypeScript-typed database operations
await execTs.execTs(`
  interface DatabaseConfig {
    host: string;
    port: number;
    database: string;
  }

  interface QueryResult<T = any> {
    rows: T[];
    rowCount: number;
  }

  class TypedDatabase {
    private config: DatabaseConfig;
    
    constructor(config: DatabaseConfig) {
      this.config = config;
    }
    
    async query<T>(sql: string): Promise<QueryResult<T>> {
      // Mock implementation
      return {
        rows: [{ id: 1, name: 'John' }] as T[],
        rowCount: 1
      };
    }
    
    getConfig(): DatabaseConfig {
      return this.config;
    }
  }

  const db = new TypedDatabase({
    host: 'localhost',
    port: 5432,
    database: 'myapp'
  });

  // Store typed database connection
  results['database'] = db;
  
  return "Database connection established";
`);

// Use the stored database with full TypeScript support
await execTs.execTs(`
  interface User {
    id: number;
    name: string;
  }

  const db: any = results['database'];
  const result = await db.query<User>('SELECT * FROM users');
  
  return result.rows.map((user: User) => user.name);
`);
```

### Benefits for TypeScript Development

- **Type Safety**: Store complex typed objects and maintain type information
- **State Persistence**: Keep database connections, browser sessions, API clients alive
- **Memory Efficiency**: Reuse expensive objects instead of recreating them
- **Development Speed**: Iterate on code without losing context
- **Complex Workflows**: Build multi-step processes with typed intermediate state

## Installation

ExecTs is included in the hasyx library:

```bash
npm install hasyx
```

## Usage

### Basic Usage

```typescript
import { ExecTs } from 'hasyx';

const execTs = new ExecTs();

// Execute TypeScript code with type annotations
const result = await execTs.execTs(`
  const message: string = "Hello TypeScript";
  const count: number = 42;
  return { message, count };
`);

console.log(result); // { message: "Hello TypeScript", count: 42 }
```

### With Context

```typescript
import { ExecTs } from 'hasyx';

const execTs = new ExecTs({
  customValue: 100,
  helper: (x: number) => x * 2
});

const result = await execTs.execTs(`
  const doubled: number = helper(customValue);
  return doubled;
`);

console.log(result); // 200
```

### Factory Function

```typescript
import { createExecTs } from 'hasyx';

const execTs = createExecTs({
  console,
  Math,
  Date
});
```

## Configuration

### Compiler Options

You can customize TypeScript compiler options:

```typescript
const execTs = new ExecTs({}, {
  compilerOptions: {
    target: 5, // ES2015
    strict: false,
    experimentalDecorators: true
  }
});
```

### Strict Mode

Control TypeScript strict mode:

```typescript
const execTs = new ExecTs({}, {
  strict: false // Disable strict mode
});
```

## TypeScript Features Supported

### Type Annotations

```typescript
const result = await execTs.execTs(`
  const name: string = "John";
  const age: number = 30;
  const isActive: boolean = true;
  return { name, age, isActive };
`);
```

### Interfaces

```typescript
const result = await execTs.execTs(`
  interface User {
    name: string;
    age: number;
    email?: string;
  }
  
  const user: User = {
    name: "Alice",
    age: 25
  };
  
  return user;
`);
```

### Type Aliases

```typescript
const result = await execTs.execTs(`
  type Status = "active" | "inactive" | "pending";
  
  const userStatus: Status = "active";
  return userStatus;
`);
```

### Generics

```typescript
const result = await execTs.execTs(`
  function identity<T>(arg: T): T {
    return arg;
  }
  
  const stringResult = identity<string>("hello");
  const numberResult = identity<number>(123);
  
  return { stringResult, numberResult };
`);
```

### Enums

```typescript
const result = await execTs.execTs(`
  enum Color {
    Red = "red",
    Green = "green",
    Blue = "blue"
  }
  
  const favoriteColor: Color = Color.Blue;
  return favoriteColor;
`);
```

### Type Assertions

```typescript
const result = await execTs.execTs(`
  const value: unknown = "hello world";
  const stringValue = value as string;
  return stringValue.toUpperCase();
`);
```

## API Reference

### Class: ExecTs

Extends the base `Exec` class with TypeScript compilation capabilities.

#### Constructor

```typescript
constructor(initialContext?: ExecContext, options?: ExecTsOptions)
```

**Parameters:**
- `initialContext` - Initial execution context (variables, functions, etc.)
- `options` - TypeScript execution options

#### Methods

##### execTs(code, contextExtend?)

Execute TypeScript code with compilation.

```typescript
async execTs(code: string, contextExtend?: ExecContext): Promise<any>
```

**Parameters:**
- `code` - TypeScript code to execute
- `contextExtend` - Additional context for this execution

**Returns:** Promise resolving to the execution result

##### updateCompilerOptions(options)

Update TypeScript compiler options.

```typescript
updateCompilerOptions(options: Partial<ts.CompilerOptions>): void
```

##### getCurrentCompilerOptions()

Get current compiler options (for debugging).

```typescript
getCurrentCompilerOptions(): ts.CompilerOptions
```

#### Static Methods

##### isTypeScriptCode(code)

Check if code contains TypeScript-specific syntax.

```typescript
static isTypeScriptCode(code: string): boolean
```

### Interface: ExecTsOptions

Configuration options for ExecTs.

```typescript
interface ExecTsOptions extends ExecOptions {
  compilerOptions?: Partial<ts.CompilerOptions>;
  strict?: boolean;
}
```

**Properties:**
- `compilerOptions` - Custom TypeScript compiler options
- `strict` - Enable/disable strict mode
- Inherits all options from `ExecOptions`

## Configuration Loading

ExecTs automatically loads TypeScript configuration from `tsconfig.lib.json` at module initialization:

1. **Module Level Loading** - Configuration is loaded once when the module is imported
2. **Deep Cloning** - Uses lodash `cloneDeep` to safely clone configuration
3. **In-Memory Modification** - Modifies cloned config to prevent file output:
   - Sets `noEmit: true`
   - Disables `declaration`, `sourceMap`, etc.
   - Clears output directories

## TypeScript Detection

ExecTs can automatically detect TypeScript syntax using heuristics:

```typescript
ExecTs.isTypeScriptCode('const x: string = "hello"'); // true
ExecTs.isTypeScriptCode('interface User { name: string }'); // true
ExecTs.isTypeScriptCode('const x = "hello"'); // false
```

Detection patterns include:
- Type annotations (`: string`, `: number`, etc.)
- Interface declarations
- Type aliases
- Generic types
- Optional properties
- Type assertions
- Enums
- Access modifiers

## Error Handling

ExecTs provides comprehensive error handling:

```typescript
try {
  const result = await execTs.execTs(`
    const obj: any = null;
    return obj.property; // Runtime error
  `);
} catch (error) {
  console.error('Execution failed:', error.message);
}
```

## Integration with CLI

ExecTs is integrated with the hasyx CLI:

```bash
# Execute TypeScript code directly
npm run tsx -- -e "const x: number = 42; console.log(x);"

# Or using npx
npx hasyx tsx -e "interface User { name: string } const u: User = { name: 'John' }; console.log(u);"
```

## Best Practices

1. **Use Type Annotations** - Leverage TypeScript's type system for better code safety
2. **Context Management** - Provide necessary context for your TypeScript code
3. **Error Handling** - Always wrap execTs calls in try-catch blocks
4. **Configuration** - Customize compiler options based on your needs
5. **Testing** - Test your TypeScript execution logic thoroughly

## Examples

### Working with Hasyx Client

```typescript
import { ExecTs, Hasyx } from 'hasyx';

const execTs = new ExecTs({
  client: hasyxClient, // Your Hasyx client instance
});

const result = await execTs.execTs(`
  interface QueryResult {
    users: Array<{ id: string; name: string }>;
  }
  
  const query = client.query<QueryResult>(\`
    query GetUsers {
      users {
        id
        name
      }
    }
  \`);
  
  return query;
`);
```

### Complex Type Operations

```typescript
const result = await execTs.execTs(`
  type UserRole = "admin" | "user" | "guest";
  
  interface User {
    id: string;
    name: string;
    role: UserRole;
    permissions?: string[];
  }
  
  class UserManager {
    private users: User[] = [];
    
    addUser(user: User): void {
      this.users.push(user);
    }
    
    getUsersByRole(role: UserRole): User[] {
      return this.users.filter(u => u.role === role);
    }
  }
  
  const manager = new UserManager();
  manager.addUser({
    id: "1",
    name: "John",
    role: "admin",
    permissions: ["read", "write", "delete"]
  });
  
  return manager.getUsersByRole("admin");
`);
```

## Troubleshooting

### Common Issues

1. **Module Resolution** - Ensure TypeScript can resolve your imports
2. **Strict Mode** - Disable strict mode if you encounter type errors
3. **Context Variables** - Make sure all required variables are in context
4. **Async Code** - Use proper async/await syntax in your TypeScript code

### Debug Mode

Enable debug logging to see compilation details:

```bash
DEBUG=hasyx:exec-ts npm run tsx -- -e "your code here"
```
## See Also

- [Exec Documentation](./EXEC.md) - Base execution engine
- [CLI Documentation](./CLI.md) - Command line interface
- [TypeScript Documentation](https://www.typescriptlang.org/) - Official TypeScript docs 
