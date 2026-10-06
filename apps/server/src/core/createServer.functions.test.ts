import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createServer } from './createServer';
import { createJsonAdapters } from '../adapters/jsonAdapters';
import { createActionsModule } from '../modules/actions';
import { defineFunctions } from '../modules/functions/contract';
import { createIsolateRunner } from '../modules/functions/sandbox/isolate';
import { functionsInHand } from '../modules/functions/space';
import { offlineDataOf } from '../modules/ssr/testing/offlineData';

import type { SpaceFunctions } from '../modules/functions/protocol';
import type { SSRServer } from '@plitzi/sdk-shared';

/**
 * A space's functions answering HTTP under `/fn/`, through the server a deployment gets: the deployment's own routes
 * natively, the space's in isolates — with the visitor's credentials kept out and the host's cookies kept theirs.
 */

const PORT = 39317;
const BASE = `http://127.0.0.1:${PORT}`;

const SPACE_SOURCE = {
  'index.ts': `import { ActionRefusal } from '@plitzi/sdk-server/functions';

export default {
  routes: {
    'GET /boards/:board': async (request, ctx) => {
      const hits = await ctx.kv.increment('hits:' + ctx.params.board, 1);
      return Response.json({
        board: ctx.params.board,
        hits,
        cookie: request.headers.get('cookie'),
        authorization: request.headers.get('authorization'),
        query: new URL(request.url).searchParams.get('q')
      }, { headers: { 'set-cookie': 'session=stolen', 'x-board': ctx.params.board } });
    },
    'POST /echo': async request => new Response(await request.arrayBuffer(), { headers: { 'content-type': 'application/octet-stream' } }),
    'GET /spin': () => { while (true) {} },
    'GET /read-only': () => { throw new ActionRefusal('This board is read-only'); },
    'GET /broken': () => { throw new Error('select * from boards where secret = 42'); }
  }
};`
};

let server: SSRServer;

beforeAll(async () => {
  const runner = createIsolateRunner();
  const prepared = await createActionsModule({
    lookups: { getAction: () => Promise.resolve(undefined) },
    functions: { runner }
  }).prepareFunctions(SPACE_SOURCE);
  if (!prepared.ok) {
    throw new Error(prepared.problems.map(problem => problem.message).join('\n'));
  }

  const functions: SpaceFunctions = { ...functionsInHand(prepared.functions), limits: { cpuMs: 100 } };
  server = createServer({
    port: PORT,
    adapters: createJsonAdapters({ offlineData: offlineDataOf() }),
    action: {
      lookups: { getAction: () => Promise.resolve(undefined), getFunctions: () => Promise.resolve(functions) },
      jobs: false
    },
    functions: {
      native: [defineFunctions({ routes: { 'GET /health-of-mine': () => Response.json({ mine: true }) } })],
      runner
    }
  });
  server.listen(PORT, '127.0.0.1');
  await vi.waitFor(async () => {
    expect((await fetch(`${BASE}/fn/health-of-mine`)).status).toBe(200);
  });
});

afterAll(async () => {
  await server.close();
});

describe('functions under /fn/', () => {
  it('answer with the deployment’s own routes, natively', async () => {
    expect(await (await fetch(`${BASE}/fn/health-of-mine`)).json()).toEqual({ mine: true });
  });

  it('answer with the space’s, in the sandbox, with params, query and its store', async () => {
    const first = await fetch(`${BASE}/fn/boards/kanban?q=today`, {
      headers: { cookie: 'plitzi_session=secret', authorization: 'Bearer secret' }
    });
    const second = await fetch(`${BASE}/fn/boards/kanban`);

    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({
      board: 'kanban',
      hits: 1,
      cookie: null,
      authorization: null,
      query: 'today'
    });
    expect(first.headers.get('set-cookie')).toBeNull();
    expect(first.headers.get('x-board')).toBe('kanban');
    expect(first.headers.get('cache-control')).toBe('no-store');
    expect(((await second.json()) as { hits: number }).hits).toBe(2);
  });

  it('carry a body byte for byte', async () => {
    const bytes = new Uint8Array([0, 255, 1, 254, 127]);
    const response = await fetch(`${BASE}/fn/echo`, { method: 'POST', body: bytes });

    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  });

  it('stop a route that spins, and say only that it ran out', async () => {
    const response = await fetch(`${BASE}/fn/spin`);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'This route ran out of what it may spend' });
  });

  it('answer a refusal with its reason, and anything else thrown with nothing of what it said', async () => {
    const refused = await fetch(`${BASE}/fn/read-only`);
    const broken = await fetch(`${BASE}/fn/broken`);

    expect([refused.status, await refused.json()]).toEqual([400, { error: 'This board is read-only' }]);
    expect([broken.status, await broken.json()]).toEqual([500, { error: 'This route failed' }]);
  });

  // Answered exactly as the same path outside `/fn` is: by the page server, whatever it makes of it.
  it('leave anything no route answers to the page server', async () => {
    const unrouted = await fetch(`${BASE}/fn/nothing-here`);
    const page = await fetch(`${BASE}/nothing-here`);

    expect(unrouted.status).toBe(page.status);
    expect(unrouted.headers.get('content-type')).toBe(page.headers.get('content-type'));
  });
});
