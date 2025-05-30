import readline from 'readline';
import fs from 'fs-extra';
import Debug from './debug'; // Assuming Debug is already in its own file or correctly pathed

const debug = Debug('assist:common');

export function createRlInterface(): readline.Interface {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

export async function askYesNo(rl: readline.Interface, question: string, defaultValue: boolean = false): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const prompt = defaultValue ? `${question} [Y/n]: ` : `${question} [y/N]: `;
    debug(`Asking: ${question} (default: ${defaultValue ? 'Y' : 'N'})`);
    rl.question(prompt, (answer) => {
      const normalizedAnswer = answer.trim().toLowerCase();
      let result: boolean;
      if (normalizedAnswer === '') result = defaultValue;
      else if (['y', 'yes'].includes(normalizedAnswer)) result = true;
      else if (['n', 'no'].includes(normalizedAnswer)) result = false;
      else { console.log(`Invalid response. Using default: ${defaultValue ? 'Yes' : 'No'}`); result = defaultValue; }
      resolve(result);
    });
  });
}

export async function askForInput(rl: readline.Interface, prompt: string, defaultValue: string = '', isSecret: boolean = false): Promise<string> {
  return new Promise<string>((resolve) => {
    const displayDefault = isSecret && defaultValue ? maskDisplaySecret(defaultValue) : defaultValue;
    const promptText = defaultValue ? `${prompt} [${displayDefault}]: ` : `${prompt}: `;
    debug(`Asking for input: ${prompt} (default: ${defaultValue})${isSecret ? ' (secret)' : ''}`);

    const originalStdoutMuted = (rl as any).stdoutMuted;
    if (isSecret) {
      (rl as any).stdoutMuted = true;
    }

    rl.question(promptText, (answer) => {
      if (isSecret) {
        (rl as any).stdoutMuted = originalStdoutMuted;
        // Manually echo a newline because rl.question might not if its output was muted.
        if ((rl as any).output) {
            (rl as any).output.write('\n');
        }
      }
      const trimmedAnswer = answer.trim();
      resolve(trimmedAnswer === '' ? defaultValue : trimmedAnswer);
    });

    // Ensure the prompt is displayed if stdoutMuted is true from the start
    // This is usually handled by rl.question, but good to be mindful.
    // If isSecret is true, rl._writeToOutput(promptText) could be called if rl.question doesn't output.
    // However, testing shows rl.question still prints the prompt.
  });
}

export function parseEnvFile(envPath: string): Record<string, string> {
  const envVars: Record<string, string> = {};
  if (!fs.existsSync(envPath)) return envVars;
  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const equalIndex = trimmedLine.indexOf('=');
        if (equalIndex > 0) {
          const key = trimmedLine.substring(0, equalIndex).trim();
          let value = trimmedLine.substring(equalIndex + 1).trim();
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.substring(1, value.length - 1);
          }
          envVars[key] = value;
        }
      }
    });
  } catch (error) { debug('Error parsing .env file:', error); }
  return envVars;
}

export function writeEnvFile(envPath: string, envVars: Record<string, string>): void {
  let content = '# Environment variables for hasyx project\n';
  content += Object.entries(envVars)
    .map(([key, value]) => {
      // Check if value is already quoted
      const alreadyQuoted = (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
      if (alreadyQuoted || !value.includes(' ')) {
        return `${key}=${value}`;
      }
      return `${key}="${value}"`; // Add quotes if it contains spaces and is not already quoted
    })
    .join('\n');
  content += '\n'; // Ensure a trailing newline
  fs.writeFileSync(envPath, content, 'utf-8');
  debug(`Wrote ${Object.keys(envVars).length} variables to ${envPath}`);
}

// Basic function to get GitHub remote URL (owner/repo)
export function getGitHubRemoteUrl(): string | null {
    try {
        const result = require('child_process').spawnSync('git', ['config', '--get', 'remote.origin.url'], { encoding: 'utf-8' });
        if (result.status === 0 && result.stdout) {
            const url = result.stdout.trim();
            const match = url.match(/github\.com[\:|\/]([^\/]+\/[^\/]+?)(\.git)?$/);
            if (match && match[1]) {
                debug(`Found GitHub remote URL: ${match[1]}`);
                return match[1];
            }
        }
    } catch (e) {
        debug('Error getting GitHub remote URL:', e);
    }
    debug('GitHub remote URL not found or not in expected format.');
    return null;
}

export function maskDisplaySecret(secret: string | undefined | null): string {
  if (!secret || secret.length === 0) {
    return '********';
  }
  if (secret.length < 4) {
    // For secrets like "1", "12", "123", show "1***"
    return secret[0] + '***';
  }
  // For secrets "1234" or longer, show "1234****"
  return secret.substring(0, 4) + '****';
} 