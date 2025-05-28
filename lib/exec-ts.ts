import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs-extra';
import { cloneDeep } from 'lodash';
import { Exec, ExecOptions, ExecContext } from './exec';
import Debug from './debug';

const debug = Debug('hasyx:exec-ts');

// Load and prepare TypeScript configuration at module level
const loadTsConfig = (): ts.CompilerOptions => {
  const projectRoot = process.cwd();
  const tsconfigPath = path.join(projectRoot, 'tsconfig.lib.json');
  
  let baseOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2016,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    strict: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
  };

  // Try to load tsconfig.lib.json if it exists
  if (fs.existsSync(tsconfigPath)) {
    try {
      debug('Loading tsconfig.lib.json from:', tsconfigPath);
      
      const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
      if (!configFile.error) {
        const parsedConfig = ts.parseJsonConfigFileContent(
          configFile.config,
          ts.sys,
          projectRoot
        );
        
        if (!parsedConfig.errors || parsedConfig.errors.length === 0) {
          baseOptions = { ...baseOptions, ...parsedConfig.options };
          debug('Successfully loaded tsconfig.lib.json options');
        } else {
          debug('Errors parsing tsconfig.lib.json:', parsedConfig.errors);
        }
      } else {
        debug('Error reading tsconfig.lib.json:', configFile.error);
      }
    } catch (error) {
      debug('Error loading tsconfig.lib.json, using defaults:', error);
    }
  } else {
    debug('tsconfig.lib.json not found, using default options');
  }

  return baseOptions;
};

// Load configuration once at module level
const baseTsConfig = loadTsConfig();

// Create in-memory compilation options by deep cloning and modifying
const createInMemoryCompilerOptions = (userOptions?: Partial<ts.CompilerOptions>): ts.CompilerOptions => {
  // Deep clone the base configuration
  const options = cloneDeep(baseTsConfig);
  
  // Modify for in-memory compilation (no file output)
  options.noEmit = true;
  options.declaration = false;
  options.declarationMap = false;
  options.sourceMap = false;
  options.inlineSourceMap = false;
  options.inlineSources = false;
  options.outDir = undefined;
  options.outFile = undefined;
  options.rootDir = undefined;
  
  // Apply user overrides if provided
  if (userOptions) {
    Object.assign(options, userOptions);
  }
  
  debug('Created in-memory compiler options:', options);
  return options;
};

export interface ExecTsOptions extends ExecOptions {
  compilerOptions?: Partial<ts.CompilerOptions>;
  strict?: boolean;
}

export class ExecTs extends Exec {
  private tsOptions: ExecTsOptions;
  private compilerOptions: ts.CompilerOptions;

  constructor(initialContext: ExecContext = {}, options: ExecTsOptions = {}) {
    super(initialContext, options);
    
    this.tsOptions = options;
    
    // Create compiler options with user overrides
    const userCompilerOptions = options.compilerOptions || {};
    
    // Handle strict option
    if (options.strict !== undefined) {
      userCompilerOptions.strict = options.strict;
    }
    
    this.compilerOptions = createInMemoryCompilerOptions(userCompilerOptions);
    
    debug('ExecTs initialized with compiler options:', this.compilerOptions);
  }

  /**
   * Execute TypeScript code by compiling it to JavaScript first
   */
  async execTs(code: string, contextExtend: ExecContext = {}): Promise<any> {
    debug('Executing TypeScript code:', code);
    
    try {
      // Compile TypeScript to JavaScript
      const compiledJs = this.compileTypeScript(code);
      debug('Compiled JavaScript:', compiledJs);
      
      // Execute compiled JavaScript using parent exec method
      return await this.exec(compiledJs, contextExtend);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`TypeScript execution error: ${errorMessage}`);
    }
  }

  /**
   * Compile TypeScript code to JavaScript
   */
  private compileTypeScript(code: string): string {
    debug('Compiling TypeScript with options:', this.compilerOptions);
    
    // Use TypeScript transpile function for simple compilation
    const result = ts.transpile(code, this.compilerOptions);
    
    if (!result) {
      throw new Error('TypeScript compilation failed: empty result');
    }
    
    debug('TypeScript compilation successful');
    return result;
  }

  /**
   * Check if code contains TypeScript-specific syntax
   */
  static isTypeScriptCode(code: string): boolean {
    // Simple heuristics to detect TypeScript syntax
    const tsPatterns = [
      /:\s*(string|number|boolean|object|any|void|never|unknown)\b/, // Type annotations
      /interface\s+\w+/, // Interface declarations
      /type\s+\w+\s*=/, // Type aliases
      /<[A-Z]\w*>/, // Generic types
      /\w+\s*:\s*\w+\s*=/, // Property with type annotation
      /\w+\?\s*:/, // Optional properties
      /as\s+\w+/, // Type assertions
      /enum\s+\w+/, // Enum declarations
      /namespace\s+\w+/, // Namespace declarations
      /declare\s+/, // Ambient declarations
      /readonly\s+/, // Readonly modifier
      /public\s+|private\s+|protected\s+/, // Access modifiers
    ];
    
    return tsPatterns.some(pattern => pattern.test(code));
  }

  /**
   * Update TypeScript compiler options
   */
  updateCompilerOptions(options: Partial<ts.CompilerOptions>): void {
    this.compilerOptions = createInMemoryCompilerOptions({
      ...this.tsOptions.compilerOptions,
      ...options
    });
    debug('Compiler options updated:', options);
  }

  /**
   * Get current compiler options (for debugging)
   */
  getCurrentCompilerOptions(): ts.CompilerOptions {
    return cloneDeep(this.compilerOptions);
  }
}

// Factory function for easier usage
export function createExecTs(context: ExecContext = {}, options: ExecTsOptions = {}): ExecTs {
  return new ExecTs(context, options);
} 