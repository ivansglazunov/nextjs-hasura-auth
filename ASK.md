# Ask AI

Ask AI assistant via command line with code execution capabilities.

## Quick Start

### Get Help

```bash
# Show all available options
npm run ask -- --help
npx tsx ./lib/ask.ts --help

# Alternative command format
npx hasyx ask --help  # (if hasyx package is globally installed)
```

### Basic Usage

```bash
# Interactive mode (default)
npm run ask

# Direct question  
npm run ask -- "What is 2+2?"

# Specify provider and model
npm run ask -- --provider openrouter --model google/gemini-2.5-flash-preview "Explain recursion"
npm run ask -- --provider ollama --model gemma2:2b "Write a Python function"
```

### List Available Models

You can list all available models for different AI providers:

```bash
# List available Ollama models (local models)
npm run ask -- --provider ollama --models
npx tsx ./lib/ask.ts --provider ollama --models

# List available OpenRouter models (free models only)
npm run ask -- --provider openrouter --models
npx tsx ./lib/ask.ts --provider openrouter --models
```

## Provider Support

The Ask command supports multiple AI providers:

**Ollama (Local Models)**
- All locally installed models are available and free
- Requires Ollama service running on localhost:11434
- Models must be downloaded using `ollama pull model_name`
- Example models: `gemma2:2b`, `llama3.2:1b`, `phi3:mini`

**OpenRouter (Cloud Models)**
- Only free models are listed (where prompt, completion, and request costs are $0)
- Requires `OPENROUTER_API_KEY` environment variable
- Wide variety of models from different providers
- Examples: `google/gemini-2.5-flash-preview`, `mistralai/mistral-7b-instruct:free`

### Using availableModels in Code

You can also import and use the `availableModels` function programmatically:

```javascript
import { availableModels } from './lib/available-models';

// Get Ollama models
const ollamaModels = await availableModels({ provider: 'ollama' });
console.log('Ollama models:', ollamaModels);

// Get OpenRouter free models (requires token)
const openrouterModels = await availableModels({ 
  provider: 'openrouter', 
  token: process.env.OPENROUTER_API_KEY 
});
console.log('OpenRouter free models:', openrouterModels);
```

The function returns an array of `AIModel` objects with the following structure:

```typescript
interface AIModel {
  id: string;         // Model identifier
  name: string;       // Human-readable name
  provider: string;   // Provider name ('ollama' or 'openrouter')
  free?: boolean;     // Whether the model is free
  context_length?: number;    // Maximum context length
  description?: string;       // Model description
}
```

## Code Execution

Ask AI can execute JavaScript, TypeScript, and terminal commands automatically when needed.

### Execution Engines

- **JavaScript**: Execute JS code snippets for calculations, demonstrations
- **TypeScript**: Execute TS code with full type checking
- **Terminal**: Execute bash commands for system operations

### Code Execution Format

AI responses preserve the original format to maintain code execution commands. When AI needs to execute code, it uses special markers:

```
> 😈uuid/do/exec/js
```js
2 + 2
```

> 😈uuid/do/exec/tsx  
```tsx
interface User { name: string }
const user: User = { name: "John" }
console.log(user)
```

> 😈uuid/do/terminal/bash
```bash
echo "Current time: $(date)"
```
```

**Important**: The Ask command no longer applies "beautiful" formatting to preserve these execution markers.

## Interactive Mode

Start interactive mode for ongoing conversations:

```bash
npm run ask
```

Features:
- Persistent conversation memory within session
- Streaming responses for real-time feedback  
- Code execution results shown inline
- Use Ctrl+C to exit

Example session:
```
🤖 Ask AI anything. Type your question and press Enter. Use Ctrl+C to exit.
💡 AI responses will be shown as-is to preserve code execution format!
😈 AI can execute code automatically! Enabled engines: JavaScript, TypeScript, Terminal
> What's the current time?
🧠 AI думает...

I'll help you get the current time using a terminal command.

> 😈time-123e4567-e89b-12d3-a456-426614174000/do/terminal/bash
```bash
date
```

**Результат выполнения:**
```
Mon Jan 13 10:30:45 UTC 2025
```

The current time is Monday, January 13th, 2025 at 10:30:45 UTC.

💭 Ответ завершен
> 
```

## Features

- **🚀 Real-time Streaming**: Genuine Server-Sent Events (SSE) streaming from OpenRouter API - text appears character by character
- **Direct Question Mode**: Ask single questions with immediate responses
- **Interactive Chat Mode**: Start a conversation session with the AI
- **Advanced AI Model**: Uses Google Gemini 2.5 Flash Preview via OpenRouter API
- **Multiple Question Types**: Supports coding, math, general knowledge, and more
- **🆕 Real-time Progress Indicators**: See exactly what AI is doing step-by-step with live updates
- **🆕 Automatic Code Execution**: AI can execute JavaScript, TypeScript, and terminal commands automatically
- **🆕 Iterative Responses**: AI can execute multiple code blocks and continue reasoning
- **⚡ Ultra-fast First Response**: First words appear in 0.5-2 seconds instead of 5-10 seconds

## 🎨 Beautiful Terminal Output

The Ask command now displays all responses with beautiful markdown formatting and syntax highlighting:

### Formatted Output Features

- **📝 Headers and Text**: Proper markdown rendering with colors
- **💻 Code Blocks**: Syntax highlighting for JavaScript, TypeScript, Bash, JSON, and more
- **📋 Lists and Bullets**: Clean bullet points and numbered lists
- **🔗 Links**: Formatted links with proper highlighting
- **⭐ Bold and Italic**: Rich text formatting support
- **📊 Tables**: Clean table rendering in terminal

### Example Formatted Output

```bash
$ npx hasyx ask -e "Show me a JavaScript function example"

# JavaScript Function Example

Here's a **simple function** that adds two numbers:

\`\`\`js
function addNumbers(a, b) {
  return a + b;
}

const result = addNumbers(5, 3);
console.log(result); // Output: 8
\`\`\`

This function:
• Takes two parameters
• Returns their sum  
• Can be used with any numbers
```

## 🎯 Real-time Progress Indicators

The Ask command now shows you exactly what's happening during AI processing:

### Progress Indicators

- **🧠 AI думает...** - When AI is generating a response
- **💭 AI ответил (N символов)** - When AI response is received with character count  
- **📋 Найден JS/TSX/TERMINAL код для выполнения** - When executable code is found with syntax highlighting
- **⚡ Выполняется JS/TSX/TERMINAL код...** - When code execution starts
- **✅ Результат выполнения** - When code execution completes with formatted results

### Example Output with Syntax Highlighting

```bash
$ npx hasyx ask -e "Calculate 5 factorial using JavaScript"

🧠 AI думает...
💭 AI ответил (245 символов)
📋 Найден JS код для выполнения:
    function factorial(n) {
      return n <= 1 ? 1 : n * factorial(n - 1);
    }
    factorial(5);

⚡ Выполняется JS код...
✅ Результат выполнения:
    120

# Calculation Result

The factorial of 5 is **120**. This recursive function calculates...
```

### Automatic Code Execution

The AI can automatically execute code and use the results to provide better answers:

```bash
$ npx hasyx ask -e "Check what operating system we're running on"

🧠 AI думает...
💭 AI ответил (156 символов)
📋 Найден JS код для выполнения:
\`\`\`js
process.platform
\`\`\`
⚡ Выполняется JS код...
✅ Результат выполнения:
darwin

🧠 AI думает...
💭 AI ответил (298 символов)

Based on the code execution, you're running on macOS (darwin). 
The system provides access to Node.js APIs like process.platform...
```

### Multi-iteration Processing

AI can execute multiple code blocks and continue reasoning:

1. **First iteration**: AI generates response with code
2. **Code execution**: Code is automatically executed
3. **Second iteration**: AI sees results and continues
4. **Additional iterations**: Up to 3 iterations for complex problems

This allows AI to:
- Try different approaches if first one fails
- Analyze results and provide better explanations  
- Execute multiple related code snippets
- Adapt responses based on execution outcomes

## Installation & Setup

### 1. Install Hasyx

The Ask command is included with Hasyx:

```bash
npm install hasyx
# or
yarn add hasyx
# or
pnpm add hasyx
```

### 2. Get OpenRouter API Key

1. Visit [OpenRouter](https://openrouter.ai/)
2. Sign up for a free account
3. Get your API key from the dashboard
4. The free tier includes access to DeepSeek models

### 3. Configure Environment

Add your OpenRouter API key to your `.env` file in your project directory:

```env
# Required for AI features (ask command, OpenRouter integration)
OPENROUTER_API_KEY=sk-or-v1-your_openrouter_api_key_here
```

**🔧 Environment File Loading Behavior**

The Ask command loads `.env` files from your **current working directory** (where you run the command), not from the Hasyx package directory. This means:

- ✅ **When using `npx hasyx ask` from project `deep7`**: Loads `.env` from `deep7/.env`
- ✅ **When using `npm run ask` inside any project**: Loads `.env` from that project's root
- ✅ **Perfect for child projects**: Use Hasyx codebase but your project's environment

**Example Usage in Child Projects:**
```bash
# In your project directory (e.g., deep7/)
# This will use Hasyx code but load YOUR .env file
npx hasyx ask -e "What's my current environment?"

# Your .env file (deep7/.env) will be loaded, not hasyx/.env
```

This ensures that when you use Hasyx tools from external projects, your project's specific configuration (API keys, database URLs, etc.) is respected.

## Usage

### Direct Question Mode

Ask a single question and get an immediate response:

```bash
# Primary usage via npx hasyx
npx hasyx ask -e "What is the capital of France?"
npx hasyx ask --eval "Write a JavaScript function to add two numbers"

# Alternative for development inside hasyx project
npm run cli -- ask -e "What is the capital of France?"
npm run cli -- ask --eval "Write a JavaScript function to add two numbers"

# For projects with hasyx integration (npm scripts)
npm run ask -- -e "What is the capital of France?"
npm run ask -- --eval "Write a JavaScript function to add two numbers"
```

### Interactive Chat Mode

Start an interactive conversation session:

```bash
# Primary usage via npx hasyx
npx hasyx ask

# Alternative for development inside hasyx project
npm run cli -- ask

# For projects with hasyx integration (npm scripts)
npm run ask
```

In interactive mode:
- Type your questions and press Enter
- Use Ctrl+C to exit
- Empty input is ignored
- Each question is processed independently

## Examples

### Coding Questions

```bash
# React component
npx hasyx ask -e "Write a React component for a todo list with add and delete functionality"

# JavaScript functions
npx hasyx ask -e "Create a function that debounces another function"

# TypeScript interfaces
npx hasyx ask -e "Design TypeScript interfaces for a user management system"

# Algorithm help
npx hasyx ask -e "Explain how to implement a binary search algorithm"
```

### Math and Calculations

```bash
# Simple math
npx hasyx ask -e "What is 15 * 27?"

# Complex calculations
npx hasyx ask -e "Calculate the compound interest for $1000 at 5% annually for 10 years"

# Mathematical concepts
npx hasyx ask -e "Explain the difference between mean, median, and mode"
```

### General Knowledge

```bash
# Geography
npx hasyx ask -e "What are the capitals of all European countries?"

# Science
npx hasyx ask -e "Explain how photosynthesis works"

# Technology
npx hasyx ask -e "What is the difference between REST and GraphQL APIs?"
```

### Interactive Session Example with Real-time Streaming

```bash
$ npx hasyx ask

🤖 Ask AI anything. Type your question and press Enter. Use Ctrl+C to exit.
💡 Responses with code, formatting, or markdown will be beautifully rendered!
🚀 Real-time streaming enabled!
😈 AI can execute code automatically!

> What is TypeScript?

🧠 AI думает...
TypeScript is a strongly typed programming language that builds on JavaScript by adding static type definitions. It's developed by Microsoft and allows developers to catch errors early in development through its type system...

> How do I use async/await in JavaScript?

🧠 AI думает...
Async/await is a syntax that makes it easier to work with asynchronous code in JavaScript. Here's how it works:

```javascript
async function fetchData() {
  try {
    const response = await fetch('https://api.example.com/data');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error:', error);
  }
}
```

> Calculate factorial of 5 with code execution

🧠 AI думает...
I'll calculate the factorial of 5 using JavaScript:

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

The factorial of 5 is **120**. This means 5! = 5 × 4 × 3 × 2 × 1 = 120.

> ^C
👋 Goodbye!
```

## Available Models

### List Available Models

You can list all available models for different AI providers:

```bash
# List available Ollama models (local models)
npm run ask -- --provider ollama --models
npx tsx ./lib/ask.ts --provider ollama --models

# List available OpenRouter models (free models only)
npm run ask -- --provider openrouter --models
npx tsx ./lib/ask.ts --provider openrouter --models
```

### Provider Support

The Ask command now supports multiple AI providers:

**Ollama (Local Models)**
- All locally installed models are available and free
- Requires Ollama service running on localhost:11434
- Models must be downloaded using `ollama pull model_name`

**OpenRouter (Cloud Models)**
- Only free models are listed (where prompt, completion, and request costs are $0)
- Requires `OPENROUTER_API_KEY` environment variable
- Currently shows 69+ free models including Gemini, Llama, Qwen, and more

### Example Output

```bash
$ npm run ask -- --provider ollama --models

🤖 Fetching available models for ollama...

📋 Available ollama models (3 found):

• gemma2:2b
  Context: 2 tokens
  Description: Local Ollama model - Size: 1629518495

• phi3:3.8b-mini-4k-instruct-q4_0
  Context: 3 tokens
  Description: Local Ollama model - Size: 2176178369

• phi3:mini
  Context: 3 tokens
  Description: Local Ollama model - Size: 2176178913

💡 Usage: npm run ask -- --provider ollama --model <model_id> "Your question"
```

### Using Specific Models

Once you know the available models, you can use them:

```bash
# Use specific Ollama model
npm run ask -- --provider ollama --model gemma2:2b "What is TypeScript?"

# Use specific OpenRouter model  
npm run ask -- --provider openrouter --model meta-llama/llama-3.3-70b-instruct:free "Explain React hooks"
```

### Programmatic Access

The `availableModels` function is also available for programmatic use:

```bash
# Direct function import
npx tsx -e "
import { availableModels } from './lib/available-models';

// Get Ollama models
const ollamaModels = await availableModels({ provider: 'ollama' });
console.log('Ollama models:', ollamaModels.length);

// Get OpenRouter models (requires API key)
const openrouterModels = await availableModels({ 
  provider: 'openrouter', 
  token: process.env.OPENROUTER_API_KEY 
});
console.log('OpenRouter free models:', openrouterModels.length);
"
```

### Model Information

Each model includes standardized information:

```typescript
interface AIModel {
  id: string;           // Model identifier for API calls
  name: string;         // Human-readable name
  provider: string;     // 'ollama' or 'openrouter'
  free?: boolean;       // Always true for listed models
  context_length?: number;  // Maximum context window in tokens
  description?: string; // Model description and capabilities
}
```

## Configuration

### Default Settings

The Ask command uses these default configuration settings:

```javascript
{
  model: 'google/gemini-2.5-flash-preview',  // Free Google Gemini Flash model
  temperature: 0.1,
  max_tokens: 2048
}
```

### Model Information

**Google Gemini 2.5 Flash Preview**
- **Model ID**: `google/gemini-2.5-flash-preview`
- **Cost**: Very affordable ($0.15/M input, $0.60/M output tokens)
- **Strengths**: Fast responses, excellent code generation, mathematical reasoning, general knowledge, and multilingual support
- **Context Length**: Large context window (1M tokens) for complex questions and long conversations
- **Response Quality**: High-quality responses optimized for speed, accuracy, and code execution
- **Special Features**: Advanced reasoning capabilities, code execution understanding, and iterative problem solving
- **🚀 Streaming Support**: Full Server-Sent Events (SSE) streaming with character-by-character output
- **⚡ Performance**: First response tokens appear in 0.5-2 seconds vs 5-10 seconds with non-streaming

## Error Handling

### Missing API Key

If `OPENROUTER_API_KEY` is not set:

```bash
$ npm run ask -- -e "test"
❌ Error: OPENROUTER_API_KEY environment variable is required.
Please set it in your .env file.
Get your free API key from https://openrouter.ai/
```

### API Errors

Common API errors and solutions:

```bash
# Invalid API key
❌ Error: HTTP 401: Unauthorized
Solution: Check your API key is correct and active

# Rate limit exceeded
❌ Error: HTTP 429: Too Many Requests
Solution: Wait a moment and try again, or upgrade your OpenRouter plan

# Network issues
❌ Error: OpenRouter API error: Network timeout
Solution: Check your internet connection and try again
```

### Interactive Mode Issues

```bash
# Empty input
> 
(ignored - type a question)

# Exit gracefully
> ^C
👋 Goodbye!
```

## Integration with Hasyx Projects

### npm Scripts

The Ask command integrates seamlessly with Hasyx projects through npm scripts:

```json
{
  "scripts": {
    "ask": "NODE_OPTIONS=\"--experimental-vm-modules\" tsx lib/ask.ts",
    "dev": "npx hasyx dev",
    "build": "npx hasyx build"
  }
}
```

### Environment Loading

The command automatically loads environment variables from:
- `.env` file in project root
- System environment variables
- Deployment platform environment (Vercel, etc.)

### CLI Integration

The Ask command is fully integrated with the Hasyx CLI system and supports different usage patterns depending on your context:

**Primary Usage (via npx hasyx):**
```bash
# Available as hasyx command for any project
npx hasyx ask -e "question"
npx hasyx ask --help
```

**Alternative for Development Inside Hasyx Project:**
```bash
# Use CLI script directly
npm run cli -- ask -e "question"
npm run cli -- ask --help
```

**For Projects with Hasyx Integration (npm scripts):**
```bash
# Available as npm script when configured
npm run ask -- -e "question"
npm run ask -- --help
```

## Advanced Usage

### Coding Assistance Workflow

```bash
# 1. Ask for code structure
npx hasyx ask -e "Design the folder structure for a React TypeScript project"

# 2. Get specific implementations
npx hasyx ask -e "Write a custom React hook for API data fetching"

# 3. Debug issues
npx hasyx ask -e "Why might useState not update immediately in React?"

# 4. Optimization advice
npx hasyx ask -e "How to optimize React component performance?"
```

### Learning and Documentation

```bash
# Understand concepts
npx hasyx ask -e "Explain GraphQL subscriptions with examples"

# Compare technologies
npx hasyx ask -e "Compare Next.js vs Nuxt.js vs SvelteKit"

# Best practices
npx hasyx ask -e "What are TypeScript best practices for large projects?"
```

### Problem Solving

```bash
# Algorithm design
npx hasyx ask -e "Design an algorithm to find the shortest path in a graph"

# Architecture decisions
npx hasyx ask -e "How to structure a microservices architecture?"

# Performance optimization
npx hasyx ask -e "How to optimize database queries for large datasets?"
```

## Tips and Best Practices

### Effective Question Asking

1. **Be Specific**: Include context and requirements
   ```bash
   # Good
   npx hasyx ask -e "Write a React component that fetches user data from an API and displays it in a table with sorting"
   
   # Less effective
   npx hasyx ask -e "Make a React component"
   ```

2. **Provide Context**: Mention the technology stack
   ```bash
   npx hasyx ask -e "How to implement authentication in a Next.js app with TypeScript and Hasura?"
   ```

3. **Ask for Examples**: Request code examples when needed
   ```bash
   npx hasyx ask -e "Explain Promise.all() with a practical example"
   ```

### Interactive Mode Tips

1. **Build on Previous Questions**: Each question is independent, so provide context
2. **Use for Exploration**: Great for learning new concepts step by step
3. **Copy Code Carefully**: Always review generated code before using

### Performance Tips

1. **Use Direct Mode for Quick Questions**: Faster than interactive mode
2. **Be Concise**: Shorter questions often get more focused answers
3. **Batch Related Questions**: Use interactive mode for related topics

## Troubleshooting

### Common Issues

1. **Command Not Found**
   ```bash
   # Ensure Hasyx is installed
   npm install hasyx
   
   # Test npx hasyx command
   npx hasyx ask --help
   ```

2. **Environment Variables Not Loading**
   ```bash
   # Check .env file exists and has correct format
   cat .env | grep OPENROUTER_API_KEY
   
   # Ensure no spaces around the equals sign
   OPENROUTER_API_KEY=your_key_here
   ```

3. **Slow Responses**
   - Check internet connection
   - Try a shorter, more specific question
   - Consider API rate limits

4. **Unexpected Responses**
   - Rephrase your question more clearly
   - Provide more context
   - Try breaking complex questions into smaller parts

### Debug Mode

For debugging issues, you can check the underlying OpenRouter integration:

```bash
# Test OpenRouter connection directly
npm run js -- -e "
const { OpenRouter } = require('./lib/openrouter');
const openrouter = new OpenRouter(process.env.OPENROUTER_API_KEY);
const response = await openrouter.ask('Hello');
console.log(response);
"
```

## Related Documentation

- **[OPENROUTER.md](OPENROUTER.md)**: Detailed OpenRouter integration documentation
- **[EXEC.md](EXEC.md)**: JavaScript execution engine used internally
- **[CLI Documentation](README.md#cli-commands)**: Complete CLI command reference

## API Reference

### Command Syntax

```bash
npx hasyx ask [options]
npm run ask -- [options]
```

### Options

- `-e, --eval <question>`: Ask a direct question and exit
- `-h, --help`: Show help information

### Exit Codes

- `0`: Success
- `1`: Error (missing API key, network issues, etc.)

### Environment Variables

- `OPENROUTER_API_KEY`: Required - Your OpenRouter API key

## Examples Repository

For more examples and use cases, check the Hasyx examples repository or the test files in the project:

- `lib/ask.test.ts`: Comprehensive test examples
- `lib/openrouter.test.ts`: OpenRouter integration tests

## Contributing

To contribute to the Ask command functionality:

1. Fork the Hasyx repository
2. Make your changes to `lib/ask.ts`
3. Add tests to `lib/ask.test.ts`
4. Update this documentation
5. Submit a pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed contribution guidelines.

## Command Options

The Ask command supports the following options:

```bash
-e, --eval <question>    Ask a direct question and get a response
-y, --yes               Auto-approve code execution (no confirmation) 
-m, --model <model>     Specify OpenRouter model (e.g., 'anthropic/claude-3-sonnet')
-h, --help              Show help information
```

## Architecture

The Ask system is built with a modular architecture:

### Class Hierarchy

- **`AskHasyx`** (in `lib/ask-hasyx.ts`) - Base class with full AI functionality and execution engines
- **`Ask`** (in `lib/ask.ts`) - Project-specific extension with custom prompting
- **`ask.template`** - Template for child projects to create their own Ask classes

### Key Files

- **`lib/ask-hasyx.ts`** - Core Ask functionality with configurable execution engines
- **`lib/ask.ts`** - Minimal project-specific Ask implementation  
- **`ask.template`** - Template for child projects (copied during npm publish)

### AskOptions Configuration

The `AskHasyx` constructor accepts `AskOptions` to control which execution engines are enabled:

```typescript
interface AskOptions {
  exec?: boolean;     // JavaScript execution (default: true)
  execTs?: boolean;   // TypeScript execution (default: true) 
  terminal?: boolean; // Terminal execution (default: true)
}
```

### Example Usage in Child Projects

Child projects can create their own `ask.ts` by copying `ask.template` and customizing:

```typescript
import { AskHasyx, AskOptions } from 'hasyx/lib/ask-hasyx';

export class Ask extends AskHasyx {
  constructor(token: string, projectName: string = 'My Project') {
    const systemPrompt = `You are an AI assistant for the "${projectName}" project.
    
    // Custom project-specific prompting here
    `;

    super(
      token,
      {}, // context
      { model: 'google/gemini-2.5-flash-preview' }, // options
      systemPrompt, // system prompt
      { exec: true, execTs: false, terminal: true } // ask options
    );
  }
}
```

### Execution Engine Control

You can disable specific execution engines by setting `AskOptions`:

```typescript
// Only JavaScript execution
const ask = new AskHasyx(token, {}, {}, undefined, {
  exec: true,
  execTs: false,
  terminal: false
});

// No code execution at all
const ask = new AskHasyx(token, {}, {}, undefined, {
  exec: false,
  execTs: false,
  terminal: false
});
```

When engines are disabled:
- The corresponding context is not added to the system prompt
- Execution attempts return an error message
- The AI receives appropriate context about available capabilities