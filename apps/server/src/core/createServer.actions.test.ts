import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { unusedPort } from '@plitzi/sdk-kernel/http';

import { createPlatform } from './platform';
import { actions, schema } from './tests/counterSpace';
import { createJsonAdapters } from '../adapters/jsonAdapters';

import type { SSRServer } from '../types';
import type { OfflineDataRaw } from '@plitzi/sdk-shared';

/**
 * Actions through the server a deployment actually gets: a call and a `render` element, on one listening server.
 *
 * Each half passed its own tests while the assembly gave them two different modules — two in-memory `kv` stores,
 * two sets of guards — so what a call saved was invisible to every render. Only the assembly can show that.
 */

const PORT = await unusedPort();
const BASE = `http://127.0.0.1:${PORT}`;

let server: SSRServer;

beforeAll(async () => {
  server = createPlatform({
    port: PORT,
    adapters: createJsonAdapters({ offlineData: { schema, style: {} } as unknown as OfflineDataRaw }),
    action: {
      lookups: { getAction: (_spaceId, actionId) => Promise.resolve(actions.find(entry => entry.id === actionId)) },
      jobs: false
    }
  });
  await server.listen(PORT, '127.0.0.1');
  await vi.waitFor(async () => {
    expect((await fetch(`${BASE}/_rsc?location=/&ids=counter`)).status).toBe(200);
  });
});

afterAll(async () => {
  await server.close();
});

describe('createServer with actions', () => {
  it('lets a render read what a call wrote: one module, one kv', async () => {
    const bump = () =>
      fetch(`${BASE}/_action`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ actionId: 'bump', input: {} })
      });
    expect((await bump()).status).toBe(200);
    expect((await bump()).status).toBe(200);

    const rendered = await (await fetch(`${BASE}/_rsc?location=/&ids=counter`)).text();

    expect(rendered).toContain('"value":2');
  });
});
