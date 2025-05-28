# AI Class Documentation

The `AI` class provides an intelligent assistant with code execution capabilities. It can execute JavaScript and TypeScript code automatically and provide iterative responses.

## Features

- **Code Execution**: Automatically executes JavaScript and TypeScript code blocks
- **Iterative Responses**: Can continue generating responses and executing additional code
- **Memory Management**: Maintains conversation history and context
- **Observable Streaming**: Supports streaming responses via RxJS Observables
- **Custom Handlers**: Allows custom Do operation handlers
- **Error Handling**: Gracefully handles execution errors and continues reasoning

## Installation

```bash
npm install hasyx
```

## Basic Usage

```typescript
import { AI } from 'hasyx/lib/ai';

// Create AI instance with system prompt
const ai = new AI(
  'your-openrouter-api-key',
  {},
  {
    model: 'deepseek/deepseek-chat-v3-0324:free',
    temperature: 0.7,
    max_tokens: 4096
  },
  'You are a helpful AI assistant with code execution capabilities.'
);

// Ask a question
const response = await ai.ask('Calculate 5 * 7 using JavaScript');
console.log(response);
```

## Real-time Progress Callbacks

The AI class provides callbacks to monitor execution progress in real-time:

```typescript
import { AI } from 'hasyx/lib/ai';

const ai = new AI('your-api-key', {}, { model: 'deepseek/deepseek-chat-v3-0324:free' });

// Set up progress callbacks
ai._onThinking = () => {
  console.log('🧠 AI is thinking...');
};

ai._onCodeFound = (code: string, format: 'js' | 'tsx') => {
  console.log(`📋 Found ${format.toUpperCase()} code to execute:`);
  console.log(`\`\`\`${format}\n${code}\n\`\`\``);
};

ai._onCodeExecuting = (code: string, format: 'js' | 'tsx') => {
  console.log(`⚡ Executing ${format.toUpperCase()} code...`);
};

ai._onCodeResult = (result: string) => {
  console.log(`✅ Execution result:\n${result}`);
};

ai._onResponse = (response: string) => {
  console.log(`💭 AI responded (${response.length} characters)`);
};

// Now when you call ai.ask(), you'll see real-time progress
const result = await ai.ask('Calculate 2 + 2 using JavaScript');
```

### Available Callbacks

- **`_onThinking()`**: Called when AI starts generating a response
- **`_onCodeFound(code, format)`**: Called when executable code is found in AI response
- **`_onCodeExecuting(code, format)`**: Called just before code execution starts
- **`_onCodeResult(result)`**: Called when code execution completes (success or error)
- **`_onResponse(response)`**: Called when AI response is received

### Command Line Interface

The `hasyx ask` command now includes real-time progress indicators by default:

**For external projects:**
```bash
npx hasyx ask -e "Calculate factorial of 5"
```

**For development inside hasyx project:**
```bash
npm run cli -- ask -e "Calculate factorial of 5"
```

**For projects with npm script integration:**
```bash
npm run ask -- -e "Calculate factorial of 5"
```

Output:
```
🧠 AI думает...
💭 AI ответил (150 символов)
📋 Найден JS код для выполнения:
```js
function factorial(n) {
  return n <= 1 ? 1 : n * factorial(n - 1);
}
factorial(5);
```
⚡ Выполняется JS код...
✅ Результат выполнения:
120
```

## Code Execution

The AI can automatically execute code when it writes special Do operations:

```typescript
// AI will automatically execute this code and include results
const response = await ai.ask('Calculate the factorial of 5 using JavaScript');

// Response will include both the explanation and execution results:
// "I'll calculate the factorial of 5:
// 
// **Code Executed:**
// ```js
// function factorial(n) {
//   return n <= 1 ? 1 : n * factorial(n - 1);
// }
// factorial(5);
// ```
// 
// **Result:**
// ```
// 120
// ```
// 
// The factorial of 5 is 120."
```

## Do Operations Format

The AI uses special syntax for code execution:

```
> 🪬<uuid>/do/exec/js
```js
your javascript code here
```

> 🪬<uuid>/do/exec/tsx
```tsx
your typescript code here
```
```

These operations are:
- Automatically detected and executed
- Removed from the final user-visible response
- Results are formatted and included separately

## API Reference

### Constructor

```typescript
new AI(token: string, context?: any, options?: OpenRouterOptions, systemPrompt?: string)
```

- `token`: OpenRouter API key
- `context`: Optional context object passed to execution engines
- `options`: OpenRouter configuration options
- `systemPrompt`: Optional system prompt for AI behavior (can also be set via setSystemPrompt method)

### Methods

#### `ask(question)`

```typescript
async ask(question: string | OpenRouterMessage | OpenRouterMessage[]): Promise<string>
```

Ask the AI a question and get a complete response with code execution.

**Parameters:**
- `question`: Question as string or OpenRouter message(s)

**Returns:** Complete response with execution results

**Example:**
```typescript
const response = await ai.ask('Create a TypeScript interface for a User and create an example');
```

#### `asking(question)`

```typescript
asking(question: string | OpenRouterMessage | OpenRouterMessage[]): Observable<string>
```

Stream AI responses as an Observable.

**Parameters:**
- `question`: Question as string or OpenRouter message(s)

**Returns:** Observable that emits the complete response

**Example:**
```typescript
ai.asking('Explain async/await in JavaScript')
  .subscribe(response => console.log(response));
```

#### `findDos(message)`

```typescript
findDos(message: string): Do[]
```

Find all Do operations in a message.

#### `do(doItem)`

```typescript
async do(doItem: Do): Promise<Do>
```

Execute a single Do operation.

#### Memory Management

```typescript
// Clear conversation memory
ai.clearMemory();

// Get current memory
const memory = ai.getMemory();

// Set memory callback
ai._onMemory = (message) => {
  console.log('New message:', message);
};
```

### Properties

#### `doSpecialSubstring`

```typescript
public doSpecialSubstring = '> 🪬';
```

The special substring that identifies Do operations.

#### `memory`

```typescript
public memory: (OpenRouterMessage | Do)[] = [];
```

Conversation history and executed operations.

#### `_do`

```typescript
public _do?: (doItem: Do) => Promise<Do>;
```

Custom Do operation handler. If set, this function will be called instead of the default execution engines.

**Example:**
```typescript
ai._do = async (doItem) => {
  // Custom execution logic
  const result = await myCustomExecutor(doItem.request);
  return {
    ...doItem,
    response: result,
    content: `Custom execution: ${result}`
  };
};
```

#### `_onMemory`

```typescript
public _onMemory?: (message: OpenRouterMessage | Do) => void;
```

Callback called whenever a message is added to memory.

## Advanced Usage

### Iterative Code Execution

The AI can execute multiple code blocks and continue reasoning:

```typescript
const response = await ai.ask(`
  Try to get system information. 
  First try browser APIs, then Node.js APIs if that fails.
`);

// AI will:
// 1. Try navigator.platform (fails in Node.js)
// 2. See the error and try process.platform
// 3. Get the result and provide a complete answer
```

### Custom Context

```typescript
const ai = new AI(token, {
  customVariable: 'available in execution context',
  helpers: {
    formatDate: (date) => date.toISOString()
  }
});
```

### Memory Management

```typescript
// Set up memory persistence
ai._onMemory = (message) => {
  // Save to database or file
  saveToStorage(message);
};

// Load previous conversation
const previousMessages = loadFromStorage();
previousMessages.forEach(msg => ai.memory.push(msg));
```

## Error Handling

The AI gracefully handles execution errors and continues reasoning:

```typescript
const response = await ai.ask('Use navigator.userAgent to get browser info');

// In Node.js environment:
// 1. AI tries navigator.userAgent
// 2. Gets "navigator is not defined" error
// 3. Continues reasoning and tries Node.js alternatives
// 4. Provides complete answer with working solution
```

## Debugging

To see debug information, set the DEBUG environment variable:

```bash
# For hasyx projects
DEBUG="hasyx*" npm run your-command

# For child projects
DEBUG="<packagename>*" npm run your-command
```

Debug output includes:
- AI iteration steps
- Do operation detection and execution
- Memory management
- Error handling

## Integration Examples

### Express.js API

```typescript
import express from 'express';
import { AI } from 'hasyx/lib/ai';

const app = express();
const ai = new AI(process.env.OPENROUTER_API_KEY);

app.post('/ask', async (req, res) => {
  try {
    const response = await ai.ask(req.body.question);
    res.json({ response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### React Component

```tsx
import { useState } from 'react';
import { AI } from 'hasyx/lib/ai';

function AIChat() {
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  
  const ai = new AI(process.env.REACT_APP_OPENROUTER_API_KEY);
  
  const handleAsk = async (question: string) => {
    setLoading(true);
    try {
      const result = await ai.ask(question);
      setResponse(result);
    } catch (error) {
      setResponse(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      <button onClick={() => handleAsk('Calculate 10!')}>
        Calculate 10!
      </button>
      {loading ? 'Thinking...' : <pre>{response}</pre>}
    </div>
  );
}
```

### Streaming Responses

```typescript
import { AI } from 'hasyx/lib/ai';

const ai = new AI(process.env.OPENROUTER_API_KEY);

// Stream response with real-time updates
ai.asking('Explain machine learning concepts')
  .subscribe({
    next: (response) => {
      console.log('Complete response:', response);
      // Update UI with complete response
    },
    error: (error) => {
      console.error('Error:', error);
    },
    complete: () => {
      console.log('Response complete');
    }
  });
```

## Best Practices

1. **API Key Security**: Never expose API keys in client-side code
2. **Error Handling**: Always wrap AI calls in try-catch blocks
3. **Memory Management**: Clear memory periodically for long-running applications
4. **Rate Limiting**: Implement rate limiting for production APIs
5. **Context Size**: Monitor context size to avoid token limits
6. **Custom Handlers**: Use custom Do handlers for specialized execution environments

## Troubleshooting

### Common Issues

1. **"OPENROUTER_API_KEY is required"**
   - Set the environment variable or pass the key to constructor

2. **Code execution fails**
   - Check if the execution engines (exec, exec-tsx) are properly installed
   - Verify the code syntax is correct

3. **Memory grows too large**
   - Call `ai.clearMemory()` periodically
   - Implement custom memory management with `_onMemory`

4. **Responses are incomplete**
   - Increase `max_tokens` in options
   - Check for API rate limits

### Debug Information

Enable debug logging to see internal operations:

```bash
DEBUG="hasyx:ai" node your-script.js
```

This will show:
- AI iteration steps
- Do operation detection
- Code execution results
- Memory operations
- Error details 