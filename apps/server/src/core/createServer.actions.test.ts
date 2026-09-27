import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createServer } from './createServer';
import { createJsonAdapters } from '../adapters/jsonAdapters';

import type { ActionEntry, ElementInteraction, OfflineDataRaw, Schema, SSRServer } from '@plitzi/sdk-shared';

/**
 * Actions through the server a deployment actually gets: a call and a `render` element, on one listening server.
 *
 * Each half passed its own tests while the assembly gave them two different modules — two in-memory `kv` stores,
 * two sets of guards — so what a call saved was invisible to every render. Only the assembly can show that.
 */

const PORT = 39313;
const BASE = `http://127.0.0.1:${PORT}`;

const node = (id: string, overrides: Partial<ElementInteraction> = {}): ElementInteraction => ({
  id,
  title: id,
  type: 'task',
  action: '',
  params: {},
  preview: {},
  elementId: null,
  beforeNode: '',
  afterNode: '',
  flowId: 'flow',
  enabled: true,
  ...overrides
});

const action = (id: string, trigger: 'call' | 'render', task: string): ActionEntry => ({
  id,
  document: {
    name: id,
    nodes: {
      start: node('start', { type: 'trigger', action: trigger, params: { access: 'public' }, afterNode: 'step' }),
      step: node('step', {
        action: task,
        params: { key: 'visits', amount: '1' },
        beforeNode: 'start',
        afterNode: 'out'
      }),
      out: node('out', { action: 'flow.output', params: { values: '{"value": {{ step.value }}}' }, beforeNode: 'step' })
    }
  }
});

const actions = [action('bump', 'call', 'kv.increment'), action('count', 'render', 'kv.get')];

const schema: Schema = {
  flat: {
    home: {
      id: 'home',
      attributes: { slug: '', folder: '', default: true },
      definition: { type: 'page', label: 'home', rootId: 'root', items: ['counter'], styleSelectors: { base: '' } }
    },
    counter: {
      id: 'counter',
      attributes: { action: 'count' },
      definition: {
        type: 'apiContainer',
        label: 'counter',
        rootId: 'root',
        items: [],
        styleSelectors: { base: '' },
        runtime: 'server'
      }
    }
  },
  pages: ['home'],
  pageFolders: [],
  definition: { name: 'test', permanentUrl: 'test' },
  variables: [],
  settings: { customCss: '' },
  rsc: { enabled: true }
} as unknown as Schema;

let server: SSRServer;

beforeAll(async () => {
  server = createServer({
    port: PORT,
    adapters: createJsonAdapters({ offlineData: { schema, style: {} } as unknown as OfflineDataRaw }),
    action: {
      lookups: { getAction: (_spaceId, actionId) => Promise.resolve(actions.find(entry => entry.id === actionId)) },
      jobs: false
    }
  });
  server.listen(PORT, '127.0.0.1');
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
