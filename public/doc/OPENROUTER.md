# OpenRouter

OpenRouter Integration

The OpenRouter module provides a powerful interface for interacting with AI models through the OpenRouter API, combined with JavaScript code execution capabilities. This integration allows you to create AI-powered applications that can execute code, maintain context, and interact with various AI models.

## Features

- **Multiple AI Models**: Access to various AI models through OpenRouter API
- **Code Execution**: Built-in JavaScript execution with persistent context
- **Conversation Management**: Helper methods for creating and managing conversations
- **Context Persistence**: Maintain variables and state across interactions
- **Error Handling**: Robust error handling for both API calls and code execution
- **TypeScript Support**: Full TypeScript definitions for type safety

## Installation

OpenRouter is included with Hasyx. No additional installation required.

```typescript
import { OpenRouter } from 'hasyx';
```

## Environment Variables

Set your OpenRouter API key in your `.env` file:

```env
# OpenRouter API Configuration
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

You can get an API key from [OpenRouter](https://openrouter.ai/).

## Basic Usage

### Creating an OpenRouter Instance

```typescript
import { OpenRouter } from 'hasyx';

// Basic initialization
const openrouter = new OpenRouter(process.env.OPENROUTER_API_KEY!);

// With custom context and options
const openrouter = new OpenRouter(
  process.env.OPENROUTER_API_KEY!,
  { initialVar: 'value' }, // Initial execution context
  { 
    model: 'anthropic/claude-3-haiku',
    temperature: 0.7,
    max_tokens: 2048
  }
);
```

### Simple AI Conversations

```typescript
// Send a simple string message
const response = await openrouter.ask('Hello, how are you?');
console.log(response);

// Send a message object
const message = OpenRouter.userMessage('What is the capital of France?');
const response = await openrouter.ask(message);

// Send multiple messages
const conversation = [
  OpenRouter.systemMessage('You are a helpful math tutor.'),
  OpenRouter.userMessage('What is 15 * 23?')
];
const response = await openrouter.ask(conversation);
```

### AI with Code Execution

The `askWithExec` method allows the AI to execute JavaScript code and use the results in its responses:

```typescript
const result = await openrouter.askWithExec(
  'Calculate the factorial of 5 and explain the result'
);

console.log(result.response); // AI's response including explanation
console.log(result.execResults); // Results of any executed code
```

The AI can execute code by including special code blocks in its response:

```javascript
// The AI might respond with:
// "I'll calculate the factorial of 5:
// 
// ```js
// // exec:factorial
// function factorial(n) {
//   if (n <= 1) return 1;
//   return n * factorial(n - 1);
// }
// 
// const result = factorial(5);
// console.log(`5! = ${result}`);
// result;
// ```
// 
// The factorial of 5 is 120..."
```

## Configuration Options

### OpenRouterOptions

```typescript
interface OpenRouterOptions {
  model?: string;                    // AI model to use
  temperature?: number;              // Randomness (0-1)
  max_tokens?: number;              // Maximum response length
  top_p?: number;                   // Nucleus sampling
  top_k?: number;                   // Top-k sampling
  frequency_penalty?: number;       // Frequency penalty
  presence_penalty?: number;        // Presence penalty
  stream?: boolean;                 // Stream response (not implemented)
  tools?: OpenRouterTool[];         // Function calling tools
  tool_choice?: 'none' | 'auto' | { type: 'function'; function: { name: string } };
  response_format?: { type: 'json_object' };
  user?: string;                    // User identifier
  timeout?: number;                 // Request timeout in ms
}
```

### Default Configuration

```typescript
{
  model: 'google/gemini-2.5-flash-preview',
  temperature: 0.7,
  max_tokens: 4096,
  timeout: 30000
}
```

## Context Management

The OpenRouter instance maintains an execution context that persists across code executions:

```typescript
const openrouter = new OpenRouter(process.env.OPENROUTER_API_KEY!);

// Set initial context
openrouter.updateContext({ 
  apiKey: 'secret-key',
  baseUrl: 'https://api.example.com'
});

// Execute code that uses the context
const result = await openrouter.exec(`
  const response = await fetch(baseUrl + '/users', {
    headers: { 'Authorization': 'Bearer ' + apiKey }
  });
  return response.status;
`);

// Get current context
const context = openrouter.getContext();

// Clear context
openrouter.clearContext();
```

## Message Creation Helpers

OpenRouter provides static methods for creating properly formatted messages:

```typescript
// Create different types of messages
const systemMsg = OpenRouter.systemMessage('You are a helpful assistant');
const userMsg = OpenRouter.userMessage('Hello!');
const assistantMsg = OpenRouter.assistantMessage('Hi there!');
const toolMsg = OpenRouter.toolMessage('Result: 42', 'call_123', 'calculate');

// Create a conversation from mixed inputs
const conversation = OpenRouter.conversation(
  'Hello',                                    // String -> user message
  OpenRouter.systemMessage('Be helpful'),     // System message
  'How are you?'                             // String -> user message
);
```

## Advanced Usage

### Custom Model Configuration

```typescript
const openrouter = new OpenRouter(
  process.env.OPENROUTER_API_KEY!,
  {},
  {
    model: 'anthropic/claude-3-opus',
    temperature: 0.3,
    max_tokens: 1000,
    top_p: 0.9
  }
);
```

### Persistent Context Across Conversations

```typescript
const openrouter = new OpenRouter(process.env.OPENROUTER_API_KEY!);

// First interaction - set up data
await openrouter.askWithExec(`
  Create a user database with some sample data and store it in a variable called 'users'
`);

// Later interaction - use the data
const result = await openrouter.askWithExec(`
  Find all users older than 25 from the users database we created earlier
`);
```

### Error Handling

```typescript
try {
  const response = await openrouter.ask('Hello');
  console.log(response);
} catch (error) {
  if (error.message.includes('HTTP 401')) {
    console.error('Invalid API key');
  } else if (error.message.includes('HTTP 429')) {
    console.error('Rate limit exceeded');
  } else {
    console.error('API error:', error.message);
  }
}

// Handle code execution errors
try {
  const result = await openrouter.exec('invalid.syntax.here');
} catch (error) {
  console.error('Code execution error:', error.message);
}
```

## Available Models

OpenRouter provides access to many AI models. Some popular options:

- `google/gemini-2.5-flash-preview` (default, low cost)
- `google/gemini-2.5-pro-preview` (premium, high capability)
- `anthropic/claude-3-opus`
- `anthropic/claude-3-sonnet`
- `anthropic/claude-3-haiku`
- `openai/gpt-4`
- `openai/gpt-3.5-turbo`
- `meta-llama/llama-3.1-8b-instruct:free`

Check the [OpenRouter documentation](https://openrouter.ai/docs) for the complete list of available models and their capabilities.

## Integration with Hasyx

### Using with Hasyx Client

```typescript
import { OpenRouter, useClient } from 'hasyx';

function MyComponent() {
  const client = useClient(); // Hasyx database client
  
  const handleAIQuery = async () => {
    const openrouter = new OpenRouter(process.env.OPENROUTER_API_KEY!);
    
    // Give AI access to database client
    openrouter.updateContext({ client });
    
    const result = await openrouter.askWithExec(`
      Query the users table and find the most recently created user.
      Use the client.select method to fetch the data.
    `);
    
    console.log(result.response);
  };
  
  return <button onClick={handleAIQuery}>Ask AI about users</button>;
}
```

### Using with Exec Engine

```typescript
import { OpenRouter, Exec } from 'hasyx';

const openrouter = new OpenRouter(process.env.OPENROUTER_API_KEY!);
const exec = new Exec();

// Share context between OpenRouter and standalone Exec
const sharedContext = { data: [1, 2, 3, 4, 5] };
openrouter.updateContext(sharedContext);
exec.updateContext(sharedContext);

// Both can now access the shared data
const aiResult = await openrouter.askWithExec('Calculate the average of the data array');
const directResult = await exec.exec('data.reduce((a, b) => a + b) / data.length');
```

## Best Practices

### 1. API Key Security

```typescript
// ✅ Good: Use environment variables
const openrouter = new OpenRouter(process.env.OPENROUTER_API_KEY!);

// ❌ Bad: Hardcode API keys
const openrouter = new OpenRouter('sk-or-v1-...');
```

### 2. Error Handling

```typescript
// ✅ Good: Handle different error types
try {
  const response = await openrouter.ask(message);
} catch (error) {
  if (error.message.includes('OpenRouter API error')) {
    // Handle API errors
  } else if (error.message.includes('Code execution error')) {
    // Handle execution errors
  }
}
```

### 3. Context Management

```typescript
// ✅ Good: Clear sensitive data from context
openrouter.updateContext({ apiKey: 'secret' });
// ... use the context
openrouter.clearContext(); // Clear when done

// ✅ Good: Use context extension for temporary data
const result = await openrouter.exec(code, { tempVar: 'value' });
```

### 4. Model Selection

```typescript
// ✅ Good: Choose appropriate model for task
const fastModel = new OpenRouter(apiKey, {}, { 
  model: 'anthropic/claude-3-haiku' // Fast, cheaper
});

const powerfulModel = new OpenRouter(apiKey, {}, { 
  model: 'anthropic/claude-3-opus' // More capable, expensive
});
```

## Troubleshooting

### Common Issues

1. **"OpenRouter API token is required"**
   - Ensure `OPENROUTER_API_KEY` is set in your environment
   - Check that the API key is valid and not expired

2. **"HTTP 401: Unauthorized"**
   - Verify your API key is correct
   - Check if your account has sufficient credits

3. **"HTTP 429: Too Many Requests"**
   - You've hit the rate limit
   - Implement retry logic with exponential backoff

4. **Code execution errors**
   - Check JavaScript syntax in executed code
   - Ensure required variables are in context
   - Use try-catch blocks in executed code

### Debug Mode

Enable debug logging to troubleshoot issues:

```typescript
const openrouter = new OpenRouter(process.env.OPENROUTER_API_KEY!);

// Code execution will log details to console
const result = await openrouter.askWithExec('Calculate 2 + 2');
// Output:
// 🧪 Executing code block [unique-id]:
// 2 + 2
// 📌 Result [unique-id]: 4
```

## Examples

### Example 1: Data Analysis Assistant

```typescript
const openrouter = new OpenRouter(process.env.OPENROUTER_API_KEY!);

const data = [
  { name: 'Alice', age: 30, salary: 50000 },
  { name: 'Bob', age: 25, salary: 45000 },
  { name: 'Charlie', age: 35, salary: 60000 }
];

openrouter.updateContext({ data });

const result = await openrouter.askWithExec(`
  Analyze the employee data and provide insights about age and salary distribution.
  Calculate average age, average salary, and identify any patterns.
`);

console.log(result.response);
```

### Example 2: API Integration Helper

```typescript
const openrouter = new OpenRouter(process.env.OPENROUTER_API_KEY!);

openrouter.updateContext({
  fetch: fetch, // Make fetch available in execution context
  apiKey: process.env.EXTERNAL_API_KEY
});

const result = await openrouter.askWithExec(`
  Fetch weather data for New York City from a weather API and format it nicely.
  Use the apiKey from context for authentication.
`);
```

### Example 3: Code Generation and Testing

```typescript
const openrouter = new OpenRouter(process.env.OPENROUTER_API_KEY!);

const result = await openrouter.askWithExec(`
  Generate a function to validate email addresses using regex.
  Then test it with a few example emails to make sure it works correctly.
`);

console.log(result.response); // Will include generated function and test results
```

## API Reference

### Class: OpenRouter

#### Constructor

```typescript
constructor(
  token: string,
  context?: ExecContext,
  options?: OpenRouterOptions
)
```

#### Methods

- `ask(messages, options?)` - Send messages to AI
- `exec(code, contextExtend?)` - Execute JavaScript code
- `askWithExec(message, options?)` - AI conversation with code execution
- `updateContext(updates)` - Update execution context
- `getContext()` - Get current context
- `clearContext()` - Clear execution context

#### Static Methods

- `systemMessage(content)` - Create system message
- `userMessage(content)` - Create user message
- `assistantMessage(content)` - Create assistant message
- `toolMessage(content, toolCallId, name?)` - Create tool message
- `conversation(...messages)` - Create conversation from mixed inputs

For more details on the Exec engine used internally, see [EXEC.md](EXEC.md). 