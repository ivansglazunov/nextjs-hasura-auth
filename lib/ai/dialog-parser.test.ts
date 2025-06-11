import { parseThinkingBuffer, ParsedChunk } from './dialog-parser';

// Helper to create a mock ReadableStreamDefaultReader from an array of strings
function createMockReader(chunks: string[]): ReadableStreamDefaultReader<string> {
  let index = 0;
  return {
    async read(): Promise<ReadableStreamReadResult<string>> {
      if (index < chunks.length) {
        const chunk = chunks[index++];
        return Promise.resolve({ done: false, value: chunk });
      } else {
        return Promise.resolve({ done: true, value: undefined });
      }
    },
    releaseLock: () => {},
    closed: Promise.resolve(undefined),
    cancel: () => Promise.resolve(),
  };
}

describe('Dialog Parser - "parse thinking"', () => {
  it('should handle a simple stream with one think block', async () => {
    const reader = createMockReader(['response part 1', '<think>thought part 1</think>', 'response part 2']);
    const events: ParsedChunk[] = [];
    const { thoughts, response } = await parseThinkingBuffer(reader, (e) => events.push(e));

    expect(response).toBe('response part 1response part 2');
    expect(thoughts).toBe('thought part 1');
    expect(events).toEqual([
      { type: 'response_chunk', chunk: 'response part 1' },
      { type: 'thought_chunk', chunk: 'thought part 1' },
      { type: 'response_chunk', chunk: 'response part 2' },
    ]);
  });

  it('should handle tags being split across chunks', async () => {
    const reader = createMockReader(['resp 1<th', 'ink>thought 1</th', 'ink>resp 2']);
    const events: ParsedChunk[] = [];
    const { thoughts, response } = await parseThinkingBuffer(reader, (e) => events.push(e));

    expect(response).toBe('resp 1resp 2');
    expect(thoughts).toBe('thought 1');
    expect(events).toEqual([
        { type: 'response_chunk', chunk: 'resp 1' },
        { type: 'thought_chunk', chunk: 'thought 1' },
        { type: 'response_chunk', chunk: 'resp 2' },
    ]);
  });
  
  it('should handle multiple think blocks', async () => {
    const reader = createMockReader(['r1<think>t1</think>r2<think>t2</think>r3']);
    const events: ParsedChunk[] = [];
    const { thoughts, response } = await parseThinkingBuffer(reader, (e) => events.push(e));
    
    expect(response).toBe('r1r2r3');
    expect(thoughts).toBe('t1t2');
  });

  it('should handle stream starting with a think block', async () => {
    const reader = createMockReader(['<think>t1</think>r1']);
    const events: ParsedChunk[] = [];
    const { thoughts, response } = await parseThinkingBuffer(reader, (e) => events.push(e));
    
    expect(response).toBe('r1');
    expect(thoughts).toBe('t1');
  });

  it('should handle stream with no thoughts', async () => {
    const reader = createMockReader(['hello', ' world']);
    const events: ParsedChunk[] = [];
    const { thoughts, response } = await parseThinkingBuffer(reader, (e) => events.push(e));
    
    expect(response).toBe('hello world');
    expect(thoughts).toBe('');
  });

  it('should handle stream with only thoughts', async () => {
    const reader = createMockReader(['<think>t1</think><think>t2</think>']);
    const events: ParsedChunk[] = [];
    const { thoughts, response } = await parseThinkingBuffer(reader, (e) => events.push(e));
    
    expect(response).toBe('');
    expect(thoughts).toBe('t1t2');
  });

  it('should handle unterminated think block at the end of the stream', async () => {
    const reader = createMockReader(['r1<think>t1 is not finished']);
    const events: ParsedChunk[] = [];
    const { thoughts, response } = await parseThinkingBuffer(reader, (e) => events.push(e));

    expect(response).toBe('r1');
    expect(thoughts).toBe('t1 is not finished');
  });
  
  it('should handle empty think blocks', async () => {
    const reader = createMockReader(['r1<think></think>r2']);
    const events: ParsedChunk[] = [];
    const { thoughts, response } = await parseThinkingBuffer(reader, (e) => events.push(e));

    expect(response).toBe('r1r2');
    expect(thoughts).toBe('');
  });

  it('should handle extremely fragmented stream', async () => {
    const stream = 'r1<think>\\nab</think>r2'.split('');
    const reader = createMockReader(stream);
    const events: ParsedChunk[] = [];
    const { thoughts, response } = await parseThinkingBuffer(reader, (e) => events.push(e));

    expect(response).toBe('r1r2');
    expect(thoughts).toBe('\\nab');
  });

  it('should handle a closing tag without an opening one by treating previous response as thought', async () => {
    const reader = createMockReader(['this was supposed to be a response', ' but it is a thought</think>r1']);
    const events: ParsedChunk[] = [];
    const { thoughts, response } = await parseThinkingBuffer(reader, (e) => events.push(e));

    // The final response should only be 'r1'
    expect(response).toBe('r1');
    // The thoughts should contain everything that came before the closing tag
    expect(thoughts).toBe('this was supposed to be a response but it is a thought');
    
    // The parser is smart enough not to emit a response chunk prematurely.
    // It should emit the re-classified thought and then the final response chunk.
    expect(events).toEqual([
      { type: 'thought_chunk', chunk: 'this was supposed to be a response but it is a thought' },
      { type: 'response_chunk', chunk: 'r1' },
    ]);
  });
}); 