import { compressBody, selectEncoding } from './compress';

import type { ContentEncoding } from './compress';
import type { SSRResponseHelpers } from '@plitzi/sdk-shared';

export type RawResponse = {
  headersSent: boolean;
  setHeader(name: string, value: string | number | readonly string[]): unknown;
  getHeaders(): Record<string, string | number | readonly string[]>;
  writeHead(statusCode: number, headers?: Record<string, string | number | readonly string[]>): unknown;
  end(chunk?: string | Buffer): unknown;
};

export const buildResponseHelpers = (raw: RawResponse, acceptEncoding?: string): SSRResponseHelpers => {
  let statusCode = 200;
  const encoding: ContentEncoding = selectEncoding(acceptEncoding);

  const writeSend = (body: string) => {
    const compressed = compressBody(body, encoding);
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
    end() {
      if (!raw.headersSent) {
        raw.writeHead(statusCode);
      }
      raw.end();
    }
  };
};
