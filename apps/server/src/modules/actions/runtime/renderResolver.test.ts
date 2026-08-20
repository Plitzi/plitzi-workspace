import { describe, expect, it } from 'vitest';

import { createActionResolver } from './renderResolver';
import { createActionsModule } from '../index';

import type { ActionEntry, Element, ElementInteraction, SSRRequest } from '@plitzi/sdk-shared';

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
  id: 'post-page',
  document: {
    name: 'Post page',
    enabled: true,
    access: { mode: 'public' },
    triggers: [{ type: 'render' }],
    input: { slug: { type: 'text', required: true } },
    nodes: {
      start: node('start', { type: 'trigger', action: 'render', afterNode: 'load' }),
      load: node('load', {
        action: 'transform.json',
        afterNode: 'out',
        params: { value: '{"title":"Hello","draftNotes":"internal only"}' }
      }),
      out: node('out', {
        action: 'flow.output',
        params: { values: '{"title": "{{ load.value.title }}", "slug": "{{ input.slug }}"}' }
      })
    }
  }
};

const element = (attributes: Record<string, unknown>): Element =>
  ({
    id: 'provider1',
    attributes,
    definition: {
      type: 'apiContainer',
      label: 'Post',
      rootId: 'root',
      items: [],
      styleSelectors: { base: '' },
      runtime: 'server'
    }
  }) as unknown as Element;

// `null` means the space does not have it. An explicit `undefined` would fall back to the default parameter,
// which is how the "missing action" case quietly tested the opposite of what it says.
const asked: { at?: { environment: string; revision: number } }[] = [];

const resolve = (attributes: Record<string, unknown>, action: ActionEntry | null = entry) => {
  const found = action ?? undefined;
  const lookups = {
    getAction: (_spaceId: number, _actionId: string, at?: { environment: string; revision: number }) => {
      asked.push({ at });

      return Promise.resolve(found);
    }
  };
  const module = createActionsModule({ lookups });
  const resolver = createActionResolver(lookups, module);

  return resolver({
    element: element(attributes),
    flat: {},
    routeParams: { slug: 'hello-world' },
    queryParams: {},
    // The render carries the revision it is being served at, and the resolver reads the action as of it.
    req: { ctx: { spaceDeployment: { environment: 'production', revision: 4 } } } as unknown as SSRRequest,
    spaceId: 1,
    environment: 'main',
    user: undefined
  });
};

describe('createActionResolver', () => {
  it('feeds the element with what the action answered', async () => {
    const slice = await resolve({ action: 'post-page' });

    expect(slice).toEqual({ title: 'Hello', slug: 'hello-world' });
  });

  // A render slice is serialized into the page, so anything the output step did not name would be published to
  // every visitor of that URL — the reason this path returns `output` and never the flow scope.
  it('publishes nothing the output step did not name', async () => {
    const slice = await resolve({ action: 'post-page' });

    expect(JSON.stringify(slice)).not.toContain('internal only');
  });

  it('takes the page route params as input', async () => {
    const slice = (await resolve({ action: 'post-page' })) as { slug: string };

    expect(slice.slug).toBe('hello-world');
  });

  // The element and the action it names were published together, so a page rendered at revision 4 reads the flow
  // as it was at revision 4.
  it('reads the action as of the revision being rendered', async () => {
    asked.length = 0;

    await resolve({ action: 'post-page' });

    // Both halves from the deployment record, so they can never name a snapshot nobody published.
    expect(asked[0].at).toEqual({ environment: 'production', revision: 4 });
  });

  it('leaves an element that names no action alone', async () => {
    expect(await resolve({ connector: 'cms' })).toBeUndefined();
  });

  it('says which action is missing rather than rendering an empty section silently', async () => {
    await expect(resolve({ action: 'ghost' }, null)).rejects.toThrow(/ghost/);
  });

  it('refuses an action that does not declare the render trigger', async () => {
    const callOnly: ActionEntry = { ...entry, document: { ...entry.document, triggers: [{ type: 'call' }] } };

    await expect(resolve({ action: 'post-page' }, callOnly)).rejects.toThrow(/refused this render/);
  });
});
