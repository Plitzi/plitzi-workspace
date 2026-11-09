import http from 'node:http';
import { gzipSync } from 'node:zlib';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocketServer } from 'ws';

import { reachSpaceInside } from './inside';

/**
 * A runtime reaching its own space from inside: its `fetch` and its `WebSocket` to the space's public host land on the
 * inside address — the ingress — with the host and the public protocol kept, and every other host is reached as before,
 * a compressed answer read as the text it is.
 */

type Seen = { host: string | undefined; proto: string | undefined; url: string | undefined };

let inside: http.Server;
let elsewhere: http.Server;
const seen: Seen[] = [];

const listen = async (server: http.Server): Promise<number> => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();

  return typeof address === 'object' && address ? address.port : 0;
};

let elsewherePort = 0;

/** Gzipped, as most of the Internet answers — what an interposed dispatcher has to leave `fetch` able to read. */
const answer = (res: http.ServerResponse, text: string): void => {
  res.writeHead(200, { 'content-type': 'text/plain', 'content-encoding': 'gzip' });
  res.end(gzipSync(text));
};

beforeAll(async () => {
  inside = http.createServer((req, res) => {
    const proto = req.headers['x-forwarded-proto'];
    seen.push({ host: req.headers.host, proto: typeof proto === 'string' ? proto : undefined, url: req.url });
    answer(res, 'inside');
  });
  new WebSocketServer({ server: inside }).on('connection', (socket, req) =>
    socket.send(`inside ${req.headers.host ?? ''}`)
  );
  elsewhere = http.createServer((_req, res) => answer(res, 'elsewhere'));
  const insidePort = await listen(inside);
  elsewherePort = await listen(elsewhere);
  await reachSpaceInside({
    publicUrl: 'https://board.example.test',
    insideUrl: `http://127.0.0.1:${String(insidePort)}`
  });
});

afterAll(async () => {
  const { Agent, setGlobalDispatcher } = await import('undici');
  setGlobalDispatcher(new Agent());
  await Promise.all([inside, elsewhere].map(server => new Promise(resolve => server.close(resolve))));
});

describe('reachSpaceInside', () => {
  it('sends a request to the space’s public host to the inside address, host and protocol kept', async () => {
    const answer = await fetch('https://board.example.test/_action?q=1', { method: 'POST', body: '{}' });

    expect(await answer.text()).toBe('inside');
    expect(seen.at(-1)).toEqual({ host: 'board.example.test', proto: 'https', url: '/_action?q=1' });
  });

  it('opens a socket to the space the same way', async () => {
    const socket = new WebSocket('wss://board.example.test/_realtime');
    const heard = await new Promise<unknown>((resolve, reject) => {
      socket.onmessage = event => resolve(event.data);
      socket.onerror = () => reject(new Error('the socket did not open'));
    });
    socket.close();

    expect(heard).toBe('inside board.example.test');
  });

  it('reaches any other host as before', async () => {
    expect(await (await fetch(`http://127.0.0.1:${String(elsewherePort)}/`)).text()).toBe('elsewhere');
  });

  it('refuses an inside address that is not plain HTTP', async () => {
    await expect(reachSpaceInside({ publicUrl: 'https://a.test', insideUrl: 'https://ingress.test' })).rejects.toThrow(
      'plain HTTP'
    );
  });
});
