// Universal VM import that works in both Node.js and browser
// In browser environments, bundlers like webpack/browserify will automatically
// replace 'vm' with 'vm-browserify'
import vm from 'vm';
import { createRequire } from 'module';
import Debug from './debug';

const debug = Debug('hasyx:exec');

export interface ExecOptions {
  timeout?: number;
  displayErrors?: boolean;
  consoleMemoryLimit?: number;
  onConsole?: (log: ConsoleLog) => void;
  initialContext?: ExecContext;
}

export interface ExecContext {
  [key: string]: any;
}

export interface ConsoleLog {
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  args: any[];
  timestamp: Date;
}

export interface ExecResult {
  result: any;
  logs: ConsoleLog[];
}

/**
 * Creates a proxy for the console object to intercept log messages.
 */
export const generateConsole = (options: {
  onConsole?: (log: ConsoleLog) => void;
  memoryLimit?: number;
}) => {
  const memory: ConsoleLog[] = [];
  const limit = options.memoryLimit ?? 1000;

  const createHandler = (level: ConsoleLog['level']) => {
    return (...args: any[]) => {
      const logEntry: ConsoleLog = {
        level,
        args,
        timestamp: new Date(),
      };
      
      memory.push(logEntry);
      if (memory.length > limit) {
        memory.shift();
      }
      
      if (options.onConsole) {
        options.onConsole(logEntry);
      }
      
      // Also call the original console method
      if (typeof console !== 'undefined' && console[level]) {
        (console[level] as Function)(...args);
      } else if (typeof console !== 'undefined') {
        console.log(...args);
      }
    };
  };

  const consoleProxy = {
    log: createHandler('log'),
    warn: createHandler('warn'),
    error: createHandler('error'),
    info: createHandler('info'),
    debug: createHandler('debug'),
    _memory: memory,
    _clearMemory: () => {
      memory.length = 0;
    },
    get _memoryLimit() {
      return limit;
    }
  };

  // Add other console methods to the proxy to ensure full compatibility
  if (typeof console !== 'undefined') {
    for (const key in console) {
      if (typeof (console as any)[key] === 'function' && !(consoleProxy as any)[key]) {
        (consoleProxy as any)[key] = (console as any)[key].bind(console);
      }
    }
  }

  return consoleProxy;
};

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
const getEnvironmentGlobals = (wrappedConsole: any) => {
  const globals: any = {
    console: wrappedConsole,
    results: globalResults,
  };

  // Add globals available in both environments
  if(typeof setTimeout !== 'undefined') globals.setTimeout = setTimeout;
  if(typeof clearTimeout !== 'undefined') globals.clearTimeout = clearTimeout;
  if(typeof setInterval !== 'undefined') globals.setInterval = setInterval;
  if(typeof clearInterval !== 'undefined') globals.clearInterval = clearInterval;
  if(typeof URL !== 'undefined') globals.URL = URL;
  if(typeof Error !== 'undefined') globals.Error = Error;
  if(typeof Date !== 'undefined') globals.Date = Date;
  if(typeof Math !== 'undefined') globals.Math = Math;
  if(typeof JSON !== 'undefined') globals.JSON = JSON;
  if(typeof Promise !== 'undefined') globals.Promise = Promise;

  // Add Node.js specific globals only if available
  if (typeof window === 'undefined') {
    globals.process = process;
    if (typeof require !== 'undefined') {
      globals.require = require;
    }
    if(typeof Buffer !== 'undefined') globals.Buffer = Buffer;
  } else {
    globals.process = {
      env: {}, version: 'browser', platform: 'browser',
      cwd: () => '/', nextTick: (fn: Function) => setTimeout(fn, 0)
    };
  }

  return globals;
};

export class Exec {
  private context: vm.Context;
  private options: ExecOptions;
  public initialContext: ExecContext;
  public console: ReturnType<typeof generateConsole>;
  public results: { [uuid: string]: any } = globalResults;

  constructor(options: ExecOptions = {}) {
    this.options = {
      timeout: 30000,
      displayErrors: true,
      consoleMemoryLimit: 1000,
      ...options
    };

    this.initialContext = { ...this.options.initialContext };
    this.console = generateConsole({
      onConsole: this.options.onConsole,
      memoryLimit: this.options.consoleMemoryLimit,
    });
    this.context = vm.createContext({});
    this.rebuildContext();
  }
  
  private rebuildContext() {
    this.context = vm.createContext(getEnvironmentGlobals(this.console));
    const fullContext = { ...this.initialContext, use: this.use.bind(this) };
    
    for (const key of Object.keys(fullContext)) {
      this.context[key] = fullContext[key];
    }
  }

  async use(moduleName: string): Promise<any> {
    const useFn = await initializeUse();
    if (useFn) {
        return useFn(moduleName);
    }
    throw new Error("'use' function is not available in this environment.");
  }

  async exec(code: string, contextExtend: ExecContext = {}): Promise<ExecResult> {
    // Create a temporary console for this execution to capture its specific logs
    const executionLogs: ConsoleLog[] = [];
    const executionConsole = generateConsole({
      onConsole: (log) => {
        // Add to execution-specific logs
        executionLogs.push(log);
        // Also add to instance console for memory accumulation
        this.console._memory.push(log);
        if (this.console._memory.length > this.console._memoryLimit) {
          this.console._memory.shift();
        }
        // Call the original onConsole callback if provided
        if (this.options.onConsole) {
          this.options.onConsole(log);
        }
      },
      memoryLimit: this.options.consoleMemoryLimit,
    });
    
    const originalConsole = this.context.console;
    this.context.console = executionConsole;

    // Add extended context for this execution
    for (const key in contextExtend) {
      this.context[key] = contextExtend[key];
    }
    
    // Check if code needs async wrapping
    const hasAwait = /\bawait\s+/m.test(code);
    // Only consider it a top-level return if it's not inside a function
    const hasTopLevelReturn = /^(\s*)return\s/m.test(code) && 
      !/function\s*\w*\s*\([^)]*\)\s*{[\s\S]*return/.test(code) &&
      !/=>\s*{[\s\S]*return/.test(code);
    
    let wrappedCode: string;
    if (hasTopLevelReturn) {
      // Code has explicit return statements - just wrap in function
      wrappedCode = `(async function() { ${code} })()`;
    } else if (hasAwait) {
      // Code has await but no explicit returns - need to return last expression
      const lines = code.trim().split('\n');
      const lastLine = lines[lines.length - 1].trim();
      const previousLines = lines.slice(0, -1).join('\n');
      if (previousLines.trim()) {
        wrappedCode = `(async function() { ${previousLines}; return ${lastLine}; })()`;
      } else {
        wrappedCode = `(async function() { return ${lastLine}; })()`;
      }
    } else {
      // For most cases, simple execution works fine and returns the last expression
      wrappedCode = code;
    }

    try {
      const resultPromise = vm.runInContext(wrappedCode, this.context, {
        timeout: this.options.timeout,
        displayErrors: this.options.displayErrors
      });

      // Handle both sync and async results
      const result = await Promise.resolve(resultPromise);
      
      // Return the execution-specific logs
      const capturedLogs = executionLogs;

      debug(`Code executed successfully, result: ${JSON.stringify(result)}`);
      return { result, logs: capturedLogs };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Execution error: ${errorMessage}`);
    } finally {
        // Cleanup: remove extended context properties and restore console
        for (const key in contextExtend) {
            delete this.context[key];
        }
        this.context.console = originalConsole;
    }
  }

  getContext(): ExecContext {
    const context = { ...this.initialContext };
    delete (context as any).console;
    return context;
  }

  updateContext(updates: ExecContext): void {
    Object.assign(this.initialContext, updates);
    this.rebuildContext();
  }

  clearContext(): void {
    this.initialContext = {};
    this.rebuildContext();
  }

  static getEnvironment(): 'node' | 'browser' {
    return typeof window === 'undefined' ? 'node' : 'browser';
  }

  static isSecureContext(): boolean {
    if (typeof window === 'undefined') {
      return true; // Node.js is considered secure
    }
    return window.isSecureContext || location.protocol === 'https:';
  }

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
export function createExec(options: ExecOptions = {}): Exec {
  return new Exec(options);
}

export interface ExecDo {
  exec: (code: string) => Promise<ExecResult>;
  context: any;
  updateContext: (newContext: any) => void;
  getContext: () => any;
  clearContext: () => void;
}

export interface ExecDoCallbacks {
  onCodeExecuting?: (code: string) => void;
  onCodeResult?: (result: any, logs: ConsoleLog[]) => void;
  onError?: (error: Error) => void;
}

/**
 * Create execDo object for AI integration
 */
export function createExecDo(context: any = {}, callbacks: ExecDoCallbacks = {}): ExecDo {
  const exec = new Exec({ initialContext: context });
  
  return {
    exec: async (code: string) => {
      try {
        if (callbacks.onCodeExecuting) callbacks.onCodeExecuting(code);
        const execResult = await exec.exec(code);
        if (callbacks.onCodeResult) callbacks.onCodeResult(execResult.result, execResult.logs);
        return execResult;
      } catch (error) {
        if (callbacks.onError) callbacks.onError(error as Error);
        throw error;
      }
    },
    context: exec.getContext(),
    updateContext: (newContext: any) => exec.updateContext(newContext),
    getContext: () => exec.getContext(),
    clearContext: () => exec.clearContext()
  };
}


// You can execute JavaScript code using Node.js VM with full async/await support.

// **Available Context:**
// - Node.js built-ins (fs, path, crypto, etc.)
// - Process information (process.env, process.platform, etc.) 
// - Network capabilities (fetch, HTTP client)
// - File system access
// - Dynamic imports and module resolution

// **Persistent State Management:**
// - \`results[uuid]\` - Global object for storing persistent state between executions
// - Use unique UUIDs to store and retrieve objects that need to persist
// - Perfect for browser instances, database connections, complex objects
// - Example: \`results['browser1'] = await puppeteer.launch()\`
// - Later: \`const browser = results['browser1']\`


/**
 * Default exec context for AI
 */
export const execContext = `
You not only text ai model, but also you can execute JavaScript code in difference contexts.
If you need it, write code not just inside markdown code block, but STRICTLY with this pattern:
> 😈<uuid>/do/exec/js
\`\`\`js
your javascript code here
\`\`\`
You receive the result of the execution after it's done.
You can make many executions in response with different UUIDs.
`;

/**
 * Default execDo object
 */
export const execDo = createExecDo(); 