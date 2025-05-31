import _debug from 'debug';
// @ts-ignore
import pckg from '../package.json'; // Using relative path

export type DebuggerFunction = (...args: any[]) => void;

// Initialize root debugger using package name
const rootDebug = _debug(pckg.name);

/**
 * Debug utility factory.
 *
 * Always returns a debugger function for the specified namespace.
 * If no namespace is provided, uses 'app' as the default.
 *
 * @param namespace - Namespace for the debugger.
 * @returns A debugger function for the specified namespace.
 */
export function Debug(namespace?: string): DebuggerFunction {
  // Return the debugger function for that namespace, defaulting to 'app'
  return rootDebug.extend(namespace || 'app') as DebuggerFunction;
}

export default Debug;
