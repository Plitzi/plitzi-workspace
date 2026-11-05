import type { RawData } from 'ws';

/** A WebSocket frame as text, whichever of its three shapes `ws` delivered it in. */
export const frameText = (frame: RawData): string =>
  Buffer.isBuffer(frame)
    ? frame.toString('utf8')
    : Array.isArray(frame)
      ? Buffer.concat(frame).toString('utf8')
      : Buffer.from(frame).toString('utf8');
