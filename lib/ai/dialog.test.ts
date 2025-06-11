import { Dialog, DialogEvent } from './dialog';
import { OpenRouterProvider } from './providers/openrouter';
import { ExecJSTool } from './tools/exec-js-tool';
import * as dotenv from 'dotenv';
import * as path from 'path';
import Debug from '../debug';

const debug = Debug('dialog:test');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const hasApiKey = !!process.env.OPENROUTER_API_KEY;
const describeWithApiKey = hasApiKey ? describe : describe.skip;

describeWithApiKey('Dialog Class with Real Components', () => {
    let dialog: Dialog;
    let events: DialogEvent[];

    beforeEach(() => {
        events = []; // Reset events before each test
        debug('--- Starting new test ---');
    });

    it('should run a simple ask-response cycle with OpenRouter', (done) => {
        debug('Test: should run a simple ask-response cycle with OpenRouter');
        const provider = new OpenRouterProvider({
            token: process.env.OPENROUTER_API_KEY!,
            user: `test-user-${Math.random()}`
        });
        dialog = new Dialog({
            provider,
            onChange: (e) => {
                debug('Received event in test: %o', e);
                events.push(e);
                if (e.type === 'done') {
                    const eventTypes = events.map(ev => ev.type);
                    expect(eventTypes).toEqual(expect.arrayContaining(['ask', 'ai_request', 'ai_chunk', 'ai_response', 'done']));
                    const responseEvent = events.find(ev => ev.type === 'ai_response') as any;
                    expect(responseEvent.content.toLowerCase()).toContain('hello');
                    debug('Test completed successfully.');
                    done();
                } else if (e.type === 'error') {
                    debug('Test failed with error: %s', e.error);
                    done(new Error(e.error));
                }
            }
        });

        dialog.ask({ role: 'user', content: 'Say "hello"' });
    }, 30000);

    it('should handle a real tool cycle with ExecJSTool', (done) => {
        debug('Test: should handle a real tool cycle with ExecJSTool');
        const provider = new OpenRouterProvider({
            token: process.env.OPENROUTER_API_KEY!,
            user: `test-user-${Math.random()}`,
            model: 'sarvamai/sarvam-m:free'
        });
        const jsTool = new ExecJSTool();

        dialog = new Dialog({
            provider,
            tools: [jsTool],
            systemPrompt: 'You are a helpful assistant. Use tools when needed. Call the javascript tool to calculate.',
            onChange: (e) => {
                debug('Received event in test: %o', e);
                events.push(e);
                if (e.type === 'done' && events.some(ev => ev.type === 'tool_result')) {
                    const eventTypes = events.map(ev => ev.type);

                    expect(eventTypes).toContain('tool_call');
                    expect(eventTypes).toContain('tool_result');
                    expect(eventTypes.filter(et => et === 'ai_request').length).toBe(2);
                    
                    const toolResult = events.find(ev => ev.type === 'tool_result') as any;
                    expect(toolResult.result).toBe(8);

                    const finalResponse = events.slice().reverse().find(ev => ev.type === 'ai_response') as any;
                    expect(finalResponse.content).toMatch(/8|eight/);

                    debug('Test completed successfully.');
                    done();
                } else if (e.type === 'error') {
                    debug('Test failed with error: %s', e.error);
                    done(new Error(e.error));
                }
            }
        });

        dialog.ask({ role: 'user', content: 'Use javascript tool to calculate 5 + 3' });
    }, 60000);

    it('should stop and resume correctly with real calls', (done) => {
        debug('Test: should stop and resume correctly with real calls');
        const provider = new OpenRouterProvider({
            token: process.env.OPENROUTER_API_KEY!,
            user: `test-user-${Math.random()}`
        });
        let askCounter = 0;
        let resumed = false;

        dialog = new Dialog({
            provider,
            onChange: (e) => {
                debug('Received event in test: %o', e);
                events.push(e);

                if (e.type === 'ai_request') {
                    askCounter++;
                }

                if (e.type === 'done') {
                    // After first question is done
                    if (askCounter === 1 && !resumed) {
                        dialog.stop();
                        dialog.ask({ role: 'user', content: 'Second question' }); 
                        
                        setTimeout(() => {
                            expect(askCounter).toBe(1); // Should not have increased
                            resumed = true;
                            dialog.resume();
                        }, 500);

                    } else if (askCounter === 2) {
                        // After second question is done
                        debug('Test completed successfully.');
                        done();
                    }
                } else if (e.type === 'error') {
                    debug('Test failed with error: %s', e.error);
                    done(new Error(e.error));
                }
            }
        });

        dialog.ask({ role: 'user', content: 'First question, say "one"' });
    }, 60000);
}); 