import { describe, expect, it } from 'vitest';

import { connectorRscData } from './connectorRscData';
import { createActionsModule } from '../actions';

import type { ActionEntry, ElementInteraction, Schema, SSRRequest } from '@plitzi/sdk-shared';

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

const entry: ActionEntry = {
  id: 'cat-gallery',
  document: {
    name: 'Cat gallery',
    nodes: {
      start: node('start', { type: 'trigger', action: 'render', params: { access: 'public' }, afterNode: 'out' }),
      out: node('out', { action: 'flow.output', params: { values: '{"records": [{"url": "cat.jpg"}]}' } })
    }
  }
};

const schema = (attributes: Record<string, unknown>): Schema => ({
  flat: {
    home: {
      id: 'home',
      attributes: { slug: '', folder: '', default: true },
      definition: { type: 'page', label: 'home', rootId: 'root', items: ['gallery'], styleSelectors: { base: '' } }
    },
    gallery: {
      id: 'gallery',
      attributes,
      definition: {
        type: 'apiContainer',
        label: 'gallery',
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
});

const req = { method: 'GET', path: '/', query: {}, ctx: {} } as unknown as SSRRequest;

const resolve = (attributes: Record<string, unknown>) => {
  const lookups = { getAction: () => Promise.resolve(entry) };
  const getRscData = connectorRscData(undefined, { lookups, module: createActionsModule({ lookups }) });

  return getRscData({
    req,
    spaceId: 1,
    environment: 'main',
    user: undefined,
    ids: undefined,
    loadOfflineData: () => Promise.resolve({ schema: schema(attributes) })
  } as unknown as Parameters<typeof getRscData>[0]);
};

describe('connectorRscData', () => {
  /** The page's ceiling, and the deployment's to set: a section is worth waiting for only as long as its visitor
   *  is, and how long that is depends on the site. */
  it('gives an element the budget the deployment configured', async () => {
    const lookups = {
      getAction: () =>
        new Promise<ActionEntry>(() => {
          // Never answers, so the only thing that can end this render is the budget.
        })
    };
    const getRscData = connectorRscData(undefined, { lookups, module: createActionsModule({ lookups }) }, 20);

    const startedAt = Date.now();
    const payload = await getRscData({
      req,
      spaceId: 1,
      environment: 'main',
      user: undefined,
      ids: undefined,
      loadOfflineData: () => Promise.resolve({ schema: schema({ action: 'cat-gallery' }) })
    } as unknown as Parameters<typeof getRscData>[0]);

    expect(payload.serverData).toEqual({});
    // The margin is what makes this an assertion rather than a stopwatch: the default is five SECONDS.
    expect(Date.now() - startedAt, 'the configured budget was ignored').toBeLessThan(1_000);
  });

  // A space whose server elements name actions configures no connectors, so keying the whole adapter on those left
  // its render elements resolving to nothing with no configuration missing anywhere.
  it('resolves an action-fed element with no connectors configured', async () => {
    const payload = await resolve({ action: 'cat-gallery' });

    expect(payload.serverData).toEqual({ gallery: { records: [{ url: 'cat.jpg' }] } });
  });

  // The same answer a connector the space never created gets: an element left out of the payload, not an error
  // that costs the rest of the page its data.
  it('leaves an element naming a connector this deployment cannot read out of the payload', async () => {
    const payload = await resolve({ connector: 'cms' });

    expect(payload.serverData).toEqual({});
  });
});
