# Ollama

Local AI Models Integration

The Ollama module provides a powerful interface for running AI models locally through Ollama, combined with the same AI features as OpenRouter. This integration allows you to create AI-powered applications with complete privacy and control over your models.

## Features

- **Local AI Models**: Run AI models locally without API dependencies
- **Privacy First**: All processing happens locally on your machine
- **Multiple Models**: Support for various open-source models (Llama, Phi, Gemma, etc.)
- **Streaming Support**: Real-time streaming responses from local models
- **Code Execution**: Built-in JavaScript/TypeScript execution with persistent context
- **Memory Management**: Conversation history and context management
- **Error Handling**: Robust error handling for model interactions
- **TypeScript Support**: Full TypeScript definitions for type safety

## Prerequisites

### Install Ollama

First, install Ollama on your system:

```bash
# Linux/macOS (automatic installation)
curl -fsSL https://ollama.ai/install.sh | sh

# Or download from https://ollama.ai for Windows
```

### Start Ollama Service

```bash
# Ollama runs as a service by default on port 11434
# Check if it's running:
systemctl status ollama  # Linux
# or
ollama --version
```

### Install AI Models

Install the models you want to use:

```bash
# Install Gemma2 2B (lightweight, good for development)
ollama pull gemma2:2b

# Install Llama 3.2 3B (more capable)
ollama pull llama3.2:3b

# Install Phi-3 Mini (Microsoft's efficient model)
ollama pull phi3:mini

# Install Code Llama (specialized for coding)
ollama pull codellama:7b

# List installed models
ollama list

# Test a model
ollama run gemma2:2b "Hello, how are you?"

# Remove a model (to free space)
ollama rm phi3:mini

# Show model information
ollama show gemma2:2b
```

## Installation

Ollama integration is included with Hasyx. No additional installation required.

```typescript
import { Ollama } from 'hasyx/lib/ollama';
import { AI } from 'hasyx/lib/ai';
```

## Basic Usage

### Creating an Ollama Provider

```typescript
import { Ollama } from 'hasyx/lib/ollama';
import { AI } from 'hasyx/lib/ai';

// Basic initialization with Gemma2 2B
const ollama = new Ollama({
  baseUrl: 'http://localhost:11434',
  model: 'gemma2:2b'
});

// Create AI instance with Ollama provider
const ai = new AI({
  provider: ollama,
  systemPrompt: 'You are a helpful AI assistant running locally.'
});
```

### Configuration Options

```typescript
interface OllamaOptions {
  baseUrl?: string;           // Ollama API URL (default: http://localhost:11434)
  model: string;              // Model name (required)
  timeout?: number;           // Request timeout in ms (default: 60000)
  temperature?: number;       // Randomness 0-1 (default: 0.7)
  top_p?: number;            // Nucleus sampling (default: 0.9)
  top_k?: number;            // Top-k sampling (default: 40)
  repeat_penalty?: number;    // Repetition penalty (default: 1.1)
  seed?: number;             // Random seed for reproducibility
  num_ctx?: number;          // Context window size
  num_predict?: number;      // Max tokens to predict
}
```

### Simple AI Conversations

```typescript
// Simple question
const response = await ai.ask('What is the capital of France?');
console.log(response);

// With streaming
const ai = new AI({
  provider: ollama,
  onStream: (chunk) => process.stdout.write(chunk),
  onStreamEnd: () => console.log('\n✅ Complete')
});

const response = await ai.askStream('Explain quantum computing briefly');
```

## Model Management

### Check Service Status

```typescript
const ollama = new Ollama({ model: 'gemma2:2b' });

// Check if Ollama is running
const isAvailable = await ollama.isAvailable();
console.log('Ollama available:', isAvailable);
```

### List Available Models

```typescript
// Get list of installed models
const models = await ollama.listModels();
console.log('Available models:', models);
// Example output: ['gemma2:2b', 'llama3.2:3b', 'phi3:mini']
```

### Pull New Models

```typescript
// Download a model programmatically
const success = await ollama.pullModel('llama3.2:3b');
if (success) {
  console.log('Model downloaded successfully');
} else {
  console.log('Failed to download model');
}
```

## Recommended Models

### For Development (Low Resource)

```bash
# Gemma2 2B - Google's efficient model
ollama pull gemma2:2b
# RAM requirement: ~3-4GB
# Good for: General chat, basic coding, testing
```

### For Production (Balanced)

```bash
# Llama 3.2 3B - Meta's latest efficient model
ollama pull llama3.2:3b
# RAM requirement: ~4-6GB
# Good for: Better reasoning, complex tasks
```

### For Coding Tasks

```bash
# Code Llama 7B - Specialized for programming
ollama pull codellama:7b
# RAM requirement: ~8-10GB
# Good for: Code generation, debugging, explanation
```

### For Advanced Tasks

```bash
# Llama 3.1 8B - Most capable (if you have resources)
ollama pull llama3.1:8b
# RAM requirement: ~12-16GB
# Good for: Complex reasoning, large context
```

## Integration with Ask CLI

### Using Ollama with `hasyx ask`

The Ask CLI supports provider switching for seamless integration:

```bash
# Use Ollama provider with specific model
npx hasyx ask --provider ollama --model gemma2:2b "Explain TypeScript"

# Use npm run ask shortcut
npm run ask -- --provider ollama --model gemma2:2b "What is machine learning?"

# Quick access to different models
npm run ask -- --provider ollama --model codellama:7b "Write a function to calculate Fibonacci numbers"
npm run ask -- --provider ollama --model llama3.2:3b "Explain quantum physics"

# Compare providers (OpenRouter vs Ollama)
npm run ask -- --provider openrouter --model claude-3-haiku "Hello from OpenRouter"
npm run ask -- --provider ollama --model gemma2:2b "Hello from Ollama"
```

### Configuration in `.env`

```env
# Default provider and model
HASYX_PROVIDER=ollama
HASYX_MODEL=gemma2:2b
OLLAMA_BASE_URL=http://localhost:11434

# Keep OpenRouter as fallback
OPENROUTER_API_KEY=your_key_here
```

### Provider Selection Priority

1. CLI flags: `--provider ollama --model gemma2:2b`
2. Environment variables: `HASYX_PROVIDER=ollama`
3. Default: OpenRouter (if API key available)

## Advanced Usage

### Custom Model Configuration

```typescript
const ollama = new Ollama({
  model: 'llama3.2:3b',
  temperature: 0.3,      // More focused responses
  top_p: 0.9,
  top_k: 40,
  repeat_penalty: 1.1,
  num_ctx: 8192,         // Large context window
  num_predict: 2048      // Max response length
});
```

### Streaming with Progress

```typescript
const ai = new AI({
  provider: ollama,
  onStream: (chunk) => {
    // Real-time character output
    process.stdout.write(chunk);
  },
  onStreamEnd: () => {
    console.log('\n🎉 Generation complete');
  }
});

const response = await ai.askStream('Write a short poem about programming');
```

### Multiple Models

```typescript
// Use different models for different tasks
const coder = new AI({
  provider: new Ollama({ model: 'codellama:7b' }),
  systemPrompt: 'You are an expert programmer.'
});

const chatbot = new AI({
  provider: new Ollama({ model: 'gemma2:2b' }),
  systemPrompt: 'You are a friendly conversational AI.'
});

const codeResponse = await coder.ask('Optimize this SQL query...');
const chatResponse = await chatbot.ask('How was your day?');
```

## Performance Tips

### Memory Management

```bash
# Check system resources
free -h

# Monitor Ollama resource usage
htop
# or
docker stats  # if running in container
```

### Model Selection by Available RAM

| Available RAM | Recommended Model | Use Case |
|---------------|-------------------|----------|
| 4-6 GB | `gemma2:2b` | Development, basic tasks |
| 6-8 GB | `llama3.2:3b` | General purpose |
| 8-12 GB | `codellama:7b` | Coding tasks |
| 12+ GB | `llama3.1:8b` | Advanced reasoning |

### Optimization

```typescript
// Optimize for speed
const fastOllama = new Ollama({
  model: 'gemma2:2b',
  temperature: 0.1,     // Less randomness = faster
  num_predict: 512,     // Shorter responses = faster
  timeout: 30000        // Shorter timeout
});

// Optimize for quality
const qualityOllama = new Ollama({
  model: 'llama3.2:3b',
  temperature: 0.7,
  top_p: 0.9,
  num_ctx: 4096,        // Larger context
  num_predict: 2048     // Longer responses
});
```

## Troubleshooting

### Common Issues

#### 1. "Connection refused" error

```bash
# Check if Ollama is running
curl http://localhost:11434
# Should return: "Ollama is running"

# Start Ollama if not running
systemctl start ollama  # Linux
# or restart computer (service should auto-start)
```

#### 2. "Model not found" error

```bash
# List installed models
ollama list

# Pull missing model
ollama pull gemma2:2b
```

#### 3. "Out of memory" error

```bash
# Check available memory
free -h

# Use smaller model
ollama pull gemma2:2b  # Instead of larger models
```

#### 4. Slow responses

```typescript
// Reduce model parameters
const ollama = new Ollama({
  model: 'gemma2:2b',
  num_predict: 256,     // Shorter responses
  timeout: 60000        // Longer timeout
});
```

### Debugging

```typescript
import Debug from 'debug';

// Enable debug logging
const debug = Debug('hasyx:ollama');

const ollama = new Ollama({ model: 'gemma2:2b' });

// Test connectivity
try {
  const isAvailable = await ollama.isAvailable();
  debug(`Ollama available: ${isAvailable}`);
  
  const models = await ollama.listModels();
  debug(`Available models: ${models.join(', ')}`);
  
  const response = await ollama.ask('Test message');
  debug(`Response: ${response}`);
} catch (error) {
  debug(`Error: ${error.message}`);
}
```

## Example Projects

### 1. Local Code Assistant

```typescript
import { AI } from 'hasyx/lib/ai';
import { Ollama } from 'hasyx/lib/ollama';

const codeAssistant = new AI({
  provider: new Ollama({ 
    model: 'codellama:7b',
    temperature: 0.2
  }),
  systemPrompt: `You are a senior software engineer. Help with:
- Code review and optimization
- Bug fixing and debugging  
- Architecture decisions
- Best practices`
});

// Usage
const help = await codeAssistant.ask(`
Review this React component and suggest improvements:

function UserList({ users }) {
  return (
    <div>
      {users.map(user => (
        <div key={user.id}>
          <h3>{user.name}</h3>
          <p>{user.email}</p>
        </div>
      ))}
    </div>
  );
}
`);
```

### 2. Educational Tutor

```typescript
const tutor = new AI({
  provider: new Ollama({ 
    model: 'llama3.2:3b',
    temperature: 0.5
  }),
  systemPrompt: `You are a patient teacher. Explain concepts clearly with examples.`
});

const explanation = await tutor.ask('Explain recursion in programming with a simple example');
```

### 3. Creative Writing Assistant

```typescript
const writer = new AI({
  provider: new Ollama({ 
    model: 'gemma2:2b',
    temperature: 0.8  // Higher creativity
  }),
  systemPrompt: `You are a creative writing assistant. Help with storytelling, poetry, and creative content.`
});

const story = await writer.ask('Write the opening paragraph of a sci-fi story about AI consciousness');
```

## Testing

Run the comprehensive test suite to verify your Ollama setup:

```bash
# Run Ollama integration tests
npm test ollama

# The tests will:
# - Verify Ollama service is running
# - Check available models
# - Test basic AI operations
# - Test streaming functionality
# - Test error handling
# - Test memory management
```

## Comparison: Ollama vs OpenRouter

| Feature | Ollama | OpenRouter |
|---------|--------|------------|
| **Privacy** | ✅ Fully local | ❌ External API |
| **Cost** | ✅ Free after setup | ❌ Pay per use |
| **Internet** | ✅ Works offline | ❌ Requires connection |
| **Setup** | ❌ Requires installation | ✅ Just API key |
| **Model variety** | ❌ Limited to open-source | ✅ Access to all models |
| **Performance** | ❌ Depends on hardware | ✅ Consistent |
| **Resource usage** | ❌ Uses local RAM/CPU | ✅ No local resources |

Choose **Ollama** for:
- Privacy-sensitive applications
- Offline development
- Cost control
- Learning and experimentation

Choose **OpenRouter** for:
- Production applications
- Best model performance
- Minimal setup requirements
- Variable workloads 