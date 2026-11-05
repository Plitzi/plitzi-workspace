import http from 'node:http';
import net from 'node:net';

import { describe, expect, it } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';

import { watchConnections } from './drain';

import type { AddressInfo } from 'node:net';

/** A server on a free port, answering with `handler`, its connections watched from the start. */
const serve = async (handler: http.RequestListener) => {
  const server = http.createServer(handler);
  const connections = watchConnections(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return { server, connections, url: `http://127.0.0.1:${port}` };
};

const elapsed = async (work: Promise<unknown>): Promise<number> => {
  const started = Date.now();
  await work;

  return Date.now() - started;
};

describe('watchConnections().drain', () => {
  it('ends an event stream at once, rather than waiting for a page that never leaves', async () => {
    // Its headers written the way most streams write them — `writeHead`, which `getHeader` does not see.
    const { connections, url } = await serve((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write('event: ready\ndata: {}\n\n');
    });
    const stream = await fetch(url, { headers: { accept: 'text/event-stream' } });
    const ended = stream.text();

    expect(await elapsed(connections.drain('test', 5000))).toBeLessThan(1000);
    await expect(ended).resolves.toContain('event: ready');
  });

  it('lets a request that is being answered finish, and closes its connection once it has', async () => {
    let received: () => void = () => undefined;
    const arrived = new Promise<void>(resolve => {
      received = resolve;
    });
    const { connections, url } = await serve((_req, res) => {
      received();
      setTimeout(() => res.end('done'), 150);
    });
    const answer = fetch(url).then(response => response.text());
    // Drained before the request reached the handler, its connection is idle, and closing it is right.
    await arrived;

    // Not the seconds the client would keep the connection alive for.
    expect(await elapsed(connections.drain('test', 5000))).toBeLessThan(1000);
    expect(await answer).toBe('done');
  });

  it('closes a WebSocket at once, telling its client the server is going away', async () => {
    const { server, connections, url } = await serve(() => undefined);
    const sockets = new WebSocketServer({ noServer: true });
    server.on('upgrade', (request, socket, head) => {
      sockets.handleUpgrade(request, socket, head, () => undefined);
    });
    const client = new WebSocket(url.replace('http', 'ws'));
    await new Promise<void>(resolve => client.once('open', () => resolve()));
    const closed = new Promise<number>(resolve => client.once('close', code => resolve(code)));

    expect(await elapsed(connections.drain('test', 5000))).toBeLessThan(1000);
    expect(await closed).toBe(1001);
    sockets.close();
  });

  it('cuts what is still open once the grace runs out', async () => {
    let received: () => void = () => undefined;
    const arrived = new Promise<void>(resolve => {
      received = resolve;
    });
    const { connections, url } = await serve(() => {
      received();
    });
    const { port } = new URL(url);
    const socket = net.connect(Number(port), '127.0.0.1');
    const closed = new Promise<void>(resolve => socket.once('close', () => resolve()));
    // A request that is never answered: a handler that holds it, as a socket that switched protocols is held.
    socket.write('GET / HTTP/1.1\r\nhost: localhost\r\n\r\n');
    await arrived;

    const took = await elapsed(connections.drain('test', 200));

    expect(took).toBeGreaterThanOrEqual(150);
    expect(took).toBeLessThan(2000);
    await closed;
  });
});
