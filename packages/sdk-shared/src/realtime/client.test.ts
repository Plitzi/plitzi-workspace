import { afterEach, describe, expect, it } from 'vitest';

import { createRealtimeClient } from './client';
import { trackPresence } from './presence';

import type { RealtimeMember } from './presence';
import type { RealtimeMessage } from '../types/RealtimeTypes';

const wait = (ms = 60) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * A server in miniature: each GET is a stream the test writes events into; each POST is recorded.
 */
const fakeServer = (answer: (url: string) => number = () => 200) => {
  const streams: { url: string; push: (event: string, data: unknown) => void; end: () => void }[] = [];
  const posts: Record<string, unknown>[] = [];
  const encoder = new TextEncoder();

  const fetchImpl: typeof fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (init?.method === 'POST') {
      posts.push(JSON.parse(typeof init.body === 'string' ? init.body : '{}') as Record<string, unknown>);

      return Promise.resolve(new Response(null, { status: 204 }));
    }

    const status = answer(url);
    if (status !== 200) {
      return Promise.resolve(new Response('{}', { status }));
    }

    let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
    const body = new ReadableStream<Uint8Array>({
      start: given => {
        controller = given;
      }
    });
    streams.push({
      url,
      push: (event, data) => controller?.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)),
      end: () => controller?.close()
    });
    init?.signal?.addEventListener('abort', () => {
      try {
        controller?.close();
      } catch {
        // Already closed.
      }
    });

    return Promise.resolve(new Response(body, { status: 200 }));
  };

  return { fetchImpl, streams, posts };
};

const message = (overrides: Partial<RealtimeMessage>): RealtimeMessage => ({
  topic: 'board:1',
  type: 'cursor',
  data: null,
  from: 'other',
  at: Date.now(),
  ...overrides
});

const stops: (() => void)[] = [];
afterEach(() => stops.splice(0).forEach(stop => stop()));

describe('createRealtimeClient', () => {
  it('opens ONE connection for the topics a page listens to, and delivers each message to its topic', async () => {
    const server = fakeServer();
    const client = createRealtimeClient('/_realtime', { fetchImpl: server.fetchImpl });
    const board: RealtimeMessage[] = [];
    const chat: RealtimeMessage[] = [];
    stops.push(client.subscribe('board:1', entry => board.push(entry)));
    stops.push(client.subscribe('chat:1', entry => chat.push(entry)));
    await wait();

    expect(server.streams).toHaveLength(1);
    expect(decodeURIComponent(server.streams[0].url)).toBe('/_realtime?topics=board:1,chat:1');

    server.streams[0].push('ready', { connection: 'me', token: 'secret', topics: ['board:1', 'chat:1'], refused: [] });
    server.streams[0].push('message', message({}));
    await wait(10);

    expect(client.status).toBe('open');
    expect(client.me).toBe('me');
    expect(board).toHaveLength(1);
    expect(chat).toHaveLength(0);
  });

  it('publishes with the connection’s secret once it is open', async () => {
    const server = fakeServer();
    const client = createRealtimeClient('/_realtime', { fetchImpl: server.fetchImpl });
    stops.push(client.subscribe('board:1', () => undefined));
    const sent = client.publish('board:1', 'cursor', { x: 1 });
    await wait();
    server.streams[0].push('ready', { connection: 'me', token: 'secret', topics: ['board:1'], refused: [] });

    expect(await sent).toBe(true);
    expect(server.posts).toEqual([{ token: 'secret', topic: 'board:1', type: 'cursor', data: { x: 1 } }]);
  });

  it('holds a publish on a topic just listened to until the connection that includes it is open', async () => {
    const server = fakeServer();
    const client = createRealtimeClient('/_realtime', { fetchImpl: server.fetchImpl });
    stops.push(client.subscribe('boards', () => undefined));
    await wait();
    server.streams[0].push('ready', { connection: 'first', token: 'old', topics: ['boards'], refused: [] });
    await wait(10);

    stops.push(client.subscribe('room:1', () => undefined));
    const sent = client.publish('room:1', 'pointer', { x: 1 });
    await wait();
    server.streams[1].push('ready', { connection: 'second', token: 'new', topics: ['boards', 'room:1'], refused: [] });

    expect(await sent).toBe(true);
    expect(server.posts).toEqual([{ token: 'new', topic: 'room:1', type: 'pointer', data: { x: 1 } }]);
  });

  it('reconnects after the stream drops, and not after a refusal', async () => {
    const dropped = fakeServer();
    const client = createRealtimeClient('/_realtime', { fetchImpl: dropped.fetchImpl });
    stops.push(client.subscribe('board:1', () => undefined));
    await wait();
    dropped.streams[0].end();
    await wait(700);

    expect(dropped.streams.length).toBe(2);

    const refused = fakeServer(() => 403);
    const other = createRealtimeClient('/_realtime', { fetchImpl: refused.fetchImpl });
    stops.push(other.subscribe('chat:1', () => undefined));
    await wait(700);

    expect(other.status).toBe('closed');
    expect(other.refusal('chat:1')).toBe('http_403');
  });
});

/** A socket the test drives: what the page sent, and the frames the server answers with. */
const fakeSockets = () => {
  const opened: FakeSocket[] = [];

  class FakeSocket {
    static readonly OPEN = 1;
    readonly OPEN = 1;
    readyState = 0;
    sent: Record<string, unknown>[] = [];
    onmessage: ((event: { data: string }) => void) | null = null;
    onclose: (() => void) | null = null;

    readonly url: string;

    constructor(url: string) {
      this.url = url;
      opened.push(this);
    }

    send(frame: string) {
      this.sent.push(JSON.parse(frame) as Record<string, unknown>);
    }

    close() {
      this.readyState = 3;
    }

    /** The server's side: accept, send, drop. */
    open() {
      this.readyState = 1;
    }

    push(event: string, data: unknown) {
      this.onmessage?.({ data: JSON.stringify({ event, data }) });
    }

    drop() {
      this.readyState = 3;
      this.onclose?.();
    }
  }

  // The client reads the page's address to build the socket's.
  globalThis.location = { href: 'https://board.example/b/1' } as Location;

  return { opened, WebSocketImpl: FakeSocket as unknown as typeof WebSocket };
};

describe('createRealtimeClient over a WebSocket', () => {
  it('opens one socket on the page’s host, publishes as frames and settles each on its ack', async () => {
    const sockets = fakeSockets();
    const client = createRealtimeClient('/_realtime', { transport: 'websocket', WebSocketImpl: sockets.WebSocketImpl });
    const heard: RealtimeMessage[] = [];
    stops.push(client.subscribe('room:1', entry => heard.push(entry)));
    await wait();

    const [socket] = sockets.opened;
    expect(decodeURIComponent(socket.url)).toBe('wss://board.example/_realtime?topics=room:1');

    socket.open();
    socket.push('ready', { connection: 'me', topics: ['room:1'], refused: [] });
    socket.push('message', message({ topic: 'room:1' }));
    expect(client.transport).toBe('websocket');
    expect(heard).toHaveLength(1);

    const sent = client.publish('room:1', 'pointer', { x: 1 });
    await wait(10);
    expect(socket.sent).toEqual([{ id: 1, topic: 'room:1', type: 'pointer', data: { x: 1 } }]);
    socket.push('ack', { id: 1, ok: true, status: 204 });
    expect(await sent).toBe(true);
  });

  it('moves to the stream for good when a socket closes before it was ever ready', async () => {
    const sockets = fakeSockets();
    const server = fakeServer();
    const client = createRealtimeClient('/_realtime', {
      transport: 'websocket',
      WebSocketImpl: sockets.WebSocketImpl,
      fetchImpl: server.fetchImpl
    });
    stops.push(client.subscribe('room:1', () => undefined));
    await wait();
    sockets.opened[0].drop();
    await wait(10);

    expect(server.streams).toHaveLength(1);
    expect(client.transport).toBe('sse');
  });
});

describe('trackPresence', () => {
  it('keeps who announced themselves, drops who left, and answers a newcomer with its own state', async () => {
    const server = fakeServer();
    const client = createRealtimeClient('/_realtime', { fetchImpl: server.fetchImpl });
    let members: RealtimeMember[] = [];
    const tracker = trackPresence(client, 'board:1', next => {
      members = next;
    });
    stops.push(tracker.stop);
    await wait();
    server.streams[0].push('ready', { connection: 'me', token: 'secret', topics: ['board:1'], refused: [] });
    tracker.set({ name: 'Ana' });
    await wait(10);

    server.streams[0].push('message', message({ type: '$presence', from: 'bob', data: { name: 'Bob' } }));
    await wait(10);
    expect(members.map(member => [member.from, member.me])).toEqual([
      ['me', true],
      ['bob', false]
    ]);

    const before = server.posts.length;
    server.streams[0].push('message', message({ type: '$join', from: 'carla' }));
    await wait(10);
    expect(server.posts.slice(before)).toEqual([
      { token: 'secret', topic: 'board:1', type: '$presence', data: { name: 'Ana' } }
    ]);

    server.streams[0].push('message', message({ type: '$leave', from: 'bob' }));
    await wait(10);
    expect(members.map(member => member.from)).toEqual(['me']);
  });

  it('is one member per page: a tracker started late knows everyone, and the last one to stop leaves', async () => {
    const server = fakeServer();
    const client = createRealtimeClient('/_realtime', { fetchImpl: server.fetchImpl });
    const first = trackPresence(client, 'board:1', () => undefined);
    await wait();
    server.streams[0].push('ready', { connection: 'me', token: 'secret', topics: ['board:1'], refused: [] });
    server.streams[0].push('message', message({ type: '$presence', from: 'bob', data: { name: 'Bob' } }));
    await wait(10);

    let late: RealtimeMember[] = [];
    const second = trackPresence(client, 'board:1', next => {
      late = next;
    });
    expect(late.map(member => member.from)).toEqual(['bob']);

    first.set({ name: 'Ana' });
    expect(second.members().map(member => [member.from, member.me])).toEqual([
      ['me', true],
      ['bob', false]
    ]);

    first.stop();
    server.streams[0].push('message', message({ type: '$leave', from: 'bob' }));
    await wait(10);
    expect(late.map(member => member.from)).toEqual(['me']);
    second.stop();
  });
});
