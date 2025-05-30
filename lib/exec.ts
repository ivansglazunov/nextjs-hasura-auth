// Universal VM import that works in both Node.js and browser
// In browser environments, bundlers like webpack/browserify will automatically
// replace 'vm' with 'vm-browserify'
import vm from 'vm';
import { createRequire } from 'module';

export interface ExecOptions {
  timeout?: number;
  displayErrors?: boolean;
}

export interface ExecContext {
  [key: string]: any;
}

// Global results storage for persistent state between executions
const globalResults: { [uuid: string]: any } = {};

// Clear results function for testing
export function clearResults(): void {
  Object.keys(globalResults).forEach(key => delete globalResults[key]);
}

// Cache for use-m function
let useFunction: any = null;
let useInitialized = false;

// Initialize use-m function (only in Node.js)
const initializeUse = async () => {
  if (useInitialized) return useFunction;
  
  // Only load use-m in Node.js environment
  if (typeof window === 'undefined') {
    try {
      const { use } = await import('use-m');
      useFunction = use;
    } catch (error) {
      console.warn('Failed to load use-m:', error);
      useFunction = null;
    }
  } else {
    // In browser, use-m is not available
    useFunction = null;
  }
  
  useInitialized = true;
  return useFunction;
};

// Get environment-appropriate globals
const getEnvironmentGlobals = () => {
  const globals: any = {
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    URL: URL,
    Error: Error,
    Date: Date,
    Math: Math,
    JSON: JSON,
    Promise: Promise,
    // Add global results object for persistent state
    results: globalResults,
  };

  // Add Node.js specific globals only if available
  if (typeof window === 'undefined') {
    // Node.js environment
    globals.process = process;
    
    // Create require function for ESM compatibility
    try {
      // In Jest environment, just use require if available
      if (typeof require !== 'undefined') {
        globals.require = require;
      }
    } catch (error) {
      // Fallback for environments where require is not available
    }
    
    globals.Buffer = Buffer;
  } else {
    // Browser environment - provide safe alternatives
    globals.process = {
      env: {},
      version: 'browser',
      platform: 'browser',
      cwd: () => '/',
      nextTick: (fn: Function) => setTimeout(fn, 0)
    };
    // Note: require is intentionally not provided in browser for security
    // Buffer is not available in browser by default
  }

  return globals;
};

export class Exec {
  private context: vm.Context;
  private options: ExecOptions;
  private initialContext: ExecContext;

  constructor(initialContext: ExecContext = {}, options: ExecOptions = {}) {
    this.options = {
      timeout: 30000,
      displayErrors: true,
      ...options
    };

    this.initialContext = { ...initialContext };

    // Create VM context with environment-appropriate globals and user context
    this.context = vm.createContext({
      ...getEnvironmentGlobals(),
      ...initialContext
    });
  }

  async exec(code: string, contextExtend: ExecContext = {}): Promise<any> {
    // Initialize use-m function if not already done
    const use = await initializeUse();
    
    // Create execution context with all globals
    const executionContext = vm.createContext({
      ...getEnvironmentGlobals(),
      ...this.initialContext,
      ...contextExtend,
      // Add use-m function (dynamically loaded)
      use: use
    });

    try {
      const trimmedCode = code.trim();
      
      // Check if code contains await or async patterns
      const hasAwait = /\bawait\b/.test(trimmedCode);
      
      // Check if await is at top level (not inside async function)
      let hasTopLevelAwait = false;
      if (hasAwait) {
        // Remove all async function blocks and check if await still exists
        const codeWithoutAsyncFunctions = trimmedCode
          .replace(/async\s+function[^{]*\{[\s\S]*?\}/g, '') // Remove async functions
          .replace(/async\s*\([^)]*\)\s*=>\s*\{[\s\S]*?\}/g, '') // Remove async arrow functions
          .replace(/async\s*\([^)]*\)\s*=>[^,;\n}]*/g, ''); // Remove simple async arrows
        
        hasTopLevelAwait = /\bawait\b/.test(codeWithoutAsyncFunctions);
      }

      // For simple expressions, wrap in return statement
      const isSimpleExpression = (
        !trimmedCode.includes('\n') && 
        !trimmedCode.includes(';') &&
        !trimmedCode.includes('const ') &&
        !trimmedCode.includes('let ') &&
        !trimmedCode.includes('var ') &&
        !trimmedCode.includes('function ') &&
        !trimmedCode.includes('class ') &&
        !trimmedCode.includes('if ') &&
        !trimmedCode.includes('for ') &&
        !trimmedCode.includes('while ') &&
        !trimmedCode.includes('throw ') &&
        !trimmedCode.includes('return ') &&
        !trimmedCode.includes('break ') &&
        !trimmedCode.includes('continue ') &&
        !trimmedCode.includes('=') &&
        !hasAwait &&
        trimmedCode.length > 0
      );

      let wrappedCode: string;
      
      if (isSimpleExpression) {
        // Simple expression - just return it
        wrappedCode = `(${trimmedCode})`;
      } else if (hasTopLevelAwait) {
        // Wrap in async IIFE for top-level await
        const lines = trimmedCode.split('\n').map(line => line.trim()).filter(line => line);
        const lastLine = lines[lines.length - 1];
        
        // If last line looks like an expression, return it
        if (lastLine && 
            !lastLine.includes('=') && 
            !lastLine.endsWith(';') &&
            !lastLine.startsWith('const ') &&
            !lastLine.startsWith('let ') &&
            !lastLine.startsWith('var ') &&
            !lastLine.startsWith('throw ') &&
            !lastLine.includes('function ') &&
            !lastLine.includes('class ') &&
            // Check if it's a valid expression (variable, comparison, logical operations, etc.)
            (
              /^[a-zA-Z_$][a-zA-Z0-9_$.[\]]*$/.test(lastLine) || // Simple variable access
              /^[a-zA-Z_$][a-zA-Z0-9_$.[\]]*\s*(===|!==|==|!=|>|<|>=|<=)\s*/.test(lastLine) || // Comparisons
              /^[a-zA-Z_$][a-zA-Z0-9_$.[\]]*\s*(&&|\|\|)\s*/.test(lastLine) || // Logical operations
              /^[a-zA-Z_$][a-zA-Z0-9_$.[\]]*\s*[+\-*/]\s*/.test(lastLine) || // Arithmetic operations
              /^\(.+\)$/.test(lastLine) || // Parenthesized expressions
              /^typeof\s+/.test(lastLine) || // typeof operator
              /^await\s+/.test(lastLine) || // await expressions
              /^[a-zA-Z_$][a-zA-Z0-9_$.[\]]*\([^)]*\)$/.test(lastLine) || // Method calls like _.add(1,2)
              lastLine.includes(' === ') || lastLine.includes(' !== ') || // Explicit equality checks
              lastLine.includes(' == ') || lastLine.includes(' != ') ||
              lastLine.includes(' && ') || lastLine.includes(' || ') // Explicit logical operators
            )) {
          
          const codeWithoutLastLine = lines.slice(0, -1).join('\n');
          wrappedCode = `(async function() {
            ${codeWithoutLastLine}
            return ${lastLine};
          })()`;
        } else {
          // Just execute as-is in async IIFE
          wrappedCode = `(async function() {
            ${trimmedCode}
          })()`;
        }
            } else {
        // Multi-line code or statements
        const lines = trimmedCode.split('\n').map(line => line.trim()).filter(line => line);
              const lastLine = lines[lines.length - 1];
              
        // If last line looks like an expression (no keywords, no assignment), return it
        if (lastLine && 
            !lastLine.includes('=') && 
            !lastLine.endsWith(';') &&
            !lastLine.startsWith('const ') &&
            !lastLine.startsWith('let ') &&
            !lastLine.startsWith('var ') &&
            !lastLine.startsWith('throw ') &&
            // Check if it's a valid expression (variable, comparison, logical operations, etc.)
            (
              /^[a-zA-Z_$][a-zA-Z0-9_$.[\]]*$/.test(lastLine) || // Simple variable access
              /^[a-zA-Z_$][a-zA-Z0-9_$.[\]]*\s*(===|!==|==|!=|>|<|>=|<=)\s*/.test(lastLine) || // Comparisons
              /^[a-zA-Z_$][a-zA-Z0-9_$.[\]]*\s*(&&|\|\|)\s*/.test(lastLine) || // Logical operations
              /^[a-zA-Z_$][a-zA-Z0-9_$.[\]]*\s*[+\-*/]\s*/.test(lastLine) || // Arithmetic operations
              /^\(.+\)$/.test(lastLine) || // Parenthesized expressions
              /^typeof\s+/.test(lastLine) || // typeof operator
              /^await\s+/.test(lastLine) || // await expressions
              /^[a-zA-Z_$][a-zA-Z0-9_$.[\]]*\([^)]*\)$/.test(lastLine) || // Method calls like _.add(1,2)
              lastLine.includes(' === ') || lastLine.includes(' !== ') || // Explicit equality checks
              lastLine.includes(' == ') || lastLine.includes(' != ') ||
              lastLine.includes(' && ') || lastLine.includes(' || ') // Explicit logical operators
            )) {
          
          // Execute all but last line, then return last line
          const codeWithoutLastLine = lines.slice(0, -1).join('\n');
          wrappedCode = `
            ${codeWithoutLastLine}
            ${lastLine}
          `;
                  } else {
          // Just execute the code as-is
          wrappedCode = trimmedCode;
        }
      }

      const result = vm.runInContext(wrappedCode, executionContext, {
        timeout: this.options.timeout,
        displayErrors: this.options.displayErrors
      });

      // Handle promises (for async code)
      const finalResult = result instanceof Promise ? await result : result;
      
      return finalResult;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Execution error: ${errorMessage}`);
    }
  }

  getContext(): ExecContext {
    return { ...this.initialContext };
  }

  updateContext(updates: ExecContext): void {
    Object.assign(this.initialContext, updates);
    // Update the main context as well
    Object.assign(this.context, updates);
  }

  clearContext(): void {
    this.initialContext = {};
    
    // Recreate context with only essential globals
    this.context = vm.createContext({
      ...getEnvironmentGlobals()
    });
  }

  // Static method to detect environment
  static getEnvironment(): 'node' | 'browser' {
    return typeof window === 'undefined' ? 'node' : 'browser';
  }

  // Static method to check if running in secure context (browser only)
  static isSecureContext(): boolean {
    if (typeof window === 'undefined') {
      return true; // Node.js is considered secure
    }
    return window.isSecureContext || location.protocol === 'https:';
  }

  // Static methods for working with global results object
  static getResults(): { [uuid: string]: any } {
    return globalResults;
  }

  static setResult(uuid: string, value: any): void {
    globalResults[uuid] = value;
  }

  static getResult(uuid: string): any {
    return globalResults[uuid];
  }

  static deleteResult(uuid: string): boolean {
    if (uuid in globalResults) {
      delete globalResults[uuid];
      return true;
    }
    return false;
  }

  static clearResults(): void {
    clearResults();
  }
}

// Factory function for easier usage
export function createExec(context: ExecContext = {}, options: ExecOptions = {}): Exec {
  return new Exec(context, options);
} 

export interface ExecDo {
  exec: (code: string) => Promise<any>;
  context: any;
  updateContext: (newContext: any) => void;
  getContext: () => any;
  clearContext: () => void;
}

export interface ExecDoCallbacks {
  onCodeExecuting?: (code: string) => void;
  onCodeResult?: (result: any) => void;
  onError?: (error: Error) => void;
}

/**
 * Create execDo object for AI integration
 */
export function createExecDo(context: any = {}, callbacks: ExecDoCallbacks = {}): ExecDo {
  const exec = new Exec(context);
  
  return {
    exec: async (code: string) => {
      try {
        if (callbacks.onCodeExecuting) {
          callbacks.onCodeExecuting(code);
        }
        
        const result = await exec.exec(code);
        
        if (callbacks.onCodeResult) {
          callbacks.onCodeResult(result);
        }
        
        return result;
      } catch (error) {
        if (callbacks.onError) {
          callbacks.onError(error as Error);
        }
        throw error;
      }
    },
    context: exec.getContext(),
    updateContext: (newContext: any) => exec.updateContext(newContext),
    getContext: () => exec.getContext(),
    clearContext: () => exec.clearContext()
  };
}

/**
 * Default exec context for AI
 */
export const execContext = `
📦 **JavaScript Execution Environment**

You can execute JavaScript code using Node.js VM with full async/await support.

**Available Context:**
- Node.js built-ins (fs, path, crypto, etc.)
- Process information (process.env, process.platform, etc.) 
- Network capabilities (fetch, HTTP client)
- File system access
- Dynamic imports and module resolution

**Persistent State Management:**
- \`results[uuid]\` - Global object for storing persistent state between executions
- Use unique UUIDs to store and retrieve objects that need to persist
- Perfect for browser instances, database connections, complex objects
- Example: \`results['browser1'] = await puppeteer.launch()\`
- Later: \`const browser = results['browser1']\`

**Execution Format:**
> 🪬<uuid>/do/exec/js
\`\`\`js
your javascript code here
\`\`\`

**Examples:**
> 🪬calc1/do/exec/js
\`\`\`js
2 + 2
\`\`\`

> 🪬info1/do/exec/js
\`\`\`js
process.platform
\`\`\`

> 🪬async1/do/exec/js
\`\`\`js
await fetch('https://api.github.com/users/octocat').then(r => r.json())
\`\`\`

> 🪬state1/do/exec/js
\`\`\`js
// Store persistent state
results['myData'] = { value: 42 };
results['myData']
\`\`\`
`;

/**
 * Default execDo object
 */
export const execDo = createExecDo(); 