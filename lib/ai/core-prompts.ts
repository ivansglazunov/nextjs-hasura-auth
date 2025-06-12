/**
 * Core prompting system for AI tools.
 * Contains only essential rules for tool usage - no application-specific logic.
 */

/**
 * Generates the core tool usage instructions that should be included in all system prompts.
 * This is the minimal, essential prompting that explains how to use tools correctly.
 */
export function getCoreToolPrompt(): string {
  return `
**CRITICAL TOOL USAGE RULES:**

1. **ONLY use tools that are explicitly provided to you** - do not invent or reference tools that weren't listed
2. **NEVER use the 😈 tool syntax unless you intend to execute a specific action** - if you just want to respond normally, use plain text
3. **Tools are for ACTIONS ONLY** - use them only when the user requests something that requires execution (running code, system commands, etc.)
4. **For normal conversation, use plain text responses** - no tool syntax needed

**TOOL EXECUTION FORMAT (only when executing):**
> 😈<uuid>/<tool_name>/<command>
\`\`\`<language>
# Your code or command here
\`\`\`

**EXECUTION RULES:**
- The response must ONLY be the execution block when using tools - no extra text
- Generate a unique UUID for each tool call
- Use only the exact tool names and commands provided in your tool list
- For direct answers (conversation), just write normal text without any tool syntax`;
}

/**
 * Creates system prompt by combining application-specific context with core tool rules.
 * This should be used by all endpoints instead of writing prompts from scratch.
 */
export function createSystemPrompt(appContext: string, availableTools?: string[]): string {
  let prompt = appContext;
  
  if (availableTools && availableTools.length > 0) {
    prompt += '\n\n' + getCoreToolPrompt();
    prompt += '\n\n**AVAILABLE TOOLS:**\n' + availableTools.join('\n');
  }
  
  return prompt;
} 