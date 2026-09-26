import { STATUS_CODES } from 'node:http';

import type { RawResponse } from '../../helpers/buildResponseHelpers';
import type { Duplex } from 'node:stream';

/** A request asking to switch protocols, as the transport handed it over: the raw socket, and what was read past the headers. */
export type UpgradeRequest = {
  socket: Duplex;
  head: Buffer;
  /** Set by the stage that switched protocols: from then on the socket is its connection, not an HTTP response. */
  taken: boolean;
};

type HeaderValue = string | number | readonly string[];

/**
 * An HTTP response written straight to a socket — what an upgrade request gets when it is NOT upgraded.
 *
 * An upgrade arrives with no `ServerResponse`: node hands over the socket and expects whoever listens to speak for
 * it. Every stage of the pipeline writes to a `RawResponse`, so this is one: a refusal (a 403, a 404, a redirect)
 * reaches the client as the stage wrote it, and the socket closes after it — a connection that asked to switch
 * protocols and was answered in HTTP has nothing left to say.
 */
export const socketResponse = (socket: Duplex): RawResponse => {
  const headers: Record<string, HeaderValue> = {};
  const body: Buffer[] = [];
  let statusCode = 200;
  let headersSent = false;
  let finished = false;

  const flush = (): void => {
    if (finished) {
      return;
    }

    finished = true;
    headersSent = true;
    const payload = Buffer.concat(body);
    const lines = Object.entries({ ...headers, Connection: 'close', 'Content-Length': payload.length }).flatMap(
      ([name, value]) => (Array.isArray(value) ? value : [value]).map(entry => `${name}: ${String(entry)}`)
    );
    const head = `HTTP/1.1 ${statusCode} ${STATUS_CODES[statusCode] ?? ''}\r\n${lines.join('\r\n')}\r\n\r\n`;
    socket.end(Buffer.concat([Buffer.from(head), payload]));
  };

  return {
    get headersSent() {
      return headersSent;
    },
    get statusCode() {
      return statusCode;
    },
    get writableFinished() {
      return finished;
    },
    setHeader: (name, value) => {
      headers[name] = value;
    },
    getHeaders: () => ({ ...headers }),
    writeHead: (code, extra) => {
      statusCode = code;
      Object.assign(headers, extra);
    },
    write: chunk => {
      body.push(Buffer.from(chunk));
    },
    end: chunk => {
      if (chunk !== undefined) {
        body.push(Buffer.from(chunk));
      }

      flush();
    },
    once: (_event, listener) => socket.once('close', listener)
  };
};
