import { Debugger } from 'debug';
/**
 * Debug utility.
 *
 * Allows two calling patterns:
 * 1. debug('namespace')('message', ...args) - Returns a debugger function for the namespace.
 * 2. debug('message', ...args) - Logs a message with the default namespace ('app').
 *
 * @param namespace - Namespace for the message or the message itself (if other args passed).
 * @param args - Arguments to log (used only in the second calling pattern).
 * @returns Either a debugger function for the specified namespace or void.
 */
declare function debug(namespace: string, ...args: any[]): Debugger | void;
export default debug;
