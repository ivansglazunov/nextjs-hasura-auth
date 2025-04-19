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
declare function Debug(namespace?: string): DebuggerFunction;
export default Debug;
