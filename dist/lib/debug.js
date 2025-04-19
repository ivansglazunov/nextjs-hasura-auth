"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = __importDefault(require("debug"));
// @ts-ignore
const package_json_1 = __importDefault(require("../package.json")); // Using relative path
// Initialize root debugger using package name
const rootDebug = (0, debug_1.default)(package_json_1.default.shortName || package_json_1.default.name);
/**
 * Debug utility factory.
 *
 * Always returns a debugger function for the specified namespace.
 * If no namespace is provided, uses 'app' as the default.
 *
 * @param namespace - Namespace for the debugger.
 * @returns A debugger function for the specified namespace.
 */
function Debug(namespace) {
    // Return the debugger function for that namespace, defaulting to 'app'
    return rootDebug.extend(namespace || 'app');
}
exports.default = Debug;
