import http from 'node:http';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createWorker, engineOnWorker } from '@plitzi/sdk-actions/worker';
import { unusedPort } from '@plitzi/sdk-kernel/http';

import { createServer } from './createServer';
import { createJsonAdapters } from '../adapters/jsonAdapters';
import { offlineDataOf } from '../modules/ssr/tests/offlineData';

import type { SSRServer } from '../types';
import type { HttpServer } from '@plitzi/sdk-kernel/http';
import type { ActionEntry, ElementInteraction } from '@plitzi/sdk-shared';

/**
 * Pages and actions apart (docs/en/server-packages.md): a page server that runs nothing of the engine, a worker that runs it, and a
 * gateway in front of both sending a space's paths by prefix — what the hosted platform's ingress does. The browser sees
 * one origin; the page is told where to call, and the call is the worker's.
 */

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
  flowId: 'split',
  enabled: true,
  ...overrides
});

const COUNT: ActionEntry = {
  id: 'count',
  document: {
    name: 'Count',
    output: { count: { type: 'number' } },
    nodes: {
      start: node('start', { type: 'trigger', action: 'call', params: { access: 'public' }, afterNode: 'count' }),
      count: node('count', { action: 'kv.increment', params: { key: 'calls', amount: '1' }, afterNode: 'ret' }),
      ret: node('ret', { action: 'flow.output', params: { values: '{"count": {{ count.value }}}' } })
    }
  }
};

/** The paths of a space's host that are the worker's (the hosted platform's `WORKER_PATHS`). */
const WORKER_PATHS = ['/_action', '/fn', '/_realtime'];

const adapters = createJsonAdapters({
  offlineData: offlineDataOf(),
  deployment: { spaceId: 1, environment: 'main', revision: 0 }
});
const engine = {
  action: {
    lookups: { getAction: (_spaceId: number, id: string) => Promise.resolve(id === COUNT.id ? COUNT : undefined) }
  }
};

let pages: SSRServer;
let worker: HttpServer;
let gateway: http.Server;
let origin = '';

beforeAll(async () => {
  const [pagesPort, workerPort, gatewayPort] = [await unusedPort(), await unusedPort(), await unusedPort()];
  pages = createServer({ httpVersion: 1, adapters, engine: engineOnWorker(engine) });
  worker = createWorker({ httpVersion: 1, adapters, ...engine });
  await Promise.all([pages.listen(pagesPort, '127.0.0.1'), worker.listen(workerPort, '127.0.0.1')]);

  gateway = http.createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://gateway').pathname;
    const port = WORKER_PATHS.some(prefix => path === prefix || path.startsWith(`${prefix}/`)) ? workerPort : pagesPort;
    const forwarded = http.request(
      { host: '127.0.0.1', port, path: req.url, method: req.method, headers: req.headers },
      answer => {
        res.writeHead(answer.statusCode ?? 502, answer.headers);
        answer.pipe(res);
      }
    );
    req.pipe(forwarded);
  });
  await new Promise<void>(resolve => gateway.listen(gatewayPort, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${String(gatewayPort)}`;
});

afterAll(async () => {
  await new Promise(resolve => gateway.close(resolve));
  await Promise.all([pages.close(), worker.close()]);
});

describe('pages on one server, actions on a worker', () => {
  it('tells the page where it calls its actions, though the page server runs none', async () => {
    const html = await (await fetch(`${origin}/`)).text();

    expect(html).toContain('"actionPath":"/_action"');
  });

  it('answers the call from the worker, on the page’s own origin', async () => {
    const call = () =>
      fetch(`${origin}/_action`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ actionId: COUNT.id, input: {} })
      });

    expect(((await (await call()).json()) as { output: { count: number } }).output.count).toBe(1);
    expect(((await (await call()).json()) as { output: { count: number } }).output.count).toBe(2);
  });
});
