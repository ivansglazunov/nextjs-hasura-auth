import { describe, it, expect, afterAll } from '@jest/globals';
import { Terminal, createBashTerminal, createZshTerminal, createNodeTerminal, createPythonTerminal, destroyAllTerminals, TerminalOptions } from './terminal';
import * as os from 'os';

// Global cleanup after all tests
afterAll(async () => {
  // Allow some time for all async operations to complete
  await new Promise(resolve => setTimeout(resolve, 1000));
  destroyAllTerminals();
});

describe('Terminal', () => {
  describe('Environment Detection', () => {
    it('should detect default shell correctly on current platform', () => {
      const terminal = new Terminal({ autoStart: false });
      const options = terminal.getOptions();
      
      terminal.destroy();
      
      const platform = os.platform();
      switch (platform) {
        case 'win32':
          expect(options.shell).toMatch(/(cmd\.exe|powershell\.exe)/);
          break;
        case 'darwin':
        case 'linux':
          expect(options.shell).toMatch(/\/(bin|usr\/bin)\/(bash|zsh|sh)$/);
          break;
      }
    });

    it('should use custom shell when provided', () => {
      const customShell = '/bin/custom';
      const terminal = new Terminal({ 
        shell: customShell, 
        autoStart: false 
      });
      
      const options = terminal.getOptions();
      terminal.destroy();
      
      expect(options.shell).toBe(customShell);
    });

    it('should inherit environment variables with custom additions', () => {
      const customEnv = { CUSTOM_VAR: 'test_value' };
      const terminal = new Terminal({ 
        env: { ...process.env, ...customEnv }, 
        autoStart: false 
      });
      
      const options = terminal.getOptions();
      terminal.destroy();
      
      expect(options.env).toEqual(expect.objectContaining(customEnv));
      // Check that some common environment variables are present
      expect(options.env).toHaveProperty('PATH');
      expect(options.env).toHaveProperty('HOME');
    });
  });

  describe('Terminal Creation and Configuration', () => {
    it('should create terminal with default options', () => {
      const terminal = new Terminal({ autoStart: false });
      
      const options = terminal.getOptions();
      terminal.destroy();
      
      expect(options.cols).toBe(80);
      expect(options.rows).toBe(24);
      expect(options.encoding).toBe('utf8');
      expect(options.name).toBe('xterm-256color');
      expect(options.handleFlowControl).toBe(false);
    });

    it('should create terminal with custom options', () => {
      const customOptions: TerminalOptions = {
        cols: 120,
        rows: 30,
        encoding: 'utf16le',
        name: 'custom-term',
        handleFlowControl: true,
        autoStart: false
      };
      
      const terminal = new Terminal(customOptions);
      const options = terminal.getOptions();
      terminal.destroy();
      
      expect(options.cols).toBe(120);
      expect(options.rows).toBe(30);
      expect(options.encoding).toBe('utf16le');
      expect(options.name).toBe('custom-term');
      expect(options.handleFlowControl).toBe(true);
    });

    it('should update options after creation', () => {
      const terminal = new Terminal({ autoStart: false });
      
      terminal.updateOptions({
        cols: 100,
        rows: 40
      });
      
      const options = terminal.getOptions();
      terminal.destroy();
      
      expect(options.cols).toBe(100);
      expect(options.rows).toBe(40);
    });
  });

  describe('Terminal Lifecycle (without node-pty)', () => {
    it('should handle start failure when node-pty is not available', async () => {
      const terminal = new Terminal({ autoStart: false });
      
      expect(terminal.isRunning()).toBe(false);
      expect(terminal.isTerminalReady()).toBe(false);
      
      try {
        await expect(terminal.start()).rejects.toThrow('node-pty is not available');
        expect(terminal.isRunning()).toBe(false);
      } finally {
        terminal.destroy();
      }
    });

    it('should handle auto-start failure when node-pty is not available', async () => {
      // Create terminal with autoStart: true but handle the error
      let errorOccurred = false;
      let errorMessage = '';
      
      const terminal = new Terminal({ 
        autoStart: true,
        onError: (error) => { 
          errorOccurred = true;
          errorMessage = error.message;
        }
      });
      
      // Also listen to the error event
      terminal.on('error', (error) => {
        errorOccurred = true;
        errorMessage = error.message;
      });
      
      try {
        // Wait longer for auto-start to attempt and fail
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Auto-start should fail, terminal should remain not running, error should be handled
        expect(terminal.isRunning()).toBe(false);
        expect(errorOccurred).toBe(true);
        expect(errorMessage).toContain('node-pty is not available');
      } finally {
        terminal.destroy();
      }
    });
  });

  describe('Command Execution (without node-pty)', () => {
    it('should handle execution failure when terminal is not running', async () => {
      const terminal = new Terminal({ autoStart: false });
      
      try {
        // Command should be queued and then rejected when terminal is destroyed
        const promise = terminal.execute('echo "test"');
        terminal.destroy(); // Destroy immediately to reject queued commands
        await expect(promise).rejects.toThrow('Terminal destroyed');
      } finally {
        terminal.destroy();
      }
    });

    it('should queue commands when terminal is not ready', async () => {
      const terminal = new Terminal({ autoStart: false });
      
      try {
        // Execute command before starting terminal - should queue and then fail when start fails
        const promise1 = terminal.execute('echo "Queued1"');
        const promise2 = terminal.execute('echo "Queued2"');
        
        // Destroy immediately to reject queued commands
        terminal.destroy();
        
        // Queued commands should be rejected
        await expect(promise1).rejects.toThrow('Terminal destroyed');
        await expect(promise2).rejects.toThrow('Terminal destroyed');
      } finally {
        terminal.destroy();
      }
    });
  });

  describe('Terminal Input/Output (without node-pty)', () => {
    it('should handle write when terminal is not running', () => {
      const terminal = new Terminal({ autoStart: false });
      
      const success = terminal.write('test');
      terminal.destroy();
      
      expect(success).toBe(false);
    });

    it('should handle sendInput when terminal is not running', () => {
      const terminal = new Terminal({ autoStart: false });
      
      const success = terminal.sendInput('test\n');
      terminal.destroy();
      
      expect(success).toBe(false);
    });

    it('should handle sendKeyPress when terminal is not running', () => {
      const terminal = new Terminal({ autoStart: false });
      
      const enterSuccess = terminal.sendKeyPress('enter');
      const tabSuccess = terminal.sendKeyPress('tab');
      const ctrlCSuccess = terminal.sendKeyPress('ctrl+c');
      
      terminal.destroy();
      
      expect(enterSuccess).toBe(false);
      expect(tabSuccess).toBe(false);
      expect(ctrlCSuccess).toBe(false);
    });
  });

  describe('Terminal Control Operations (without node-pty)', () => {
    it('should handle resize on non-running terminal', () => {
      const terminal = new Terminal({ autoStart: false });
      
      // Should not throw error
      expect(() => terminal.resize(100, 50)).not.toThrow();
      
      terminal.destroy();
    });

    it('should handle clear on non-running terminal', () => {
      const terminal = new Terminal({ autoStart: false });
      
      // Should not throw error
      expect(() => terminal.clear()).not.toThrow();
      
      terminal.destroy();
    });

    it('should handle pause and resume on non-running terminal', () => {
      const terminal = new Terminal({ autoStart: false });
      
      // Should not throw error
      expect(() => terminal.pause()).not.toThrow();
      expect(() => terminal.resume()).not.toThrow();
      
      terminal.destroy();
    });
  });

  describe('Event Handling', () => {
    it('should set event handlers from options', () => {
      let dataReceived = '';
      let errorOccurred: Error | null = null;
      let exitData: { code: number; signal?: number } | null = null;
      let resizeData: { cols: number; rows: number } | null = null;
      
      const terminal = new Terminal({
        autoStart: false,
        onData: (data) => { dataReceived += data; },
        onError: (error) => { errorOccurred = error; },
        onExit: (code, signal) => { exitData = { code, signal }; },
        onResize: (cols, rows) => { resizeData = { cols, rows }; }
      });
      
      try {
        expect(terminal.onData).toBeDefined();
        expect(terminal.onError).toBeDefined();
        expect(terminal.onExit).toBeDefined();
        expect(terminal.onResize).toBeDefined();
      } finally {
        terminal.destroy();
      }
    });

    it('should update event handlers with updateOptions', () => {
      const terminal = new Terminal({ autoStart: false });
      
      let dataReceived = '';
      
      terminal.updateOptions({
        onData: (data) => { dataReceived += data; }
      });
      
      try {
        expect(terminal.onData).toBeDefined();
      } finally {
        terminal.destroy();
      }
    });
  });

  describe('Session and History Management', () => {
    it('should track session information', () => {
      const terminal = new Terminal({ autoStart: false });
      
      try {
        const session = terminal.getSession();
        expect(session.id).toBeDefined();
        expect(session.startTime).toBeInstanceOf(Date);
        expect(session.isActive).toBe(false);
        expect(session.commands).toHaveLength(0);
        expect(session.fullOutput).toBe('');
      } finally {
        terminal.destroy();
      }
    });

    it('should get empty command history initially', () => {
      const terminal = new Terminal({ autoStart: false });
      
      try {
        const history = terminal.getCommandHistory();
        expect(history).toHaveLength(0);
        
        expect(terminal.getLastCommand()).toBeNull();
      } finally {
        terminal.destroy();
      }
    });

    it('should get output since timestamp', () => {
      const terminal = new Terminal({ autoStart: false });
      
      try {
        const timestamp = new Date();
        const output = terminal.getOutputSince(timestamp);
        expect(output).toBe('');
      } finally {
        terminal.destroy();
      }
    });

    it('should get current output', () => {
      const terminal = new Terminal({ autoStart: false });
      
      try {
        const output = terminal.getOutput();
        expect(output).toBe('');
      } finally {
        terminal.destroy();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle kill on non-running terminal', () => {
      const terminal = new Terminal({ autoStart: false });
      
      const killSuccess = terminal.kill();
      terminal.destroy();
      
      expect(killSuccess).toBe(false);
    });

    it('should handle kill with different signals on non-running terminal', () => {
      const terminal = new Terminal({ autoStart: false });
      
      const killSuccess = terminal.kill('SIGTERM');
      terminal.destroy();
      
      expect(killSuccess).toBe(false);
    });
  });

  describe('Terminal Process Information', () => {
    it('should provide undefined process information when not running', () => {
      const terminal = new Terminal({ autoStart: false });
      
      try {
        expect(terminal.getPid()).toBeUndefined();
        expect(terminal.getProcess()).toBeUndefined();
        expect(terminal.getCols()).toBeUndefined();
        expect(terminal.getRows()).toBeUndefined();
      } finally {
        terminal.destroy();
      }
    });
  });

  describe('Factory Functions', () => {
    it('should create bash terminal with correct options', () => {
      const terminal = createBashTerminal({ autoStart: false });
      
      const options = terminal.getOptions();
      terminal.destroy();
      
      expect(options.shell).toBe('/bin/bash');
      expect(options.args).toEqual(['--login']);
    });

    it('should create zsh terminal with correct options', () => {
      const terminal = createZshTerminal({ autoStart: false });
      
      const options = terminal.getOptions();
      terminal.destroy();
      
      expect(options.shell).toBe('/bin/zsh');
      expect(options.args).toEqual(['--login']);
    });

    it('should create node terminal with correct options', () => {
      const terminal = createNodeTerminal({ autoStart: false });
      
      const options = terminal.getOptions();
      terminal.destroy();
      
      expect(options.shell).toBe('node');
      expect(options.args).toEqual(['--interactive']);
    });

    it('should create python terminal with correct options', () => {
      const terminal = createPythonTerminal({ autoStart: false });
      
      const options = terminal.getOptions();
      terminal.destroy();
      
      expect(options.shell).toBe('python3');
      expect(options.args).toEqual(['-i']);
    });

    it('should merge custom options with factory defaults', () => {
      const terminal = createBashTerminal({ 
        cols: 120, 
        rows: 40,
        autoStart: false 
      });
      
      const options = terminal.getOptions();
      terminal.destroy();
      
      expect(options.shell).toBe('/bin/bash');
      expect(options.args).toEqual(['--login']);
      expect(options.cols).toBe(120);
      expect(options.rows).toBe(40);
    });
  });

  describe('Edge Cases and Robustness', () => {
    it('should handle destroy on already destroyed terminal', () => {
      const terminal = new Terminal({ autoStart: false });
      
      terminal.destroy();
      
      // Should not throw error on second destroy
      expect(() => terminal.destroy()).not.toThrow();
    });

    it('should handle destroy on terminal that never started', () => {
      const terminal = new Terminal({ autoStart: false });
      
      // Should not throw error
      expect(() => terminal.destroy()).not.toThrow();
      
      expect(terminal.isRunning()).toBe(false);
    });

    it('should handle operations after destroy', () => {
      const terminal = new Terminal({ autoStart: false });
      
      terminal.destroy();
      
      // All operations should handle destroyed state gracefully
      expect(terminal.write('test')).toBe(false);
      expect(terminal.sendInput('test')).toBe(false);
      expect(terminal.sendKeyPress('enter')).toBe(false);
      expect(terminal.kill()).toBe(false);
      expect(() => terminal.resize(100, 50)).not.toThrow();
      expect(() => terminal.clear()).not.toThrow();
      expect(() => terminal.pause()).not.toThrow();
      expect(() => terminal.resume()).not.toThrow();
    });
  });

  describe('Global Registry and Cleanup', () => {
    it('should register terminals in global registry', () => {
      const terminal1 = new Terminal({ autoStart: false });
      const terminal2 = new Terminal({ autoStart: false });
      
      try {
        expect(terminal1.isRunning()).toBe(false);
        expect(terminal2.isRunning()).toBe(false);
        
        // Global cleanup should handle all terminals
        destroyAllTerminals();
        
        expect(terminal1.isRunning()).toBe(false);
        expect(terminal2.isRunning()).toBe(false);
      } finally {
        // Ensure cleanup even if test fails
        terminal1.destroy();
        terminal2.destroy();
      }
    });

    it('should handle cleanup of terminals with pending operations', async () => {
      const terminal = new Terminal({ autoStart: false });
      
      try {
        // Start a command that will be queued (since terminal can't start without node-pty)
        const promise = terminal.execute('echo "test"');
        
        // Destroy immediately
        terminal.destroy();
        
        // Promise should be rejected
        await expect(promise).rejects.toThrow('Terminal destroyed');
      } finally {
        terminal.destroy();
      }
    });
  });

  describe('Options and Configuration Validation', () => {
    it('should handle all terminal factory functions without throwing', () => {
      const factories = [
        () => createBashTerminal({ autoStart: false }),
        () => createZshTerminal({ autoStart: false }),
        () => createNodeTerminal({ autoStart: false }),
        () => createPythonTerminal({ autoStart: false })
      ];
      
      factories.forEach(factory => {
        const terminal = factory();
        try {
          expect(terminal).toBeInstanceOf(Terminal);
          expect(terminal.getOptions()).toBeDefined();
        } finally {
          terminal.destroy();
        }
      });
    });

    it('should handle complex options merging', () => {
      const baseOptions: TerminalOptions = {
        shell: '/custom/shell',
        args: ['arg1', 'arg2'],
        cwd: '/custom/cwd',
        env: { ...process.env, CUSTOM: 'value' },
        cols: 100,
        rows: 50,
        autoStart: false
      };
      
      const terminal = new Terminal(baseOptions);
      
      terminal.updateOptions({
        cols: 120,
        env: { ...process.env, ADDITIONAL: 'value2' }
      });
      
      const options = terminal.getOptions();
      terminal.destroy();
      
      expect(options.shell).toBe('/custom/shell');
      expect(options.args).toEqual(['arg1', 'arg2']);
      expect(options.cols).toBe(120);
      expect(options.env).toEqual(expect.objectContaining({ 
        ADDITIONAL: 'value2' 
      }));
    });
  });
}); 