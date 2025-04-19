"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = __importDefault(require("debug"));
const package_json_1 = __importDefault(require("../package.json")); // Using relative path
// Initialize root debugger using package name
const rootDebug = (0, debug_1.default)(package_json_1.default.shortName || package_json_1.default.name);
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
function debug(namespace, ...args) {
    if (args.length > 0) {
        // Pattern 2: Used like debug('message', ...args)
        // Here, namespace is actually the first message argument
        const log = rootDebug.extend('app'); // Default namespace
        log(namespace, ...args); // Log namespace as the first argument
        return;
    }
    // Pattern 1: Used like debug('namespace')
    // Return the debugger function for that namespace
    return rootDebug.extend(namespace || 'app');
}
exports.default = debug;
