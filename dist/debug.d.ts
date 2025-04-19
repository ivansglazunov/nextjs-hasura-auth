export = debug;
/**
 * Debug utility function
 * @param {string} namespace - Namespace for the debug message or the message itself
 * @param {...any} args - Arguments to log
 * @returns {Function|void} - Debug function or void
 */
declare function debug(namespace: string, ...args: any[]): Function | void;
