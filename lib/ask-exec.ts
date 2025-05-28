import { AI, Do } from './ai';
import { Exec } from './exec';
import { ExecTs } from './exec-tsx';
import Debug from './debug';

const debug = Debug('hasyx:ask-exec');

export interface AskExecOptions {
  autoConfirm?: boolean; // -y --yes flag
  context?: any;
}

export interface AskExecCallbacks {
  onCodeFound?: (code: string, format: 'js' | 'tsx') => void;
  onCodeExecuting?: (code: string, format: 'js' | 'tsx') => void;
  onCodeResult?: (result: string) => void;
  onConfirmationRequest?: (code: string, format: 'js' | 'tsx') => Promise<boolean>;
}

export class AskExec {
  private exec: Exec;
  private execTs: ExecTs;
  private options: AskExecOptions;
  private callbacks: AskExecCallbacks;

  constructor(options: AskExecOptions = {}, callbacks: AskExecCallbacks = {}) {
    this.options = options;
    this.callbacks = callbacks;
    
    // Initialize execution engines with context
    this.exec = new Exec(options.context || {});
    this.execTs = new ExecTs(options.context || {});
    
    debug('AskExec initialized with options:', options);
  }

  /**
   * Setup AI instance with exec callbacks
   */
  setupAI(ai: AI): AI {
    debug('Setting up AI with exec callbacks');
    
    ai._onCodeFound = (code: string, format: 'js' | 'tsx') => {
      if (this.callbacks.onCodeFound) {
        this.callbacks.onCodeFound(code, format);
      }
    };
    
    ai._onCodeExecuting = (code: string, format: 'js' | 'tsx') => {
      if (this.callbacks.onCodeExecuting) {
        this.callbacks.onCodeExecuting(code, format);
      }
    };
    
    ai._onCodeResult = (result: string) => {
      if (this.callbacks.onCodeResult) {
        this.callbacks.onCodeResult(result);
      }
    };

    // Custom Do handler with confirmation
    ai._do = async (doItem: Do): Promise<Do> => {
      return await this.executeWithConfirmation(doItem);
    };

    return ai;
  }

  /**
   * Execute Do operation with optional confirmation
   */
  private async executeWithConfirmation(doItem: Do): Promise<Do> {
    debug(`Executing Do operation: ${doItem.id}`);
    
    // Check if confirmation is needed
    if (!this.options.autoConfirm && this.callbacks.onConfirmationRequest) {
      const confirmed = await this.callbacks.onConfirmationRequest(doItem.request, doItem.format);
      if (!confirmed) {
        doItem.response = 'Execution cancelled by user.';
        return doItem;
      }
    }
    
    // Notify that code was found
    if (this.callbacks.onCodeFound) {
      this.callbacks.onCodeFound(doItem.request, doItem.format);
    }
    
    // Notify that code is executing
    if (this.callbacks.onCodeExecuting) {
      this.callbacks.onCodeExecuting(doItem.request, doItem.format);
    }
    
    try {
      let result: string;
      
      if (doItem.format === 'tsx') {
        debug(`Executing TSX code for: ${doItem.id}`);
        const rawResult = await this.execTs.exec(doItem.request);
        result = this.formatExecutionResult(rawResult);
      } else {
        debug(`Executing JS code for: ${doItem.id}`);
        const rawResult = await this.exec.exec(doItem.request);
        result = this.formatExecutionResult(rawResult);
      }
      
      debug(`Execution result for ${doItem.id}:`, result);
      doItem.response = result;
      
      // Notify that result is available
      if (this.callbacks.onCodeResult) {
        this.callbacks.onCodeResult(result);
      }
      
    } catch (error) {
      debug(`Execution error for ${doItem.id}:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      doItem.response = `Error: ${errorMessage}`;
      
      // Notify about error result
      if (this.callbacks.onCodeResult) {
        this.callbacks.onCodeResult(`Error: ${errorMessage}`);
      }
    }
    
    return doItem;
  }

  /**
   * Format execution result for display and AI analysis
   */
  private formatExecutionResult(rawResult: any): string {
    if (rawResult === undefined) {
      return 'undefined';
    }
    
    if (rawResult === null) {
      return 'null';
    }
    
    if (typeof rawResult === 'string') {
      return rawResult;
    }
    
    if (typeof rawResult === 'number' || typeof rawResult === 'boolean') {
      return String(rawResult);
    }
    
    if (rawResult instanceof Error) {
      return `Error: ${rawResult.message}`;
    }
    
    if (typeof rawResult === 'function') {
      return `[Function: ${rawResult.name || 'anonymous'}]`;
    }
    
    if (typeof rawResult === 'object') {
      try {
        // For objects, try to stringify with proper formatting
        return JSON.stringify(rawResult, null, 2);
      } catch (error) {
        // If JSON.stringify fails (circular reference, etc.), use toString
        return String(rawResult);
      }
    }
    
    // Fallback to string conversion
    return String(rawResult);
  }

  /**
   * Update execution context
   */
  updateContext(context: any): void {
    this.exec.updateContext(context);
    this.execTs.updateContext(context);
    debug('Execution context updated');
  }

  /**
   * Get current execution context
   */
  getContext(): any {
    return this.exec.getContext();
  }

  /**
   * Clear execution context
   */
  clearContext(): void {
    this.exec.clearContext();
    this.execTs.clearContext();
    debug('Execution context cleared');
  }
} 