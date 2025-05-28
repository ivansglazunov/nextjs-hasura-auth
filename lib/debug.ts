export type DebuggerFunction = (...args: any[]) => void;

/**
 * Debug utility factory.
 *
 * Always returns a debugger function for the specified namespace.
 * If no namespace is provided, uses 'app' as the default.
 *
 * @param namespace - Namespace for the debugger.
 * @returns A debugger function for the specified namespace.
 */
function Debug(namespace?: string): DebuggerFunction {
  const fullNamespace = `hasyx:${namespace || 'app'}`;
  
  return (...args: any[]) => {
    if (process.env.DEBUG) {
      console.log(`[${fullNamespace}]`, ...args);
    }
  };
}

// Export as default and also as module.exports for compatibility
export default Debug;

// For CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Debug;
  module.exports.default = Debug;
} 