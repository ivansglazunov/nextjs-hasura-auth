# Terminal Library

A comprehensive terminal emulation library for Node.js applications, providing a robust interface for spawning, managing, and interacting with terminal processes.

## Table of Contents

- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Factory Functions](#factory-functions)
- [Event Handling](#event-handling)
- [Session Management](#session-management)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)
- [Examples](#examples)
- [Testing](#testing)

## Installation

The Terminal library requires the `node-pty` package as a peer dependency:

```bash
npm install node-pty
```

## Basic Usage

```typescript
import { Terminal } from 'hasyx/lib/terminal';

// Create a new terminal instance
const terminal = new Terminal({
  shell: '/bin/bash',
  cols: 80,
  rows: 24,
  autoStart: true
});

// Execute commands
try {
  const result = await terminal.execute('echo "Hello World"');
  console.log(result); // "Hello World"
} catch (error) {
  console.error('Command failed:', error);
} finally {
  terminal.destroy();
}
```

## Configuration

The Terminal class accepts a comprehensive configuration object:

```typescript
interface TerminalOptions {
  shell?: string;              // Shell executable path
  args?: string[];             // Shell arguments
  cwd?: string;                // Working directory
  env?: NodeJS.ProcessEnv;     // Environment variables
  cols?: number;               // Terminal columns (default: 80)
  rows?: number;               // Terminal rows (default: 24)
  encoding?: string;           // Text encoding (default: 'utf8')
  name?: string;               // Terminal name (default: 'xterm-256color')
  handleFlowControl?: boolean; // Flow control handling (default: false)
  flowControlPause?: string;   // Flow control pause sequence
  flowControlResume?: string;  // Flow control resume sequence
  autoStart?: boolean;         // Auto-start on creation (default: true)
  
  // Event handlers
  onData?: (data: string) => void;
  onError?: (error: Error) => void;
  onExit?: (code: number, signal?: number) => void;
  onResize?: (cols: number, rows: number) => void;
}
```

### Default Configuration

```typescript
const defaultOptions = {
  shell: process.env.SHELL || '/bin/bash',  // Platform-specific default
  args: [],
  cwd: process.cwd(),
  env: { ...process.env },
  cols: 80,
  rows: 24,
  encoding: 'utf8',
  name: 'xterm-256color',
  handleFlowControl: false,
  autoStart: true
};
```

## API Reference

### Constructor

```typescript
constructor(options: TerminalOptions = {})
```

Creates a new Terminal instance with the specified options.

### Lifecycle Methods

#### `start(): Promise<void>`

Starts the terminal process. Returns a promise that resolves when the terminal is ready.

```typescript
const terminal = new Terminal({ autoStart: false });
await terminal.start();
```

#### `destroy(): void`

Destroys the terminal instance, cleaning up all resources and terminating the process.

```typescript
terminal.destroy();
```

#### `kill(signal?: string): boolean`

Terminates the terminal process with the specified signal.

```typescript
terminal.kill('SIGTERM'); // Graceful termination
terminal.kill('SIGKILL'); // Force termination
```

### Command Execution

#### `execute(command: string): Promise<string>`

Executes a command and returns the output. Commands are queued if the terminal is not ready.

```typescript
const output = await terminal.execute('ls -la');
console.log(output);
```

### Input Methods

#### `write(data: string): boolean`

Writes raw data to the terminal.

```typescript
terminal.write('echo "test"\n');
```

#### `sendInput(input: string): boolean`

Sends input to the terminal (alias for `write`).

```typescript
terminal.sendInput('ls\n');
```

#### `sendKeyPress(key: string): boolean`

Sends special key presses to the terminal.

```typescript
terminal.sendKeyPress('enter');
terminal.sendKeyPress('ctrl+c');
terminal.sendKeyPress('tab');
```

Supported special keys:
- `enter`, `tab`, `escape`, `backspace`, `delete`
- `up`, `down`, `left`, `right`
- `home`, `end`, `pageup`, `pagedown`
- `ctrl+c`, `ctrl+d`, `ctrl+z`, `ctrl+l`

### Terminal Control

#### `resize(cols: number, rows: number): void`

Resizes the terminal.

```typescript
terminal.resize(120, 30);
```

#### `clear(): void`

Clears the terminal screen and output buffer.

```typescript
terminal.clear();
```

#### `pause(): void` / `resume(): void`

Pauses or resumes the terminal process.

```typescript
terminal.pause();
// ... some time later
terminal.resume();
```

### State Methods

#### `isRunning(): boolean`

Returns whether the terminal process is currently running.

```typescript
if (terminal.isRunning()) {
  console.log('Terminal is active');
}
```

#### `isTerminalReady(): boolean`

Returns whether the terminal is ready to accept commands.

```typescript
if (terminal.isTerminalReady()) {
  await terminal.execute('pwd');
}
```

### Information Methods

#### `getPid(): number | undefined`

Returns the process ID of the terminal.

```typescript
const pid = terminal.getPid();
console.log(`Terminal PID: ${pid}`);
```

#### `getProcess(): string | undefined`

Returns the process name.

#### `getCols(): number | undefined` / `getRows(): number | undefined`

Returns the current terminal dimensions.

#### `getOptions(): TerminalOptions`

Returns a copy of the current terminal options.

```typescript
const options = terminal.getOptions();
console.log(`Shell: ${options.shell}`);
```

#### `updateOptions(options: Partial<TerminalOptions>): void`

Updates terminal options after creation.

```typescript
terminal.updateOptions({
  cols: 120,
  rows: 40,
  onData: (data) => console.log('Data received:', data)
});
```

## Factory Functions

The library provides convenient factory functions for common terminal types:

### Shell Terminals

```typescript
import { 
  createBashTerminal,
  createZshTerminal,
  createFishTerminal 
} from 'hasyx/lib/terminal';

const bashTerminal = createBashTerminal({ cols: 120 });
const zshTerminal = createZshTerminal({ rows: 40 });
const fishTerminal = createFishTerminal();
```

### Interactive Environments

```typescript
import { 
  createNodeTerminal,
  createPythonTerminal 
} from 'hasyx/lib/terminal';

const nodeRepl = createNodeTerminal();
const pythonRepl = createPythonTerminal();

// Execute code
const result = await nodeRepl.execute('console.log("Hello from Node!")');
```

### System Terminals

```typescript
import { 
  createPowerShellTerminal,
  createCmdTerminal 
} from 'hasyx/lib/terminal';

// Windows terminals
const powershell = createPowerShellTerminal();
const cmd = createCmdTerminal();
```

### Remote Terminals

```typescript
import { 
  createDockerTerminal,
  createSSHTerminal 
} from 'hasyx/lib/terminal';

const dockerTerm = createDockerTerminal('my-container');
const sshTerm = createSSHTerminal('user@server.com');
```

## Event Handling

### Event Emitter Interface

The Terminal class extends EventEmitter and emits various events:

```typescript
terminal.on('start', (info) => {
  console.log('Terminal started:', info);
});

terminal.on('ready', () => {
  console.log('Terminal is ready for commands');
});

terminal.on('data', (data) => {
  console.log('Output:', data);
});

terminal.on('exit', (code, signal) => {
  console.log(`Terminal exited with code ${code}`);
});

terminal.on('error', (error) => {
  console.error('Terminal error:', error);
});

terminal.on('commandComplete', (command) => {
  console.log('Command completed:', command);
});
```

### Event Handler Options

You can also provide event handlers through the options:

```typescript
const terminal = new Terminal({
  onData: (data) => process.stdout.write(data),
  onError: (error) => console.error('Error:', error),
  onExit: (code) => console.log(`Exited: ${code}`),
  onResize: (cols, rows) => console.log(`Resized: ${cols}x${rows}`)
});
```

## Session Management

### Command History

```typescript
// Get all executed commands
const history = terminal.getCommandHistory();
history.forEach(cmd => {
  console.log(`${cmd.timestamp}: ${cmd.command} (${cmd.completed ? 'completed' : 'pending'})`);
});

// Get the last executed command
const lastCommand = terminal.getLastCommand();
if (lastCommand) {
  console.log(`Last command: ${lastCommand.command}`);
  console.log(`Output: ${lastCommand.output}`);
}
```

### Session Information

```typescript
const session = terminal.getSession();
console.log(`Session ID: ${session.id}`);
console.log(`Started: ${session.startTime}`);
console.log(`Active: ${session.isActive}`);
console.log(`Commands executed: ${session.commands.length}`);
```

### Output Management

```typescript
// Get all output
const allOutput = terminal.getOutput();

// Get output since a specific time
const timestamp = new Date(Date.now() - 60000); // Last minute
const recentOutput = terminal.getOutputSince(timestamp);
```

## Error Handling

### Common Error Scenarios

```typescript
try {
  await terminal.start();
} catch (error) {
  if (error.message.includes('node-pty is not available')) {
    console.error('Please install node-pty: npm install node-pty');
  } else {
    console.error('Failed to start terminal:', error);
  }
}

try {
  const result = await terminal.execute('some-command');
} catch (error) {
  if (error.message.includes('Command timeout')) {
    console.error('Command took too long to execute');
  } else if (error.message.includes('Terminal is not running')) {
    console.error('Terminal process has stopped');
  } else {
    console.error('Command execution failed:', error);
  }
}
```

### Global Cleanup

```typescript
import { destroyAllTerminals } from 'hasyx/lib/terminal';

// Clean up all terminal instances
process.on('exit', () => {
  destroyAllTerminals();
});

process.on('SIGINT', () => {
  destroyAllTerminals();
  process.exit();
});
```

## Best Practices

### Resource Management

1. **Always call `destroy()`** when done with a terminal:

```typescript
const terminal = new Terminal();
try {
  // Use the terminal
  await terminal.execute('some-command');
} finally {
  terminal.destroy();
}
```

2. **Use the global cleanup function** for application-wide cleanup:

```typescript
import { destroyAllTerminals } from 'hasyx/lib/terminal';

process.on('exit', destroyAllTerminals);
```

### Error Handling

1. **Handle startup errors gracefully**:

```typescript
const terminal = new Terminal({ autoStart: false });

try {
  await terminal.start();
} catch (error) {
  console.error('Failed to start terminal:', error);
  return;
}
```

2. **Set reasonable timeouts** for long-running commands:

```typescript
// The library has a built-in 5-second timeout for commands
// For longer operations, consider breaking them down or using different approaches
```

### Performance

1. **Reuse terminal instances** when possible:

```typescript
const terminal = new Terminal();

// Execute multiple commands on the same terminal
const results = await Promise.all([
  terminal.execute('command1'),
  terminal.execute('command2'),
  terminal.execute('command3')
]);
```

2. **Use appropriate terminal size** for your use case:

```typescript
// Smaller terminals for simple command execution
const lightTerminal = new Terminal({ cols: 40, rows: 10 });

// Larger terminals for interactive sessions
const fullTerminal = new Terminal({ cols: 120, rows: 40 });
```

## Examples

### Basic Command Execution

```typescript
import { Terminal } from 'hasyx/lib/terminal';

async function runCommands() {
  const terminal = new Terminal();
  
  try {
    // Simple command
    const pwd = await terminal.execute('pwd');
    console.log('Current directory:', pwd);
    
    // Command with output
    const files = await terminal.execute('ls -la');
    console.log('Files:\n', files);
    
    // Command composition
    await terminal.execute('mkdir test-dir');
    await terminal.execute('cd test-dir');
    const newPwd = await terminal.execute('pwd');
    console.log('New directory:', newPwd);
  } finally {
    terminal.destroy();
  }
}
```

### Interactive Shell Session

```typescript
import { createBashTerminal } from 'hasyx/lib/terminal';

async function interactiveSession() {
  const terminal = createBashTerminal();
  
  // Set up event handlers
  terminal.on('data', (data) => {
    process.stdout.write(data);
  });
  
  try {
    await terminal.start();
    
    // Execute a series of commands
    await terminal.execute('echo "Starting session"');
    await terminal.execute('export MY_VAR="test"');
    await terminal.execute('echo "Variable value: $MY_VAR"');
    
    // Interactive command (note: this might not work well with execute())
    terminal.write('read -p "Enter your name: " name\n');
    terminal.write('John\n');
    await terminal.execute('echo "Hello $name"');
  } finally {
    terminal.destroy();
  }
}
```

### Development Environment Setup

```typescript
import { createNodeTerminal, createPythonTerminal } from 'hasyx/lib/terminal';

async function setupDevEnvironment() {
  const nodeRepl = createNodeTerminal();
  const pythonRepl = createPythonTerminal();
  
  try {
    // Test Node.js environment
    const nodeVersion = await nodeRepl.execute('process.version');
    console.log('Node.js version:', nodeVersion);
    
    // Test Python environment
    const pythonVersion = await pythonRepl.execute('import sys; print(sys.version)');
    console.log('Python version:', pythonVersion);
    
    // Execute some code
    const mathResult = await nodeRepl.execute('Math.sqrt(16)');
    console.log('Math result:', mathResult);
    
  } finally {
    nodeRepl.destroy();
    pythonRepl.destroy();
  }
}
```

### File Operations

```typescript
import { Terminal } from 'hasyx/lib/terminal';

async function fileOperations() {
  const terminal = new Terminal();
  
  try {
    // Create and manipulate files
    await terminal.execute('echo "Hello World" > test.txt');
    const content = await terminal.execute('cat test.txt');
    console.log('File content:', content);
    
    // File permissions
    await terminal.execute('chmod 755 test.txt');
    const permissions = await terminal.execute('ls -l test.txt');
    console.log('Permissions:', permissions);
    
    // Cleanup
    await terminal.execute('rm test.txt');
  } finally {
    terminal.destroy();
  }
}
```

### Process Management

```typescript
import { Terminal } from 'hasyx/lib/terminal';

async function processManagement() {
  const terminal = new Terminal();
  
  try {
    // List processes
    const processes = await terminal.execute('ps aux | head -10');
    console.log('Running processes:\n', processes);
    
    // System information
    const memory = await terminal.execute('free -h');
    console.log('Memory usage:\n', memory);
    
    const disk = await terminal.execute('df -h');
    console.log('Disk usage:\n', disk);
  } finally {
    terminal.destroy();
  }
}
```

## Testing

The Terminal library includes comprehensive tests that cover all functionality:

```bash
# Run tests
npm test -- lib/terminal.test.ts

# Run with debug output
DEBUG="hasyx:terminal" npm test -- lib/terminal.test.ts
```

### Test Categories

1. **Environment Detection** - Platform-specific shell detection
2. **Terminal Creation and Configuration** - Option handling and validation
3. **Terminal Lifecycle** - Start, stop, auto-start scenarios
4. **Command Execution** - Command queuing and execution
5. **Input/Output Operations** - Data writing and key press handling
6. **Terminal Control** - Resize, clear, pause/resume operations
7. **Event Handling** - Event emission and handler management
8. **Session Management** - History and session tracking
9. **Error Handling** - Graceful error management
10. **Factory Functions** - Pre-configured terminal creation
11. **Edge Cases and Robustness** - Stress testing and edge scenarios
12. **Global Registry** - Resource management and cleanup

### Test Design Principles

- **No mocks for core functionality** - Tests use real terminal processes when possible
- **Complete isolation** - Each test creates and cleans up its own resources
- **Real error conditions** - Tests actual failure scenarios
- **Cross-platform compatibility** - Tests work on different operating systems

## Dependencies

- **node-pty**: Required for actual terminal process spawning
- **events**: Built-in Node.js EventEmitter
- **os**: Built-in Node.js operating system utilities
- **path**: Built-in Node.js path utilities

## Platform Support

- **Linux**: Full support with bash, zsh, fish, etc.
- **macOS**: Full support with native shells
- **Windows**: Support for PowerShell and Command Prompt

## Security Considerations

1. **Command Injection**: Always validate and sanitize user input before executing commands
2. **Environment Variables**: Be careful with sensitive data in environment variables
3. **Process Privileges**: Terminals run with the same privileges as the Node.js process
4. **Resource Limits**: Monitor and limit the number of concurrent terminal instances

## Contributing

When contributing to the Terminal library:

1. **Follow the test patterns** established in `terminal.test.ts`
2. **Ensure cross-platform compatibility**
3. **Add comprehensive error handling**
4. **Update documentation** for new features
5. **Test with and without node-pty** to ensure graceful degradation

## License

This library is part of the Hasyx project and follows the same licensing terms. 