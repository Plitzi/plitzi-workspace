import { compressBody, DEFAULT_COMPRESSION, selectEncoding } from './compress';

import type { ContentEncoding, ResolvedCompression } from './compress';
import type { SSRResponseHelpers } from '@plitzi/sdk-shared';

export type RawResponse = {
  headersSent: boolean;
  /** The status actually written to the wire — the access log reads it once the response is out. */
  statusCode: number;
  setHeader(name: string, value: string | number | readonly string[]): unknown;
  getHeaders(): Record<string, string | number | readonly string[]>;
  writeHead(statusCode: number, headers?: Record<string, string | number | readonly string[]>): unknown;
  write(chunk: string | Buffer): unknown;
  end(chunk?: string | Buffer): unknown;
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

  const writeSend = (body: string) => {
    const compressed = transformable() ? compressBody(body, encoding, compression) : body;
    const isCompressed = compressed !== body;
    if (isCompressed) {
      raw.setHeader('Content-Encoding', encoding);
      raw.setHeader('Vary', 'Accept-Encoding');
    }
    raw.setHeader('Content-Length', Buffer.byteLength(compressed).toString());
    if (!raw.headersSent) {
      raw.writeHead(statusCode);
    }
    raw.end(compressed);
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
    send(body) {
      writeSend(body);
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
