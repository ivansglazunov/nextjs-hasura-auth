import { generateDialogHandler } from '../../../lib/ai/handlers/api-dialog';
import { ExecJSTool } from '../../../lib/ai/tools/exec-js-tool';

const systemPrompt = 'You are a helpful assistant. Use tools when needed.';
const tools = [new ExecJSTool()];

const handleDialogRequest = generateDialogHandler({
  tools,
  systemPrompt,
});

export async function POST(request: Request) {
  return handleDialogRequest(request);
}
