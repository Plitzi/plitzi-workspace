import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createWorker, engineOnWorker } from '@plitzi/sdk-actions/worker';
import { unusedPort } from '@plitzi/sdk-kernel/http';

import { createServer } from './createServer';
import { actions, schema } from './tests/counterSpace';
import { createJsonAdapters } from '../adapters/jsonAdapters';

import type { SSRServer } from '../types';
import type { HttpServer } from '@plitzi/sdk-kernel/http';
import type { OfflineDataRaw } from '@plitzi/sdk-shared';

/**
 * A page server that runs no action at all (docs/en/server-packages.md, phase 9): it is given no lookups, no store, no engine — only
 * where the worker is and its render secret. Its server element is asked of the worker, which runs the render action
 * over the kv its calls wrote: what the page shows is the worker's.
 */

const SECRET = 'a-render-secret-of-thirty-two-chars!';
// The schema is the builder's whole document; the test reads one page of it.
const adapters = createJsonAdapters({ offlineData: { schema, style: {} } as unknown as OfflineDataRaw });

let pages: SSRServer;
let worker: HttpServer;
let pagesUrl = '';
let workerUrl = '';

beforeAll(async () => {
  const [pagesPort, workerPort] = [await unusedPort(), await unusedPort()];
  workerUrl = `http://127.0.0.1:${String(workerPort)}`;
  pagesUrl = `http://127.0.0.1:${String(pagesPort)}`;
  worker = createWorker({
    httpVersion: 1,
    adapters,
    render: { secret: SECRET },
    action: {
      lookups: { getAction: (_spaceId, actionId) => Promise.resolve(actions.find(entry => entry.id === actionId)) },
      jobs: false
    }
  });
  pages = createServer({
    httpVersion: 1,
    adapters,
    engine: engineOnWorker({ render: { url: workerUrl, secret: SECRET }, realtime: false })
  });
  await Promise.all([worker.listen(workerPort, '127.0.0.1'), pages.listen(pagesPort, '127.0.0.1')]);
  await vi.waitFor(async () => {
    expect((await fetch(`${pagesUrl}/_rsc?location=/&ids=counter`)).status).toBe(200);
  });
});

afterAll(async () => {
  await Promise.all([pages.close(), worker.close()]);
});

describe('a page server whose server elements are the worker’s', () => {
  it('shows what the worker’s render read of what its calls wrote', async () => {
    const bump = () =>
      fetch(`${workerUrl}/_action`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ actionId: 'bump', input: {} })
      });
    expect((await bump()).status).toBe(200);
    expect((await bump()).status).toBe(200);

    const rendered = await (await fetch(`${pagesUrl}/_rsc?location=/&ids=counter`)).text();

    expect(rendered).toContain('"value":2');
  });

  it('runs no action itself: it has nowhere to take a call', async () => {
    const call = await fetch(`${pagesUrl}/_action`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actionId: 'bump', input: {} })
    });

    expect(call.status).not.toBe(200);
  });
});
