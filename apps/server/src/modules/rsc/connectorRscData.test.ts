import { describe, expect, it } from 'vitest';

import { RSC_FAILURE } from '@plitzi/sdk-shared/schema';

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

/** `null` is a space that never says: no `rsc` at all, as the builder and the MCP leave it. */
const schema = (attributes: Record<string, unknown>, rsc: Schema['rsc'] | null): Schema => ({
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
  components: {},
  definition: { name: 'test', permanentUrl: 'test' },
  variables: [],
  settings: { customCss: '' },
  ...(rsc ? { rsc } : {})
});

const req = {
  method: 'GET',
  path: '/',
  query: {},
  headers: {},
  hostname: 'shop.example.com',
  protocol: 'https',
  ctx: {}
} as unknown as SSRRequest;

const resolve = (attributes: Record<string, unknown>, rsc: Schema['rsc'] | null = { enabled: true }) => {
  const lookups = { getAction: () => Promise.resolve(entry) };
  const getRscData = connectorRscData({ actions: { lookups, module: createActionsModule({ lookups }) } });

  return getRscData({
    req,
    spaceId: 1,
    environment: 'main',
    user: undefined,
    ids: undefined,
    loadOfflineData: () => Promise.resolve({ schema: schema(attributes, rsc) })
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
    const getRscData = connectorRscData({
      actions: { lookups, module: createActionsModule({ lookups }) },
      elementTimeoutMs: 20
    });

    const startedAt = Date.now();
    const payload = await getRscData({
      req,
      spaceId: 1,
      environment: 'main',
      user: undefined,
      ids: undefined,
      loadOfflineData: () => Promise.resolve({ schema: schema({ action: 'cat-gallery' }, { enabled: true }) })
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
  // The builder and the MCP never write `rsc`: a space they made with a server element is served like one that says on,
  // as the page render already decides it. Only `enabled: false` turns it off.
  it('resolves a space that never says, and nothing for one that turns server data off', async () => {
    expect((await resolve({ action: 'cat-gallery' }, null)).serverData).toEqual({
      gallery: { records: [{ url: 'cat.jpg' }] }
    });
    expect(await resolve({ action: 'cat-gallery' }, { enabled: false })).toEqual({});
  });

  // A server provider whose query nothing read drew empty with nothing said — authoring refuses it now, and a document
  // written before says why where the page reads it, while developing.
  it('says why a query the page server cannot read, or no file answers, is not resolved', async () => {
    const getRscData = connectorRscData({ sayFailures: true });
    const read = async (attributes: Record<string, unknown>) =>
      (
        await getRscData({
          req,
          spaceId: 1,
          environment: 'main',
          user: undefined,
          ids: undefined,
          loadOfflineData: () => Promise.resolve({ schema: schema(attributes, { enabled: true }) })
        } as unknown as Parameters<typeof getRscData>[0])
      ).serverData;

    expect(await read({ query: 'https://api.example.com/{{ state.id }}' })).toEqual({
      gallery: {
        [RSC_FAILURE]:
          "the page server cannot read its query: its template reads `state`, which the browser alone holds — the page server knows the space's variables and `navigation` (a route param is `navigation.routeParams.x`)"
      }
    });
    expect(await read({ query: '/hours.json' })).toEqual({
      gallery: { [RSC_FAILURE]: "no file of this server's answers /hours.json" }
    });
  });

  // `{{ dataPath }}` is the space's variable as this host resolves it — the same value the browser would have read.
  it('fills a query in with the space’s variables for this host before reading it', async () => {
    const getRscData = connectorRscData({ sayFailures: true });
    const withVariable = schema({ query: '{{ dataPath }}' }, { enabled: true });
    withVariable.variables = [
      {
        name: 'dataPath',
        category: 'urls',
        type: 'text',
        value: '/elsewhere.json',
        subValues: [
          {
            when: { combinator: 'and', rules: [{ field: 'hostname', operator: '=', value: 'shop.example.com' }] },
            value: '/hours.json'
          }
        ]
      }
    ];

    const payload = await getRscData({
      req,
      spaceId: 1,
      environment: 'main',
      user: undefined,
      ids: undefined,
      loadOfflineData: () => Promise.resolve({ schema: withVariable })
    } as unknown as Parameters<typeof getRscData>[0]);

    expect(payload.serverData).toEqual({ gallery: { [RSC_FAILURE]: "no file of this server's answers /hours.json" } });
  });

  it('leaves an element naming a connector this deployment cannot read out of the payload', async () => {
    const payload = await resolve({ connector: 'cms' });

    expect(payload.serverData).toEqual({});
  });
});
