import { compressBody, DEFAULT_COMPRESSION, selectEncoding } from './compress';

import type { ContentEncoding, ResolvedCompression } from './compress';
import type { CompressedBodies, SSRResponseHelpers } from '@plitzi/sdk-shared';

export type RawResponse = {
  headersSent: boolean;
  /** The status actually written to the wire — the access log reads it once the response is out. */
  statusCode: number;
  setHeader(name: string, value: string | number | readonly string[]): unknown;
  getHeaders(): Record<string, string | number | readonly string[]>;
  writeHead(statusCode: number, headers?: Record<string, string | number | readonly string[]>): unknown;
  write(chunk: string | Buffer): unknown;
  end(chunk?: string | Buffer): unknown;
  /**
   * Optional, because this type is the MINIMUM a host has to provide — node's own, http2's, or a fake in a test.
   *
   * They are how the dispatcher tells "the caller left" from "the answer was sent": a host that exposes neither
   * simply never cancels early, which is the behaviour of every host that had no such notion to begin with.
   */
  once?(event: 'close', listener: () => void): unknown;
  writableFinished?: boolean;
};

/**
 * `compressBody`, remembered in `store` when the caller keeps one: the same body in the same encoding is compressed
 * once. What comes back uncompressed (identity, or a body under the threshold) is never stored — there is nothing to
 * reuse, and a stored copy would only be the body again.
 */
const compressOnce = (
  body: string,
  encoding: ContentEncoding,
  compression: ResolvedCompression,
  store: CompressedBodies | undefined
): Buffer | string => {
  if (!store || encoding === 'identity') {
    return compressBody(body, encoding, compression);
  }

  const kept = store[encoding];
  if (kept) {
    return kept;
  }

  const compressed = compressBody(body, encoding, compression, true);
  if (typeof compressed !== 'string') {
    store[encoding] = compressed;
  }

  return compressed;
};

export const buildResponseHelpers = (
  raw: RawResponse,
  acceptEncoding?: string,
  compression: ResolvedCompression = DEFAULT_COMPRESSION
): SSRResponseHelpers => {
  let statusCode = 200;
  const encoding: ContentEncoding = selectEncoding(acceptEncoding, compression);

  /**
   * `Cache-Control: no-transform` means what it says, and this server is one of the parties it addresses.
   *
   * A stage sets it on a response whose body must reach the client byte for byte — the OAuth token endpoint above
   * all, where a credential travels beside a value the caller chose (the `scope` it echoes back). Compressing the
   * two together is the shape a BREACH-style attack needs, and the stage that knows this is the one that has
   * already said so in a header.
   */
  const transformable = (): boolean => !String(raw.getHeaders()['cache-control']).includes('no-transform');

  /** A stored form this request can take as it is, without the body it was made from. */
  const storedFor = (store: CompressedBodies | undefined): Buffer | undefined =>
    encoding === 'identity' || !transformable() ? undefined : store?.[encoding];

  const writeBody = (payload: string | Buffer, encoded: boolean) => {
    if (encoded) {
      raw.setHeader('Content-Encoding', encoding);
      raw.setHeader('Vary', 'Accept-Encoding');
    }
    raw.setHeader('Content-Length', Buffer.byteLength(payload).toString());
    if (!raw.headersSent) {
      raw.writeHead(statusCode);
    }
    raw.end(payload);
  };

  const writeSend = (content: string | Buffer | (() => string), store?: CompressedBodies) => {
    const stored = typeof content === 'function' ? storedFor(store) : undefined;
    if (stored) {
      writeBody(stored, true);

      return;
    }

    const body = typeof content === 'function' ? content() : content;
    /**
     * A Buffer goes out untouched.
     *
     * It is the only way a binary reaches the wire — this response object had `send(body: string)` and every
     * caller went through a UTF-8 round trip, which silently replaces every byte that is not valid UTF-8 and so
     * corrupts any font, image or archive served through it. What a Buffer holds is also compressed already
     * (woff2, png), so re-encoding it would cost CPU to make it bigger.
     */
    const compressed =
      typeof body === 'string' && transformable() ? compressOnce(body, encoding, compression, store) : body;
    writeBody(compressed, compressed !== body);
  };

  return {
    get status() {
      return statusCode;
    },
    get headers() {
      return raw.getHeaders() as Record<string, string>;
    },
    setHeader(name, value) {
      raw.setHeader(name, value);
    },
    setStatus(code) {
      statusCode = code;
    },
    send(body, options) {
      writeSend(body, options?.compressed);
    },
    write(chunk) {
      if (!raw.headersSent) {
        raw.writeHead(statusCode);
      }
      raw.write(chunk);
    },
    end() {
      if (!raw.headersSent) {
        raw.writeHead(statusCode);
      }
      raw.end();
    }
  };
};
