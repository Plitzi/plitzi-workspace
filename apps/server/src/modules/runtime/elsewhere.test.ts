import { readFileSync } from 'node:fs';
import http2 from 'node:http2';
import path from 'node:path';
import { brotliCompressSync } from 'node:zlib';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { reachOwnServer, reachSpaceInside } from './inside';

/**
 * What either dispatcher does to every OTHER host: nothing. The process's `fetch` is Node's, which speaks HTTP/1.1 and
 * decodes what it is sent; an undici connector negotiates HTTP/2 by default, and through Node's `fetch` an answer that
 * came back over h2 lost its `content-encoding` — every API that compresses (nearly all) read as Brotli bytes. Here an
 * h2-capable server answering in Brotli stands for them. The fixture certificate is self-signed, so this file trusts
 * any while it runs.
 */

const fixture = (name: string): Buffer => readFileSync(path.join(import.meta.dirname, '__fixtures__', name));

const body = JSON.stringify([{ place: 'Bilbao' }]);
let server: http2.Http2SecureServer;
let origin = '';
const rejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED;

beforeAll(async () => {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  server = http2.createSecureServer(
    { key: fixture('other.key'), cert: fixture('other.crt'), allowHTTP1: true },
    (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json', 'content-encoding': 'br' });
      res.end(brotliCompressSync(body));
    }
  );
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  origin = `https://localhost:${String(typeof address === 'object' && address ? address.port : 0)}`;
});

afterEach(async () => {
  const { Agent, setGlobalDispatcher } = await import('undici');
  setGlobalDispatcher(new Agent());
});

afterAll(async () => {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = rejectUnauthorized;
  await new Promise(resolve => server.close(resolve));
});

describe('another host, past a dispatcher for the space’s own address', () => {
  it('reads a compressed answer as the text it is, past reachOwnServer', async () => {
    await reachOwnServer({
      publicUrl: 'https://192.0.2.10:8443',
      listener: { host: '127.0.0.1', port: 8443 },
      cert: fixture('own.crt')
    });

    expect(await (await fetch(origin)).text()).toBe(body);
  });

  it('reads a compressed answer as the text it is, past reachSpaceInside', async () => {
    await reachSpaceInside({ publicUrl: 'https://board.example.test', insideUrl: 'http://127.0.0.1:65531' });

    expect(await (await fetch(origin)).text()).toBe(body);
  });
});
