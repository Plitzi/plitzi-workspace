import type { Http2ServerResponse } from 'node:http2';
import type { ServerResponse } from 'node:http';
import type { SSRResponseHelpers } from '../types';

/**
 * Wrap a raw Node.js HTTP/1 or HTTP/2 response into the thin
 * `SSRResponseHelpers` interface used throughout the server.
 */
export const buildResponseHelpers = (raw: Http2ServerResponse | ServerResponse): SSRResponseHelpers => {
  let statusCode = 200;

  const helpers: SSRResponseHelpers = {
    get status() {
      return statusCode;
    },
    get headers() {
      // Return already-set response headers as a plain object.
      return raw.getHeaders() as Record<string, string>;
    },
    setHeader(name, value) {
      raw.setHeader(name, value);
    },
    setStatus(code) {
      statusCode = code;
    },
    send(body) {
      if (!raw.headersSent) {
        raw.writeHead(statusCode);
      }
      raw.end(body);
    },
    end() {
      if (!raw.headersSent) {
        raw.writeHead(statusCode);
      }
      raw.end();
    }
  };

  return helpers;
};
