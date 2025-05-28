# Ask Command - AI Assistant CLI

The Ask command provides a powerful AI assistant interface for Hasyx projects, allowing you to ask questions and get intelligent responses directly from your command line. It uses OpenRouter's free DeepSeek model to provide high-quality AI assistance for coding, problem-solving, and general questions.

## Features

- **Direct Question Mode**: Ask single questions with immediate responses
- **Interactive Chat Mode**: Start a conversation session with the AI
- **Free AI Model**: Uses DeepSeek's free model via OpenRouter API
- **Multiple Question Types**: Supports coding, math, general knowledge, and more
- **Clean Output**: Shows only AI responses without additional console messages
- **Environment Integration**: Automatically loads configuration from `.env` file

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

Add your OpenRouter API key to your `.env` file:

```env
# Required for AI features (ask command, OpenRouter integration)
OPENROUTER_API_KEY=sk-or-v1-your_openrouter_api_key_here
```

## Usage

### Direct Question Mode

Ask a single question and get an immediate response:

```bash
# Using npx hasyx
npx hasyx ask -e "What is the capital of France?"
npx hasyx ask --eval "Write a JavaScript function to add two numbers"

# Using npm script (recommended for projects)
npm run ask -- -e "What is the capital of France?"
npm run ask -- --eval "Write a JavaScript function to add two numbers"
```

### Interactive Chat Mode

Start an interactive conversation session:

```bash
# Using npx hasyx
npx hasyx ask

# Using npm script (recommended for projects)
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
npm run ask -- -e "Write a React component for a todo list with add and delete functionality"

# JavaScript functions
npm run ask -- -e "Create a function that debounces another function"

# TypeScript interfaces
npm run ask -- -e "Design TypeScript interfaces for a user management system"

# Algorithm help
npm run ask -- -e "Explain how to implement a binary search algorithm"
```

### Math and Calculations

```bash
# Simple math
npm run ask -- -e "What is 15 * 27?"

# Complex calculations
npm run ask -- -e "Calculate the compound interest for $1000 at 5% annually for 10 years"

# Mathematical concepts
npm run ask -- -e "Explain the difference between mean, median, and mode"
```

### General Knowledge

```bash
# Geography
npm run ask -- -e "What are the capitals of all European countries?"

# Science
npm run ask -- -e "Explain how photosynthesis works"

# Technology
npm run ask -- -e "What is the difference between REST and GraphQL APIs?"
```

### Interactive Session Example

```bash
$ npm run ask

> What is TypeScript?
TypeScript is a strongly typed programming language that builds on JavaScript...

> How do I use async/await in JavaScript?
Async/await is a syntax that makes it easier to work with asynchronous code...

> Write a simple Express.js server
Here's a basic Express.js server setup:

```javascript
const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
```

> ^C
```

## Configuration

### Default Settings

The Ask command uses these default configuration settings:

```javascript
{
  model: 'deepseek/deepseek-chat-v3-0324:free',  // Free DeepSeek model
  temperature: 0.7,                              // Balanced creativity
  max_tokens: 4096,                             // Long responses
  timeout: 30000                                // 30 second timeout
}
```

### Model Information

**DeepSeek Chat v3 (Free)**
- **Model ID**: `deepseek/deepseek-chat-v3-0324:free`
- **Cost**: Free tier available
- **Strengths**: Code generation, mathematical reasoning, general knowledge
- **Context Length**: Large context window for complex questions
- **Response Quality**: High-quality responses comparable to premium models

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

The Ask command is fully integrated with the Hasyx CLI system:

```bash
# Available as hasyx command
npx hasyx ask -e "question"

# Available as npm script
npm run ask -- -e "question"

# Help information
npx hasyx ask --help
```

## Advanced Usage

### Coding Assistance Workflow

```bash
# 1. Ask for code structure
npm run ask -- -e "Design the folder structure for a React TypeScript project"

# 2. Get specific implementations
npm run ask -- -e "Write a custom React hook for API data fetching"

# 3. Debug issues
npm run ask -- -e "Why might useState not update immediately in React?"

# 4. Optimization advice
npm run ask -- -e "How to optimize React component performance?"
```

### Learning and Documentation

```bash
# Understand concepts
npm run ask -- -e "Explain GraphQL subscriptions with examples"

# Compare technologies
npm run ask -- -e "Compare Next.js vs Nuxt.js vs SvelteKit"

# Best practices
npm run ask -- -e "What are TypeScript best practices for large projects?"
```

### Problem Solving

```bash
# Algorithm design
npm run ask -- -e "Design an algorithm to find the shortest path in a graph"

# Architecture decisions
npm run ask -- -e "How to structure a microservices architecture?"

# Performance optimization
npm run ask -- -e "How to optimize database queries for large datasets?"
```

## Tips and Best Practices

### Effective Question Asking

1. **Be Specific**: Include context and requirements
   ```bash
   # Good
   npm run ask -- -e "Write a React component that fetches user data from an API and displays it in a table with sorting"
   
   # Less effective
   npm run ask -- -e "Make a React component"
   ```

2. **Provide Context**: Mention the technology stack
   ```bash
   npm run ask -- -e "How to implement authentication in a Next.js app with TypeScript and Hasura?"
   ```

3. **Ask for Examples**: Request code examples when needed
   ```bash
   npm run ask -- -e "Explain Promise.all() with a practical example"
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
   
   # Check npm scripts
   npm run ask -- --help
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