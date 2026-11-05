import { afterEach, describe, expect, it } from 'vitest';

import { unusedPort } from '@plitzi/sdk-kernel/http';

import { engineOnWorker } from './elsewhere';
import { createWorker } from './worker';
import { createRemoteRenderResolver } from '../render/remote';

import type { HttpServer } from '@plitzi/sdk-kernel/http';
import type { SSRRequest } from '@plitzi/sdk-kernel/types';
import type { ActionEntry, Element, ElementInteraction, OfflineDataRaw, SSRUser } from '@plitzi/sdk-shared';

const node = (id: string, overrides: Partial<ElementInteraction>): ElementInteraction => ({
  id,
  title: id,
  type: 'task',
  action: '',
  params: {},
  preview: {},
  elementId: null,
  beforeNode: '',
  afterNode: '',
  flowId: 'worker',
  enabled: true,
  ...overrides
});

/** A public call that counts in the space's kv and answers who asked: what a page's browser calls. */
const COUNT: ActionEntry = {
  id: 'count',
  document: {
    name: 'Count',
    output: { count: { type: 'number' }, who: { type: 'text' } },
    nodes: {
      start: node('start', { type: 'trigger', action: 'call', params: { access: 'public' }, afterNode: 'count' }),
      count: node('count', { action: 'kv.increment', params: { key: 'calls', amount: '1' }, afterNode: 'ret' }),
      ret: node('ret', {
        action: 'flow.output',
        params: { values: '{"count": {{ count.value }}, "who": "{{ user.username }}"}' }
      })
    }
  }
};

const offlineData = { schema: { pages: [], flat: {} }, style: {} } as unknown as OfflineDataRaw;
const ADA = { id: 7, username: 'ada', permissions: [], roles: [], email: 'ada@example.com', verified: true, token: '' };

let worker: HttpServer | undefined;

afterEach(async () => {
  await worker?.close();
  worker = undefined;
});

/** A worker of one space, on a port of its own; answers where to reach it. */
const start = async (signedIn?: SSRUser): Promise<string> => {
  const port = await unusedPort();
  worker = createWorker({
    httpVersion: 1,
    adapters: {
      getSpaceDeployment: () => Promise.resolve({ spaceId: 1, environment: 'main', revision: 0 }),
      getOfflineData: () => Promise.resolve(offlineData)
    },
    ...(signedIn ? { identity: { getUser: () => Promise.resolve(signedIn) } } : {}),
    action: {
      lookups: { getAction: (_spaceId, actionId) => Promise.resolve(actionId === COUNT.id ? COUNT : undefined) }
    }
  });
  await worker.listen(port, '127.0.0.1');

  return `http://127.0.0.1:${String(port)}`;
};

const call = (base: string) =>
  fetch(`${base}/_action`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actionId: COUNT.id, input: {} })
  });

describe('a worker', () => {
  it('runs a space’s call, its kv kept between calls', async () => {
    const base = await start();

    const first = (await (await call(base)).json()) as { output: { count: number } };
    const second = (await (await call(base)).json()) as { output: { count: number } };

    expect(first.output.count).toBe(1);
    expect(second.output.count).toBe(2);
  });

  it('knows who is calling from the identity it is given', async () => {
    const base = await start(ADA);

    const answer = (await (await call(base)).json()) as { output: { who: string } };

    expect(answer.output.who).toBe('ada');
  });

  it('answers 404 for a page: it serves none', async () => {
    const base = await start();

    expect((await fetch(`${base}/about`)).status).toBe(404);
  });

  it('refuses to start with nothing of the engine to run', () => {
    expect(() =>
      createWorker({
        httpVersion: 1,
        realtime: false,
        adapters: {
          getSpaceDeployment: () => Promise.resolve({ spaceId: 1 }),
          getOfflineData: () => Promise.resolve(offlineData)
        }
      })
    ).toThrow('createWorker runs the actions engine, and was given none of it');
  });
});

describe('a page server’s server elements, resolved on a worker', () => {
  const SECRET = 'a-render-secret-of-thirty-two-chars!';
  /** A render action: what a page's server provider reads, here who is looking and what the address said. */
  const READ: ActionEntry = {
    id: 'read',
    document: {
      name: 'Read',
      output: { who: { type: 'text' }, slug: { type: 'text' } },
      nodes: {
        start: node('start', {
          type: 'trigger',
          action: 'render',
          params: { access: 'public', input: '{"slug": {"type": "text"}}' },
          afterNode: 'ret'
        }),
        ret: node('ret', {
          action: 'flow.output',
          params: { values: '{"who": "{{ user.username }}", "slug": "{{ input.slug }}"}' }
        })
      }
    }
  };
  // The few fields a server provider's resolver reads: the rest of an element is the builder's.
  const FEED = {
    id: 'feed',
    definition: { type: 'apiContainer', items: [] },
    attributes: { action: 'read' }
  } as unknown as Element;
  const request = (): SSRRequest => ({
    method: 'GET',
    path: '/blog/hello',
    search: '',
    url: '/blog/hello',
    hostname: 'pages.example.com',
    protocol: 'http',
    headers: {},
    query: {},
    ctx: { spaceDeployment: { spaceId: 1, environment: 'main', revision: 0 } }
  });
  const resolveWith = (url: string, secret: string, req: SSRRequest) =>
    createRemoteRenderResolver({ url, secret })({
      element: FEED,
      flat: { feed: FEED },
      routeParams: { slug: 'hello' },
      queryParams: {},
      templateData: { variables: {}, routeParams: {}, queryParams: {}, origin: '', paintedKeys: new Set(), state: {} },
      req,
      spaceId: 1,
      environment: 'main',
      user: ADA,
      signal: new AbortController().signal
    });

  const startRendering = async (): Promise<string> => {
    const port = await unusedPort();
    worker = createWorker({
      httpVersion: 1,
      render: { secret: SECRET },
      adapters: {
        getSpaceDeployment: () => Promise.reject(new Error('a render ask says its space: the host is never read')),
        getOfflineData: () => Promise.resolve(offlineData)
      },
      action: {
        lookups: { getAction: (_spaceId, actionId) => Promise.resolve(actionId === READ.id ? READ : undefined) }
      }
    });
    await worker.listen(port, '127.0.0.1');

    return `http://127.0.0.1:${String(port)}`;
  };

  it('answers the element’s data for the visitor the page server signed in, and the run that fed it', async () => {
    const base = await startRendering();
    const req = request();

    expect(await resolveWith(base, SECRET, req)).toEqual({ who: 'ada', slug: 'hello' });
    expect(req.ctx.actionRuns?.map(run => [run.actionId, run.status, run.elementId])).toEqual([
      ['read', 'completed', 'feed']
    ]);
  });

  it('refuses a page server without its secret, and says so', async () => {
    const base = await startRendering();

    await expect(resolveWith(base, 'not-the-secret-of-this-worker-at-all', request())).rejects.toThrow(
      "refused element feed: /_render is asked with the worker's render secret"
    );
  });

  it('refuses to start with a secret too short to be one', () => {
    expect(() =>
      createWorker({
        httpVersion: 1,
        render: { secret: 'short' },
        adapters: {
          getSpaceDeployment: () => Promise.resolve({ spaceId: 1 }),
          getOfflineData: () => Promise.resolve(offlineData)
        },
        action: { lookups: { getAction: () => Promise.resolve(undefined) } }
      })
    ).toThrow('`render.secret` must be at least 32 characters');
  });

  it('is handed to a page server that runs nothing', () => {
    expect(engineOnWorker({ render: { url: 'http://worker:8892', secret: SECRET } }).resolveElement).toBeTypeOf(
      'function'
    );
  });
});

describe('a worker’s stats', () => {
  it('answers what it ran, its slots and its health at /_stats, behind its secret', async () => {
    const secret = 'a-stats-secret-of-thirty-two-chars!!';
    const port = await unusedPort();
    worker = createWorker({
      httpVersion: 1,
      stats: { secret, pool: 'worker', instance: 'w-1' },
      adapters: {
        getSpaceDeployment: () => Promise.resolve({ spaceId: 1, environment: 'main', revision: 0 }),
        getOfflineData: () => Promise.resolve(offlineData)
      },
      action: {
        lookups: { getAction: (_spaceId, actionId) => Promise.resolve(actionId === COUNT.id ? COUNT : undefined) }
      }
    });
    await worker.listen(port, '127.0.0.1');
    const base = `http://127.0.0.1:${String(port)}`;
    await call(base);
    await fetch(`${base}/_action`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actionId: 'missing', input: {} })
    });

    const stats = (await (
      await fetch(`${base}/_stats`, { headers: { authorization: `Bearer ${secret}` } })
    ).json()) as {
      pool: string;
      load: { slots: Record<string, { used: number; of: number }> };
      outcomes: { '1m': { runs: number; refusals: Record<string, number> } };
      health: { status: string };
    };

    expect(stats.pool).toBe('worker');
    expect(stats.outcomes['1m'].runs).toBe(1);
    expect(stats.outcomes['1m'].refusals).toEqual({ not_found: 1 });
    expect(stats.load.slots.calls).toEqual({ used: 0, of: 100 });
    expect(stats.health.status).toBe('healthy');
    expect((await fetch(`${base}/_stats`)).status).toBe(401);
  });
});

describe('a worker on another origin than its pages', () => {
  const PAGES = 'https://www.example.com';

  /** A worker whose pages are on `PAGES`, on a port of its own; answers where to reach it. */
  const startElsewhere = async (): Promise<string> => {
    const port = await unusedPort();
    worker = createWorker({
      httpVersion: 1,
      adapters: {
        getSpaceDeployment: () => Promise.resolve({ spaceId: 1, environment: 'main', revision: 0 }),
        getOfflineData: () => Promise.resolve(offlineData)
      },
      action: {
        origin: `http://127.0.0.1:${String(port)}`,
        pageOrigins: [PAGES],
        lookups: { getAction: (_spaceId, actionId) => Promise.resolve(actionId === COUNT.id ? COUNT : undefined) }
      }
    });
    await worker.listen(port, '127.0.0.1');

    return `http://127.0.0.1:${String(port)}`;
  };

  /** A call as a browser on `origin` sends it: its origin said, cross-site. */
  const callFrom = (base: string, origin: string) =>
    fetch(`${base}/_action`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin, 'sec-fetch-site': 'cross-site' },
      body: JSON.stringify({ actionId: COUNT.id, input: {} })
    });

  it('refuses to start without the pages that call it', () => {
    expect(() =>
      createWorker({
        httpVersion: 1,
        adapters: {
          getSpaceDeployment: () => Promise.resolve({ spaceId: 1 }),
          getOfflineData: () => Promise.resolve(offlineData)
        },
        action: { origin: 'https://actions.example.com', lookups: { getAction: () => Promise.resolve(undefined) } }
      })
    ).toThrow('`action.pageOrigins` names none of the pages that call them');
  });

  it('refuses an origin that is not one', () => {
    expect(() => engineOnWorker({ action: { origin: 'https://actions.example.com/calls' } })).toThrow(
      'write the origin alone, as a browser sends it — https://actions.example.com'
    );
  });

  it('answers a listed page’s preflight with its origin and credentials', async () => {
    const base = await startElsewhere();

    const preflight = await fetch(`${base}/_action`, {
      method: 'OPTIONS',
      headers: { origin: PAGES, 'access-control-request-method': 'POST' }
    });

    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe(PAGES);
    expect(preflight.headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('runs a listed page’s call, and refuses another site’s', async () => {
    const base = await startElsewhere();

    const own = await callFrom(base, PAGES);
    const foreign = await callFrom(base, 'https://elsewhere.example');

    expect(own.status).toBe(200);
    expect(own.headers.get('access-control-allow-origin')).toBe(PAGES);
    expect(((await own.json()) as { output: { count: number } }).output.count).toBe(1);
    expect(foreign.status).toBe(403);
    expect(foreign.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('a page server whose actions run on a worker', () => {
  it('tells its pages where to call them, and runs nothing', () => {
    const engine = engineOnWorker({ action: { path: '/_calls' }, realtime: { transport: 'websocket' } });

    expect(engine.published).toEqual({
      actionPath: '/_calls',
      realtimePath: '/_realtime',
      realtimeTransport: 'websocket'
    });
    expect([...engine.endpoints, ...engine.routes]).toEqual([]);
    expect(engineOnWorker({ realtime: false }).published).toEqual({ actionPath: '/_action' });
    expect(
      engineOnWorker({ action: { origin: 'https://actions.example.com' }, realtime: false }).published.actionPath
    ).toBe('https://actions.example.com/_action');
  });
});
