import * as fs from 'fs';
import * as path from 'path';
import Debug from './debug';

const debug = Debug('hasyx:ask-hasyx');

export interface HasyxProjectInfo {
  name: string;
  version?: string;
  description?: string;
  features?: string[];
}

export interface HasyxAskContext {
  project: HasyxProjectInfo;
  codeExecutionInstructions: string;
  recommendedContext: any;
}

/**
 * Get project information from package.json
 */
function getProjectInfo(): HasyxProjectInfo {
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      return {
        name: packageJson.name || 'Unknown Project',
        version: packageJson.version,
        description: packageJson.description,
        features: []
      };
    }
  } catch (error) {
    debug('Error reading package.json:', error);
  }
  
  return {
    name: 'Unknown Project',
    features: []
  };
}

/**
 * Generate code execution instructions for AI
 */
function getCodeExecutionInstructions(): string {
  return `
CODE EXECUTION CAPABILITIES:

You have access to a powerful code execution environment with the following features:

🚀 **Execution Engines:**
- JavaScript execution via Node.js VM
- TypeScript/TSX execution with full type support
- Async/await support
- Dynamic module loading

🔧 **Available Context:**
- Node.js built-ins (fs, path, crypto, etc.)
- Process information (process.env, process.platform, etc.)
- Network capabilities (fetch, HTTP client)
- File system access
- Dynamic imports and module resolution

📦 **Special Features:**
- Real-time progress indicators
- Error handling with detailed stack traces
- Object serialization and formatting
- Memory and context management
- Iterative execution support (up to 3 iterations for complex problems)

⚡ **Best Practices:**
- Always execute code when user requests calculation, data processing, or verification
- Use proper error handling in your code
- Return meaningful results from code blocks
- For complex operations, break them into smaller steps
- Test alternative approaches if initial code fails

🎯 **When to Execute Code:**
- Mathematical calculations and data analysis
- File operations and data processing
- API calls and network requests
- System information gathering
- Code demonstrations and examples
- Data validation and transformation

The execution environment is sandboxed and secure. Feel free to explore and experiment!
`;
}

/**
 * Get recommended context for code execution
 */
function getRecommendedContext(): any {
  const project = getProjectInfo();
  
  return {
    // Project information
    PROJECT_NAME: project.name,
    PROJECT_VERSION: project.version,
    PROJECT_DESCRIPTION: project.description,
    
    // Environment information
    NODE_ENV: process.env.NODE_ENV || 'development',
    PLATFORM: process.platform,
    ARCH: process.arch,
    
    // Utility functions
    log: (...args: any[]) => console.log(...args),
    debug: (...args: any[]) => debug(...args),
    
    // Common utilities
    sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
    timestamp: () => new Date().toISOString(),
    uuid: () => {
      // Simple UUID v4 generator
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
  };
}

/**
 * Initialize Hasyx Ask context
 */
export function initializeHasyxAsk(): HasyxAskContext {
  debug('Initializing Hasyx Ask context');
  
  const project = getProjectInfo();
  const codeExecutionInstructions = getCodeExecutionInstructions();
  const recommendedContext = getRecommendedContext();
  
  debug('Project info:', project);
  debug('Context initialized with keys:', Object.keys(recommendedContext));
  
  return {
    project,
    codeExecutionInstructions,
    recommendedContext
  };
}

/**
 * Generate system prompt with Hasyx context
 */
export function generateSystemPrompt(context: HasyxAskContext): string {
  return `You are an AI assistant for the "${context.project.name}" project${context.project.version ? ` (v${context.project.version})` : ''}.

${context.project.description ? `Project Description: ${context.project.description}` : ''}

${context.codeExecutionInstructions}

EXECUTION FORMAT - use this EXACT format to execute code:

> 🪬<uuid>/do/exec/js
\`\`\`js
your javascript code here
\`\`\`

or

> 🪬<uuid>/do/exec/tsx  
\`\`\`tsx
your typescript code here
\`\`\`

CRITICAL FORMATTING RULES:
1. Start with ">" followed by space and 🪬 emoji
2. Use a unique ID (like abc123, def456, etc.)
3. Put the code inside proper markdown code blocks with \`\`\`js or \`\`\`tsx
4. The code block MUST be on separate lines

EXECUTION EXAMPLES:

> 🪬abc123/do/exec/js
\`\`\`js
2 + 2
\`\`\`

> 🪬def456/do/exec/js
\`\`\`js
const obj = {a: 1, b: 2};
obj
\`\`\`

> 🪬ghi789/do/exec/js
\`\`\`js
console.log('Hello from ${context.project.name}!');
process.version
\`\`\`

BEHAVIOR:
- Always execute code when users ask for calculations, demonstrations, or verification
- Provide helpful explanations along with code execution
- Use the available context and utilities
- Handle errors gracefully and suggest alternatives
- Be proactive in offering to execute code that would help answer questions

Available in execution context: ${Object.keys(context.recommendedContext).join(', ')}`;
}

/**
 * Export default initialization
 */
export default initializeHasyxAsk; 