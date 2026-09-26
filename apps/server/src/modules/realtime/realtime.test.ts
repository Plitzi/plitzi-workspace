import { describe, expect, it } from 'vitest';

import { createChannelResolver } from './declarations';
import { handleRealtimePublish, handleRealtimeSubscribe } from './handlers';
import { createRealtimeHub } from './hub';
import { realtimeModuleFor } from './index';
import { createMemoryPubSub } from './memoryPubSub';

import type { RealtimeHub } from './hub';
import type {
  ChannelDeclarations,
  OfflineDataRaw,
  RealtimeMessage,
  SSRRequest,
  SSRResponseHelpers,
  SSRServerConfig,
  SSRUser
} from '@plitzi/sdk-shared';

const CHANNELS: ChannelDeclarations = {
  'board:{id}': { access: { mode: 'public' }, presence: true, maxMessageBytes: 64, messagesPerSecond: 2 },
  'members:{id}': { access: { mode: 'session' } },
  'scores:{id}': { access: { mode: 'public' }, publish: 'server' }
};

/** The documents a space with these channels answers — only the part the resolver reads is real. */
const resolverFor = (channels: ChannelDeclarations) =>
  createChannelResolver(() =>
    Promise.resolve({ schema: { settings: { channels } }, style: {} } as unknown as OfflineDataRaw)
  );

/** A raw response a stream writes into: the events a page would have received, parsed. */
const buildRaw = () => {
  const written: string[] = [];
  const raw = {
    headersSent: false,
    statusCode: 200,
    setHeader: () => undefined,
    getHeaders: () => ({}),
    writeHead() {
      this.headersSent = true;

      return undefined;
    },
    write: (chunk: string) => {
      written.push(chunk);

      return undefined;
    },
    end: () => undefined
  };
  const events = (): { event: string; data: unknown }[] =>
    written
      .filter(chunk => chunk.startsWith('event: '))
      .map(chunk => {
        const [eventLine, dataLine] = chunk.split('\n');

        return { event: eventLine.slice(7), data: JSON.parse(dataLine.slice(6)) as unknown };
      });

  return { raw, events };
};

const buildRes = () => {
  const sent = { status: 200, body: '' };
  const res: SSRResponseHelpers = {
    status: 200,
    headers: {},
    setHeader: () => undefined,
    setStatus: code => {
      sent.status = code;
    },
    send: body => {
      sent.body = typeof body === 'string' ? body : body.toString('utf-8');
    },
    write: () => undefined,
    end: () => undefined
  };

  return { res, sent };
};

const request = (query: Record<string, string>, user?: Partial<SSRUser>, body?: unknown): SSRRequest =>
  ({
    method: 'GET',
    path: '/_realtime',
    query,
    headers: {},
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    ctx: { spaceDeployment: { spaceId: 1, environment: 'main', revision: 0 }, ...(user ? { user } : {}) }
  }) as unknown as SSRRequest;

/** A page connected to `topics`: its `ready` event, what it hears, and how to close it. */
const connect = async (hub: RealtimeHub, topics: string, user?: Partial<SSRUser>) => {
  const { raw, events } = buildRaw();
  const { res, sent } = buildRes();
  const controller = new AbortController();
  const done = handleRealtimeSubscribe({
    req: request({ topics }, user),
    res,
    raw,
    signal: controller.signal,
    hub,
    resolveChannels: resolverFor(CHANNELS)
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  const ready = events().find(entry => entry.event === 'ready')?.data as
    { connection: string; token: string; topics: string[]; refused: { topic: string; reason: string }[] } | undefined;
  const heard = (): RealtimeMessage[] =>
    events()
      .filter(entry => entry.event === 'message')
      .map(entry => entry.data as RealtimeMessage);

  return { ready, heard, sent, close: async () => (controller.abort(), done) };
};

const publish = async (hub: RealtimeHub, body: Record<string, unknown>) => {
  const { res, sent } = buildRes();
  await handleRealtimePublish({ req: request({}, undefined, body), res, hub });

  return sent.status;
};

describe('createMemoryPubSub', () => {
  it('delivers to every subscriber of a topic until each unsubscribes', async () => {
    const pubsub = createMemoryPubSub();
    const heard: string[] = [];
    const stop = await pubsub.subscribe('t', message => heard.push(`a:${message}`));
    await pubsub.subscribe('t', message => heard.push(`b:${message}`));
    await pubsub.publish('t', 'one');
    await stop();
    await pubsub.publish('t', 'two');
    await pubsub.publish('other', 'three');

    expect(heard).toEqual(['a:one', 'b:one', 'b:two']);
  });
});

describe('realtime channels', () => {
  it('opens the declared topics a visitor may, and reports the rest', async () => {
    const hub = createRealtimeHub(createMemoryPubSub());
    const page = await connect(hub, 'board:1,members:1,chat:1');

    expect(page.ready?.topics).toEqual(['board:1']);
    expect(page.ready?.refused).toEqual([
      { topic: 'members:1', reason: 'unauthenticated' },
      { topic: 'chat:1', reason: 'undeclared' }
    ]);
    await page.close();
  });

  it('refuses a connection none of whose topics may be opened', async () => {
    const hub = createRealtimeHub(createMemoryPubSub());
    const page = await connect(hub, 'chat:1');

    expect(page.sent.status).toBe(403);
    expect(page.ready).toBeUndefined();
  });

  it('stamps what a page publishes with who sent it, and delivers it to everyone on the topic', async () => {
    const hub = createRealtimeHub(createMemoryPubSub());
    const alice = await connect(hub, 'board:1');
    const bob = await connect(hub, 'board:1');
    const elsewhere = await connect(hub, 'board:2');

    const status = await publish(hub, {
      token: alice.ready?.token,
      topic: 'board:1',
      type: 'cursor',
      data: { x: 1 },
      from: 'somebody-else'
    });

    expect(status).toBe(204);
    const message = bob.heard().find(entry => entry.type === 'cursor');
    expect(message).toMatchObject({ topic: 'board:1', type: 'cursor', data: { x: 1 }, from: alice.ready?.connection });
    expect(elsewhere.heard().some(entry => entry.type === 'cursor')).toBe(false);
    await Promise.all([alice.close(), bob.close(), elsewhere.close()]);
  });

  it('refuses a publish that is not the connection’s, too big, too fast, or on a server channel', async () => {
    const hub = createRealtimeHub(createMemoryPubSub());
    const page = await connect(hub, 'board:1,scores:1');
    const token = page.ready?.token;

    expect(await publish(hub, { token: 'forged', topic: 'board:1', type: 'x', data: 1 })).toBe(401);
    expect(await publish(hub, { token, topic: 'board:9', type: 'x', data: 1 })).toBe(403);
    expect(await publish(hub, { token, topic: 'scores:1', type: 'x', data: 1 })).toBe(403);
    expect(await publish(hub, { token, topic: 'board:1', type: '$leave', data: 1 })).toBe(422);
    expect(await publish(hub, { token, topic: 'board:1', type: 'x', data: 'y'.repeat(100) })).toBe(413);
    expect(await publish(hub, { token, topic: 'board:1', type: 'x', data: 1 })).toBe(204);
    expect(await publish(hub, { token, topic: 'board:1', type: 'x', data: 1 })).toBe(204);
    expect(await publish(hub, { token, topic: 'board:1', type: 'x', data: 1 })).toBe(429);
    await page.close();
  });

  it('tells a presence channel who arrived, and who left once they had announced themselves', async () => {
    const hub = createRealtimeHub(createMemoryPubSub());
    const alice = await connect(hub, 'board:1');
    const bob = await connect(hub, 'board:1');

    expect(
      alice
        .heard()
        .filter(entry => entry.type === '$join')
        .map(entry => entry.from)
    ).toContain(bob.ready?.connection);
    expect(
      await publish(hub, { token: bob.ready?.token, topic: 'board:1', type: '$presence', data: { name: 'Bob' } })
    ).toBe(204);
    await bob.close();

    expect(
      alice
        .heard()
        .filter(entry => entry.type === '$leave')
        .map(entry => entry.from)
    ).toEqual([bob.ready?.connection]);
    await alice.close();
  });

  it('keeps one adapter subscription per topic, however many pages share it', async () => {
    const hub = createRealtimeHub(createMemoryPubSub());
    const pages = await Promise.all([connect(hub, 'board:1'), connect(hub, 'board:1'), connect(hub, 'board:2')]);

    expect(hub.topicCount).toBe(2);
    await Promise.all(pages.map(page => page.close()));
    expect(hub.topicCount).toBe(0);
  });
});

describe('realtimeModuleFor', () => {
  it('publishes from the server on a declared topic only, as `server`', async () => {
    const config = {
      adapters: {
        getOfflineData: () =>
          Promise.resolve({ schema: { settings: { channels: CHANNELS } }, style: {} } as unknown as OfflineDataRaw)
      }
    } as unknown as SSRServerConfig;
    const realtime = realtimeModuleFor(config);
    if (!realtime) {
      throw new Error('expected a realtime module');
    }

    const page = await connect(realtime.hub, 'scores:1');
    await realtime.publish({ spaceId: 1, environment: 'main' }, 'scores:1', 'score', { points: 3 });

    expect(page.heard().find(entry => entry.type === 'score')).toMatchObject({ from: 'server', data: { points: 3 } });
    await expect(realtime.publish({ spaceId: 1, environment: 'main' }, 'chat:1', 'x', 1)).rejects.toThrow(
      'No channel of this space matches "chat:1"'
    );
    await page.close();
  });

  it('is off when the config turns it off', () => {
    expect(
      realtimeModuleFor({
        adapters: { getOfflineData: () => Promise.resolve(undefined) },
        realtime: false
      } as unknown as SSRServerConfig)
    ).toBeUndefined();
  });
});
