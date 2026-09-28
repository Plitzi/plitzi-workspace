import { readRawBytes } from '../requestParser';

import type { IncomingMessage } from 'node:http';

const BODYLESS = new Set(['GET', 'HEAD']);

/** What a response is written onto: node's own, or the page server's raw one. */
export type WebResponseSink = {
  writeHead(statusCode: number, headers: Record<string, string>): unknown;
  write(chunk: Buffer): unknown;
  end(): unknown;
};

/**
 * An incoming request as a web `Request` at `url` — its headers but those named in `without` (lower case), and its
 * body read whole, within the server's body limit. What a web-standard handler takes: an MCP transport, an endpoint a
 * space runtime declares.
 */
export const webRequestOf = async (
  raw: IncomingMessage,
  url: string,
  without: readonly string[] = []
): Promise<Request> => {
  const headers = new Headers();
  Object.entries(raw.headers).forEach(([name, value]) => {
    if (name.startsWith(':') || without.includes(name)) {
      return;
    }

    (Array.isArray(value) ? value : value === undefined ? [] : [value]).forEach(one => headers.append(name, one));
  });
  const method = raw.method ?? 'GET';

  return new Request(url, {
    method,
    headers,
    ...(BODYLESS.has(method) ? {} : { body: new Uint8Array(await readRawBytes(raw)) })
  });
};

/**
 * A web `Response` written onto a node one: its status and headers, then its body as it comes — a stream too, chunk by
 * chunk, which is what an event stream needs — until it ends or `signal` says the caller went away.
 */
export const writeWebResponse = async (
  rawRes: WebResponseSink,
  response: Response,
  signal?: AbortSignal
): Promise<void> => {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, name) => {
    headers[name] = value;
  });
  rawRes.writeHead(response.status, headers);
  if (!response.body) {
    rawRes.end();

    return;
  }

  const reader = response.body.getReader();
  const stop = (): void => {
    void reader.cancel();
  };
  signal?.addEventListener('abort', stop, { once: true });
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      rawRes.write(Buffer.from(value));
    }
  } catch {
    // The reader was cancelled because the caller left, or the stream broke: either way there is nobody to tell.
  } finally {
    signal?.removeEventListener('abort', stop);
    rawRes.end();
  }
};
