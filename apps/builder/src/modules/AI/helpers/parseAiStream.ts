import type { AiStreamEvent } from '../types';

export async function* parseAiStream(reader: ReadableStreamDefaultReader<Uint8Array>): AsyncGenerator<AiStreamEvent> {
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith('data: ')) {
        continue;
      }

      try {
        yield JSON.parse(line.slice(6)) as AiStreamEvent;
      } catch {
        // skip malformed events
      }
    }
  }
}
