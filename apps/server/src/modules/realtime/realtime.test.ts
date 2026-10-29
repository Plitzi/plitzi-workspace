import { describe, expect, it, vi } from 'vitest';

import { createActionsModule } from '../actions';
import { createChannelResolver } from './declarations';
import { createRealtimeGrants } from './grants';
import { handleRealtimePublish, handleRealtimeSubscribe } from './handlers';
import { createRealtimeHub } from './hub';
import { realtimeModuleFor } from './index';
import { createMemoryPubSub } from './memoryPubSub';
import { createRealtimePresence } from './presence';
import { createRealtimeRetained } from './retained';
import { createMemoryKv } from '../actions/runtime/memoryKv';

import type { RealtimeGrants } from './grants';
import type { RealtimeHub } from './hub';
import type {
  ChannelDeclarations,
  ElementInteraction,
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
  'scores:{id}': { access: { mode: 'public' }, publish: 'server' },
  'room:{id}': { access: { mode: 'public' }, grant: true, presence: true },
  'desk:{id}': { access: { mode: 'public' }, publish: 'server', retain: true }
};

/** The grants every page of these tests is checked against, as a server keeps them. */
const GRANTS = createRealtimeGrants(createMemoryKv());

const SPACE = { spaceId: 1, environment: 'main' };

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

const request = (
  query: Record<string, string>,
  user?: Partial<SSRUser>,
  body?: unknown,
  headers: Record<string, string> = {}
): SSRRequest =>
  ({
    method: 'GET',
    path: '/_realtime',
    query,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    ctx: { spaceDeployment: { spaceId: 1, environment: 'main', revision: 0 }, ...(user ? { user } : {}) }
  }) as unknown as SSRRequest;

/** A page connected to `topics`: its `ready` event, what it hears, and how to close it. */
const connect = async (
  hub: RealtimeHub,
  topics: string,
  user?: Partial<SSRUser>,
  grants?: string,
  store: RealtimeGrants = GRANTS,
  headers?: Record<string, string>
) => {
  const { raw, events } = buildRaw();
  const { res, sent } = buildRes();
  const controller = new AbortController();
  const done = handleRealtimeSubscribe({
    req: request({ topics, ...(grants === undefined ? {} : { grants }) }, user, undefined, headers),
    res,
    raw,
    signal: controller.signal,
    hub,
    resolveChannels: resolverFor(CHANNELS),
    grants: store
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  const ready = events().find(entry => entry.event === 'ready')?.data as
    { connection: string; token: string; topics: string[]; refused: { topic: string; reason: string }[] } | undefined;
  const heard = (): RealtimeMessage[] =>
    events()
      .filter(entry => entry.event === 'message')
      .map(entry => entry.data as RealtimeMessage);

  return { ready, heard, sent, done, close: async () => (controller.abort(), done) };
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
    const hub = createRealtimeHub(createMemoryPubSub(), createRealtimeRetained(createMemoryKv()));
    const page = await connect(hub, 'board:1,members:1,chat:1');

    expect(page.ready?.topics).toEqual(['board:1']);
    expect(page.ready?.refused).toEqual([
      { topic: 'members:1', reason: 'unauthenticated' },
      { topic: 'chat:1', reason: 'undeclared' }
    ]);
    await page.close();
  });

  it('closes every connection it holds when the server shuts down', async () => {
    const hub = createRealtimeHub(createMemoryPubSub(), createRealtimeRetained(createMemoryKv()));
    const alice = await connect(hub, 'board:1');
    const bob = await connect(hub, 'board:1');

    expect(hub.connectionCount).toBe(2);

    hub.closeAll();
    await Promise.all([alice.done, bob.done]);

    expect(hub.connectionCount).toBe(0);
    expect(hub.topicCount).toBe(0);
  });

  it('refuses a connection none of whose topics may be opened', async () => {
    const hub = createRealtimeHub(createMemoryPubSub(), createRealtimeRetained(createMemoryKv()));
    const page = await connect(hub, 'chat:1');

    expect(page.sent.status).toBe(403);
    expect(page.ready).toBeUndefined();
  });

  it('stamps what a page publishes with who sent it, and delivers it to everyone on the topic', async () => {
    const hub = createRealtimeHub(createMemoryPubSub(), createRealtimeRetained(createMemoryKv()));
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

  /** The sender asked to hear it too: every page reads the mark, the sender knows it for its own by `from`. */
  it('carries a publish’s echo, and never a presence’s', async () => {
    const hub = createRealtimeHub(createMemoryPubSub(), createRealtimeRetained(createMemoryKv()));
    const alice = await connect(hub, 'board:1');

    await publish(hub, { token: alice.ready?.token, topic: 'board:1', type: 'react', data: null, echo: true });
    await publish(hub, { token: alice.ready?.token, topic: 'board:1', type: '$presence', data: {}, echo: true });

    expect(alice.heard().find(entry => entry.type === 'react')).toMatchObject({ echo: true });
    expect(alice.heard().find(entry => entry.type === '$presence')).not.toHaveProperty('echo');
    await alice.close();
  });

  it('refuses a publish that is not the connection’s, too big, too fast, or on a server channel', async () => {
    const hub = createRealtimeHub(createMemoryPubSub(), createRealtimeRetained(createMemoryKv()));
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

  // Redis timing out under load: the stream still opens, and a publish is told to send it again, as a WebSocket's ack is.
  it('answers a publish the pub/sub could not deliver with a 503', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const hub = createRealtimeHub(
      { ...createMemoryPubSub(), publish: () => Promise.reject(new Error('Command timed out')) },
      createRealtimeRetained(createMemoryKv())
    );
    const page = await connect(hub, 'board:1');
    const { res, sent } = buildRes();
    await handleRealtimePublish({
      req: request({}, undefined, { token: page.ready?.token, topic: 'board:1', type: 'x', data: 1 }),
      res,
      hub
    });

    expect(sent.status).toBe(503);
    expect(JSON.parse(sent.body)).toMatchObject({ reason: 'unavailable' });
    await page.close();
    warn.mockRestore();
  });

  it('tells a presence channel who arrived, and who left once they had announced themselves', async () => {
    const hub = createRealtimeHub(createMemoryPubSub(), createRealtimeRetained(createMemoryKv()));
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

  /** `page check` on a live site: it hears the room, and nobody in the room hears it. */
  it('lets a page that watches hear its topics, and never arrive or speak on them', async () => {
    const hub = createRealtimeHub(createMemoryPubSub(), createRealtimeRetained(createMemoryKv()));
    const alice = await connect(hub, 'board:1');
    const check = await connect(hub, 'board:1', undefined, undefined, GRANTS, { cookie: 'plitzi-observer=1' });

    expect(
      await publish(hub, { token: check.ready?.token, topic: 'board:1', type: '$presence', data: { name: 'Check' } })
    ).toBe(204);
    expect(await publish(hub, { token: check.ready?.token, topic: 'board:1', type: 'react', data: null })).toBe(204);
    expect(await publish(hub, { token: alice.ready?.token, topic: 'board:1', type: 'react', data: null })).toBe(204);
    await check.close();

    expect(alice.heard().filter(entry => entry.from === check.ready?.connection)).toEqual([]);
    expect(check.heard().map(entry => entry.from)).toContain(alice.ready?.connection);
    await alice.close();
  });

  it('keeps one adapter subscription per topic, however many pages share it', async () => {
    const hub = createRealtimeHub(createMemoryPubSub(), createRealtimeRetained(createMemoryKv()));
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

// A deployment may keep a space's channels shut — a plan that does not include them — and the page is told why.
describe('a space the deployment does not open', () => {
  it('refuses its declared topics with the deployment’s words, as a 402', async () => {
    const hub = createRealtimeHub(createMemoryPubSub(), createRealtimeRetained(createMemoryKv()));
    const { raw } = buildRaw();
    const { res, sent } = buildRes();
    const asked: number[] = [];

    await handleRealtimeSubscribe({
      req: request({ topics: 'board:1' }),
      res,
      raw,
      signal: new AbortController().signal,
      hub,
      resolveChannels: resolverFor(CHANNELS),
      grants: GRANTS,
      admitSpace: spaceId => {
        asked.push(spaceId);

        return Promise.resolve('Realtime channels are included in the App plan and above.');
      }
    });

    expect(asked).toEqual([SPACE.spaceId]);
    expect(sent.status).toBe(402);
    expect(JSON.parse(sent.body)).toEqual({
      error: 'Realtime channels are included in the App plan and above.',
      reason: 'unavailable',
      refused: [{ topic: 'board:1', reason: 'unavailable' }]
    });
  });
});

describe('granted channels', () => {
  it('refuses a topic of a `grant: true` channel to a page that brings no grant, however well it knows the name', async () => {
    const hub = createRealtimeHub(createMemoryPubSub(), createRealtimeRetained(createMemoryKv()));
    const page = await connect(hub, 'room:alpha,board:1');

    expect(page.ready?.topics).toEqual(['board:1']);
    expect(page.ready?.refused).toEqual([{ topic: 'room:alpha', reason: 'ungranted' }]);
    await page.close();
  });

  it('opens it with a grant issued for that topic, and for no other', async () => {
    const hub = createRealtimeHub(createMemoryPubSub(), createRealtimeRetained(createMemoryKv()));
    const grant = await GRANTS.issue(SPACE, 'room:alpha');
    const invited = await connect(hub, 'room:alpha', undefined, grant);
    const elsewhere = await connect(hub, 'room:beta', undefined, grant);

    expect(invited.ready?.topics).toEqual(['room:alpha']);
    expect(elsewhere.sent.status).toBe(403);
    await invited.close();
  });

  it('takes a grant only for the space that issued it', async () => {
    const grant = await GRANTS.issue({ spaceId: 2, environment: 'main' }, 'room:alpha');

    expect(await GRANTS.opens(SPACE, 'room:alpha', grant)).toBe(false);
    expect(await GRANTS.opens({ spaceId: 2, environment: 'main' }, 'room:alpha', grant)).toBe(true);
  });

  it('forgets a grant once its lifetime runs out', async () => {
    const kv = createMemoryKv();
    const grants = createRealtimeGrants(kv);
    const grant = await grants.issue(SPACE, 'room:alpha', 60);
    await kv.expire(`realtime-grant:1:main:${grant}`, 0);

    expect(await grants.opens(SPACE, 'room:alpha', grant)).toBe(false);
  });

  it('issues a grant only for a channel that takes one', async () => {
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

    const grant = await realtime.grant(SPACE, 'room:alpha', 600);

    expect(await realtime.grants.opens(SPACE, 'room:alpha', grant)).toBe(true);
    await expect(realtime.grant(SPACE, 'board:1')).rejects.toThrow('takes no grant');
    await expect(realtime.grant(SPACE, 'nowhere:1')).rejects.toThrow('No channel of this space');
  });

  it('hands a flow’s visitor the grant their page opens the topic with', async () => {
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

    const actions = createActionsModule({ lookups: { getAction: () => Promise.resolve(undefined) }, realtime });
    const step = (id: string, action: string, params: Record<string, unknown>, afterNode = ''): ElementInteraction => ({
      id,
      title: id,
      type: id === 'start' ? 'trigger' : 'task',
      action,
      params,
      preview: {},
      elementId: null,
      beforeNode: '',
      afterNode,
      flowId: 'flow',
      enabled: true
    });
    const result = await actions.runAction({
      entry: {
        id: 'join',
        document: {
          name: 'Join',
          output: { grant: { type: 'text' } },
          nodes: {
            start: step('start', 'call', { access: 'public' }, 'let'),
            let: step('let', 'realtime.grant', { topic: 'room:alpha', ttlSeconds: '600' }, 'ret'),
            ret: step('ret', 'flow.output', { values: '{"grant": "{{ let.grant }}"}' })
          }
        }
      },
      input: {},
      callerId: 'ip:198.51.100.7',
      spaceId: 1,
      environment: 'main',
      trigger: 'call',
      runId: 'join-1'
    });
    const grant = String(result.output.grant);
    const page = await connect(realtime.hub, 'room:alpha', undefined, grant, realtime.grants);

    expect(page.ready?.topics).toEqual(['room:alpha']);
    await page.close();
  });

  it('revokes one grant, and leaves the others as they were', async () => {
    const one = await GRANTS.issue(SPACE, 'room:rev1');
    const other = await GRANTS.issue(SPACE, 'room:rev1');
    await GRANTS.revoke(SPACE, 'room:rev1', one);

    expect(await GRANTS.opens(SPACE, 'room:rev1', one)).toBe(false);
    expect(await GRANTS.opens(SPACE, 'room:rev1', other)).toBe(true);
  });

  it('revokes every grant of a topic at once — and a grant issued after opens it again', async () => {
    const before = await GRANTS.issue(SPACE, 'room:rev2');
    await GRANTS.revoke(SPACE, 'room:rev2');
    const after = await GRANTS.issue(SPACE, 'room:rev2');

    expect(await GRANTS.opens(SPACE, 'room:rev2', before)).toBe(false);
    expect(await GRANTS.opens(SPACE, 'room:rev2', after)).toBe(true);
  });

  it('lets go of the topic a page on it with a revoked grant, and the others hear it leave', async () => {
    const hub = createRealtimeHub(createMemoryPubSub(), createRealtimeRetained(createMemoryKv()));
    const ana = await GRANTS.issue(SPACE, 'room:rev3');
    const bob = await GRANTS.issue(SPACE, 'room:rev3');
    const anaPage = await connect(hub, 'room:rev3', undefined, ana);
    const bobPage = await connect(hub, 'room:rev3', undefined, bob);
    await publish(hub, { token: anaPage.ready?.token, topic: 'room:rev3', type: '$presence', data: { name: 'Ana' } });

    await GRANTS.revoke(SPACE, 'room:rev3', ana);
    await hub.revoke(SPACE, 'room:rev3', ana);
    await new Promise(resolve => setTimeout(resolve, 0));
    await publish(hub, { token: bobPage.ready?.token, topic: 'room:rev3', type: 'note', data: 'still here?' });

    expect(anaPage.heard().map(message => message.type)).toContain('$revoked');
    expect(anaPage.heard().some(message => message.type === 'note')).toBe(false);
    expect(bobPage.heard().find(message => message.type === '$leave')?.from).toBe(anaPage.ready?.connection);
    expect(bobPage.heard().some(message => message.type === '$revoked')).toBe(false);
    expect(
      await publish(hub, { token: anaPage.ready?.token, topic: 'room:rev3', type: 'note', data: 'let me back' })
    ).toBe(403);
    await anaPage.close();
    await bobPage.close();
  });

  it('revokes only on a private channel', async () => {
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

    const grant = await realtime.grant(SPACE, 'room:rev4', 600);
    await realtime.revoke(SPACE, 'room:rev4', grant);

    expect(await realtime.grants.opens(SPACE, 'room:rev4', grant)).toBe(false);
    await expect(realtime.revoke(SPACE, 'board:1')).rejects.toThrow('no grants to revoke');
  });
});

/** State every screen shares, said once by the server: a page that opens later finds it, without a read of its own. */
describe('a channel that keeps what the server says', () => {
  const moduleFor = () => {
    const realtime = realtimeModuleFor({
      adapters: {
        getOfflineData: () =>
          Promise.resolve({ schema: { settings: { channels: CHANNELS } }, style: {} } as unknown as OfflineDataRaw)
      }
    });
    if (!realtime) {
      throw new Error('expected a realtime module');
    }

    return realtime;
  };

  it('hands a page that joins the latest of each type, and forgets one said as null', async () => {
    const realtime = moduleFor();
    await realtime.publish(SPACE, 'desk:1', 'lists', ['milk']);
    await realtime.publish(SPACE, 'desk:1', 'lists', ['milk', 'eggs']);
    await realtime.publish(SPACE, 'desk:1', 'habits', 3);
    const page = await connect(realtime.hub, 'desk:1');

    // Said again as it joins, marked so: a room opened before the page came is not answered as opened now.
    expect(page.heard().map(({ type, data, retained, replayed }) => [type, data, retained, replayed])).toEqual([
      ['lists', ['milk', 'eggs'], true, true],
      ['habits', 3, true, true]
    ]);

    await realtime.publish(SPACE, 'desk:1', 'habits', null);
    const later = await connect(realtime.hub, 'desk:1');

    expect(later.heard().map(({ type }) => type)).toEqual(['lists']);
    // Said live too, marked kept: the page already there forgets it as well.
    expect(page.heard().at(-1)).toMatchObject({ type: 'habits', data: null, retained: true });
    expect(page.heard().at(-1)).not.toHaveProperty('replayed');
    await page.close();
    await later.close();
  });

  it('keeps nothing on a channel that does not retain', async () => {
    const realtime = moduleFor();
    await realtime.publish(SPACE, 'scores:1', 'total', 10);
    const page = await connect(realtime.hub, 'scores:1');

    expect(page.heard()).toEqual([]);
    await page.close();
  });

  it('refuses what would take a topic past what it keeps, and says none of it', async () => {
    const realtime = moduleFor();
    const page = await connect(realtime.hub, 'desk:9');

    await expect(realtime.publish(SPACE, 'desk:9', 'log', 'x'.repeat(600 * 1024))).rejects.toThrow(
      'keeps at most 512 KB'
    );
    expect(page.heard()).toEqual([]);
    await page.close();
  });
});

/** Who is on a presence channel, counted by the server on every replica — what a function's `ctx.presence` reads. */
describe('a presence channel’s count', () => {
  it('counts a page while it is there, never one that watches, and lets it go when it leaves', async () => {
    const store = createMemoryKv();
    const presence = createRealtimePresence(store);
    const hub = createRealtimeHub(createMemoryPubSub(), createRealtimeRetained(store), presence);
    const space = { spaceId: 1, environment: 'main' };

    const page = await connect(hub, 'board:1', { id: 7, username: 'mika' });
    const check = await connect(hub, 'board:1', undefined, undefined, GRANTS, { cookie: 'plitzi-observer=1' });

    expect(await presence.of(space, 'board:1')).toEqual([
      {
        from: page.ready?.connection,
        user: expect.objectContaining({ id: 7 }) as unknown,
        since: expect.any(Number) as unknown
      }
    ]);

    await page.close();
    await check.close();
    expect(await presence.of(space, 'board:1')).toEqual([]);
    hub.closeAll();
  });
});
