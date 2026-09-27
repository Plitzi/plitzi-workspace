import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';

import { createJsonAdapters } from '../../adapters/jsonAdapters';
import { createServer } from '../../core/createServer';

import type { ChannelDeclarations, OfflineDataRaw, SSRServer } from '@plitzi/sdk-shared';

/**
 * The WebSocket transport through the server a deployment gets: an upgrade on a listening port, through the same
 * pipeline — space, auth, channels — the stream goes through.
 */

const PORT = 39314;
const BASE = `127.0.0.1:${PORT}`;

const channels: ChannelDeclarations = {
  'room:{id}': { access: { mode: 'public' }, presence: true, maxMessageBytes: 64 },
  'board:{id}': { access: { mode: 'public' }, publish: 'server' },
  'members:{id}': { access: { mode: 'session' } }
};

const offlineData = {
  schema: {
    flat: {
      home: {
        id: 'home',
        attributes: { slug: '', folder: '', default: true },
        definition: { type: 'page', label: 'home', rootId: 'root', items: [], styleSelectors: { base: '' } }
      }
    },
    pages: ['home'],
    pageFolders: [],
    definition: { name: 'test', permanentUrl: 'test' },
    variables: [],
    settings: { customCss: '', channels }
  },
  style: { cache: '' }
} as unknown as OfflineDataRaw;

type Frame = { event: string; data: Record<string, unknown> };

/** A socket and every frame it heard, once it is open — or the status it was refused with. */
const open = (topics: string, headers: Record<string, string> = {}, path = '/_realtime') =>
  new Promise<{ socket: WebSocket; frames: Frame[] } | { refused: number }>(resolve => {
    const socket = new WebSocket(`ws://${BASE}${path}?topics=${encodeURIComponent(topics)}`, { headers });
    const frames: Frame[] = [];
    // Every frame the server sends is one text message, which `ws` hands over as a single Buffer.
    socket.on('message', (data: Buffer) => {
      frames.push(JSON.parse(data.toString('utf8')) as Frame);
      if (frames.length === 1) {
        resolve({ socket, frames });
      }
    });
    socket.on('unexpected-response', (_request, response) => resolve({ refused: response.statusCode ?? 0 }));
  });

const opened = async (topics: string, headers?: Record<string, string>) => {
  const result = await open(topics, headers);
  if ('refused' in result) {
    throw new Error(`refused with ${result.refused}`);
  }

  return result;
};

let server: SSRServer;

beforeAll(async () => {
  server = createServer({
    port: PORT,
    adapters: createJsonAdapters({ offlineData, deployment: { spaceId: 1, environment: 'main', revision: 0 } }),
    realtime: { transport: 'websocket', allowedOrigins: ['https://allowed.example'] }
  });
  server.listen(PORT, '127.0.0.1');
  await vi.waitFor(async () => {
    expect((await fetch(`http://${BASE}/health`)).status).toBeLessThan(500);
  });
});

afterAll(async () => {
  await server.close();
});

describe('realtime over a WebSocket', () => {
  it('opens what may be opened, reports the rest, and carries publishes both ways as frames', async () => {
    const alice = await opened('room:1,members:1');
    const bob = await opened('room:1');

    expect(alice.frames[0]).toMatchObject({
      event: 'ready',
      data: { topics: ['room:1'], refused: [{ topic: 'members:1', reason: 'unauthenticated' }] }
    });
    expect(alice.frames[0].data).not.toHaveProperty('token');

    alice.socket.send(JSON.stringify({ id: 7, topic: 'room:1', type: 'pointer', data: { x: 1 } }));
    await vi.waitFor(() => {
      expect(bob.frames.some(frame => frame.event === 'message' && frame.data.type === 'pointer')).toBe(true);
    });
    const heard = bob.frames.find(frame => frame.data.type === 'pointer');
    expect(heard?.data).toMatchObject({ from: alice.frames[0].data.connection, data: { x: 1 } });
    await vi.waitFor(() => {
      expect(alice.frames.find(frame => frame.event === 'ack')?.data).toEqual({ id: 7, ok: true, status: 204 });
    });

    alice.socket.close();
    bob.socket.close();
  });

  it('answers a refused publish on its ack, with the reason the stream would give', async () => {
    const page = await opened('room:1,board:1');
    page.socket.send(JSON.stringify({ id: 1, topic: 'board:1', type: 'x', data: 1 }));
    page.socket.send(JSON.stringify({ id: 2, topic: 'room:1', type: 'x', data: 'y'.repeat(200) }));
    await vi.waitFor(() => {
      expect(page.frames.filter(frame => frame.event === 'ack').map(frame => frame.data)).toEqual([
        { id: 1, ok: false, status: 403, reason: 'server_only' },
        { id: 2, ok: false, status: 413, reason: 'too_large' }
      ]);
    });
    page.socket.close();
  });

  it('refuses a page on another site, and lets the ones the deployment lists in', async () => {
    expect(await open('room:1', { origin: 'https://evil.example' })).toEqual({ refused: 403 });
    const listed = await opened('room:1', { origin: 'https://allowed.example' });
    expect(listed.frames[0].event).toBe('ready');
    listed.socket.close();
  });

  it('refuses in HTTP what the stream refuses, and any upgrade that is not the realtime endpoint', async () => {
    expect(await open('chat:1')).toEqual({ refused: 403 });
    expect(await open('room:1', {}, '/')).toEqual({ refused: 404 });
  });

  it('tells a page which transport to use', async () => {
    const html = await (await fetch(`http://${BASE}/`)).text();

    expect(html).toContain('"realtimeTransport":"websocket"');
  });
});
