"use strict";
const _debug = require('debug');
const pckg = require('./package.json');
// Initialize root debugger using package name
const rootDebug = _debug(pckg.shortName || pckg.name);
/**
 * Debug utility function
 * @param {string} namespace - Namespace for the debug message or the message itself
 * @param {...any} args - Arguments to log
 * @returns {Function|void} - Debug function or void
 */
function debug(namespace, ...args) {
    if (args.length > 0) {
        // Used like debug('message')
        const log = rootDebug.extend(namespace || 'app');
        log(...args);
        return;
    }
    // Used like debug('namespace')('message')
    return rootDebug.extend(namespace || 'app');
}
module.exports = debug;
