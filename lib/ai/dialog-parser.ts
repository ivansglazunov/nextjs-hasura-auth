import Debug from '../debug';

const parseDebug = Debug('hasyx:dialog:parser');

export type ParsedChunk =
  | { type: 'thought_chunk', chunk: string }
  | { type: 'response_chunk', chunk: string };

/**
 * Parses a ReadableStream from an AI provider, separating "thoughts"
 * enclosed in <think>...</think> tags from the main response content.
 *
 * It processes the stream chunk-by-chunk, calling the handler function
 * for each piece of thought or response identified.
 *
 * @param reader The ReadableStreamDefaultReader to read from.
 * @param handle A callback function that receives ParsedChunk events.
 * @returns A promise that resolves to an object containing the
 *          concatenated thoughts and response strings.
 */
export async function parseThinkingBuffer(
  reader: ReadableStreamDefaultReader<string>,
  handle: (event: ParsedChunk) => void
): Promise<{ thoughts: string; response: string }> {
  let thoughts = '';
  let response = '';
  let buffer = '';
  let isThinking = false;

  parseDebug('Starting stream parsing.');

  const processBuffer = () => {
    let tagsFound = true;
    while (tagsFound) {
        tagsFound = false;

        const startTagIndex = buffer.indexOf('<think>');
        const endTagIndex = buffer.indexOf('</think>');

        if (isThinking) {
            // We are inside a <think> block, looking for the end.
            if (endTagIndex !== -1) {
                const thoughtChunk = buffer.substring(0, endTagIndex);
                if (thoughtChunk) {
                    parseDebug('Found thought chunk: "%s"', thoughtChunk);
                    handle({ type: 'thought_chunk', chunk: thoughtChunk });
                    thoughts += thoughtChunk;
                }
                buffer = buffer.substring(endTagIndex + '</think>'.length);
                isThinking = false;
                tagsFound = true; // Continue processing the rest of the buffer
            }
        } else {
            // We are outside a <think> block.
            if (startTagIndex !== -1 && (startTagIndex < endTagIndex || endTagIndex === -1)) {
                // Found a start tag, this is the normal case.
                const responseChunk = buffer.substring(0, startTagIndex);
                if (responseChunk) {
                    parseDebug('Found response chunk: "%s"', responseChunk);
                    handle({ type: 'response_chunk', chunk: responseChunk });
                    response += responseChunk;
                }
                buffer = buffer.substring(startTagIndex + '<think>'.length);
                isThinking = true;
                tagsFound = true;
            } else if (endTagIndex !== -1) {
                // SPECIAL CASE: Found an end tag while not thinking.
                // This implies the model forgot the opening tag.
                parseDebug('Found closing </think> tag while not in thinking mode. Retroactively classifying previous response content as a thought.');
                const thoughtChunk = buffer.substring(0, endTagIndex);
                
                // The entire 'response' accumulator and the current buffer up to the tag are thoughts.
                const fullRetroactiveThought = response + thoughtChunk;
                
                if (fullRetroactiveThought) {
                    // We can't take back the streamed response chunks, but we can correct the final tallies.
                    handle({ type: 'thought_chunk', chunk: fullRetroactiveThought });
                    thoughts += fullRetroactiveThought;
                }
                
                // Reset response accumulator and buffer
                response = '';
                buffer = buffer.substring(endTagIndex + '</think>'.length);
                isThinking = false; // We are now out of the (implicit) thought block.
                tagsFound = true;
            }
        }
    }
};

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      parseDebug('Stream finished.');
      break;
    }
    parseDebug('Read chunk from stream: "%s"', value);
    buffer += value;
    processBuffer();
  }

  if (buffer.length > 0) {
    if (!isThinking) {
      parseDebug('Found final response chunk left in buffer: "%s"', buffer);
      handle({ type: 'response_chunk', chunk: buffer });
      response += buffer;
    } else {
      parseDebug('Warning: Stream ended with an unterminated <think> block. Content: "%s"', buffer);
      handle({ type: 'thought_chunk', chunk: buffer });
      thoughts += buffer;
    }
  }

  parseDebug('Parsing complete. Total thoughts length: %d, Total response length: %d', thoughts.length, response.length);
  return { thoughts, response };
} 