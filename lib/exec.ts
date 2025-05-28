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
  };

  // Add Node.js specific globals only if available
  if (typeof window === 'undefined') {
    // Node.js environment
    globals.process = process;
    
    // Create require function for ESM compatibility
    try {
      const require = createRequire(import.meta.url);
      globals.require = require;
    } catch (error) {
      // Fallback for environments where createRequire is not available
      if (typeof require !== 'undefined') {
        globals.require = require;
      }
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

// Initialize use-m support
const initializeUseM = async () => {
  try {
    const { use } = await import('use-m');
    return use;
  } catch (error) {
    // use-m not available
    return null;
  }
};

export class Exec {
  private context: vm.Context;
  private options: ExecOptions;
  private initialContext: ExecContext;
  private useMFunction: any = null;

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
    // Initialize use-m if not already initialized
    if (!this.useMFunction) {
      this.useMFunction = await initializeUseM();
    }

    // Create a fresh context for this execution
    const executionContext = vm.createContext({
      ...getEnvironmentGlobals(),
      ...this.initialContext,
      ...contextExtend,
      // Add use-m function if available
      ...(this.useMFunction ? { use: this.useMFunction } : {})
    });

    try {
      // Wrap the code to capture the result
      const wrappedCode = `
        (async () => {
          let __result;
          try {
            // Try to evaluate as expression first
            __result = eval(\`(${code.replace(/`/g, '\\`')})\`);
          } catch (e) {
            // If that fails, execute as statements and try to get last expression
            ${code}
            
            // Try to extract last line as expression
            const lines = \`${code.replace(/`/g, '\\`')}\`.trim().split('\\n');
            const lastLine = lines[lines.length - 1].trim();
            
            if (lines.length > 1 && lastLine && !lastLine.endsWith(';') && !lastLine.startsWith('//')) {
              try {
                // Check if last line contains await
                if (lastLine.includes('await')) {
                  __result = await eval(\`(async () => { return \${lastLine}; })()\`);
                } else {
                  __result = eval(lastLine);
                }
              } catch (e2) {
                // Last line is not an expression, return undefined
                __result = undefined;
              }
            }
          }
          return __result;
        })()
      `;

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
    const contextUpdates = {
      ...updates,
      ...(this.useMFunction ? { use: this.useMFunction } : {})
    };
    Object.assign(this.context, contextUpdates);
  }

  clearContext(): void {
    this.initialContext = {};
    
    // Recreate context with only essential globals
    this.context = vm.createContext({
      ...getEnvironmentGlobals(),
      ...(this.useMFunction ? { use: this.useMFunction } : {})
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
}

// Factory function for easier usage
export function createExec(context: ExecContext = {}, options: ExecOptions = {}): Exec {
  return new Exec(context, options);
} 