import { describe, expect, it } from 'vitest';

import { createActionResolver } from './renderResolver';
import { createActionsModule } from '../index';

import type { RscElementResolver } from '../../rsc/resolveRscData';
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
    nodes: {
      start: node('start', {
        type: 'trigger',
        action: 'render',
        params: { access: 'public', input: '{"slug":{"type":"text","required":true}}' },
        afterNode: 'load'
      }),
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

const resolverFor = (action: ActionEntry | null = entry) => {
  const found = action ?? undefined;
  const lookups = {
    getAction: (_spaceId: number, _actionId: string, at?: { environment: string; revision: number }) => {
      asked.push({ at });

      return Promise.resolve(found);
    }
  };

  return createActionResolver(lookups, createActionsModule({ lookups }));
};

const render = (
  resolver: RscElementResolver,
  attributes: Record<string, unknown>,
  signal = new AbortController().signal
) =>
  resolver({
    element: element(attributes),
    flat: {},
    routeParams: { slug: 'hello-world' },
    queryParams: {},
    // The render carries the revision it is being served at, and the resolver reads the action as of it.
    req: { ctx: { spaceDeployment: { environment: 'production', revision: 4 } } } as unknown as SSRRequest,
    spaceId: 1,
    environment: 'main',
    user: undefined,
    signal
  });

const resolve = (attributes: Record<string, unknown>, action: ActionEntry | null = entry) =>
  render(resolverFor(action), attributes);

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

  /**
   * Two visitors of one URL get one run, and the same answer object out of it.
   *
   * Before, they got neither: single-flight keys on the caller and the input, every anonymous render shares both,
   * and whichever arrived second had its section refused as a duplicate. Now they do not race at all — the second
   * joins the first — which is what a page being read by many people at once should cost.
   */
  it('answers concurrent renders of the same page from one run', async () => {
    const resolver = resolverFor();

    const [first, second] = await Promise.all([
      render(resolver, { action: 'post-page' }),
      render(resolver, { action: 'post-page' })
    ]);

    expect(first).toEqual({ title: 'Hello', slug: 'hello-world' });
    expect(second, 'the second render ran the flow again').toBe(first);
  });

  /** What the author asked for on the trigger step, honoured: the answer is served again without running the
   *  flow. Off unless declared — only the author knows whether their page may repeat itself. */
  it('reuses an answer for as long as the render trigger says', async () => {
    const cached: ActionEntry = {
      ...entry,
      document: {
        ...entry.document,
        nodes: {
          ...entry.document.nodes,
          start: {
            ...entry.document.nodes.start,
            params: { ...entry.document.nodes.start.params, cacheSeconds: '60' }
          }
        }
      }
    };
    const resolver = resolverFor(cached);

    const first = await render(resolver, { action: 'post-page' });
    const second = await render(resolver, { action: 'post-page' });

    expect(second, 'the flow ran again inside its own reuse window').toBe(first);
  });

  /** Different questions are still different runs: sharing is keyed by everything that can change the answer. */
  it('does not share between renders that would answer differently', async () => {
    const resolver = resolverFor();

    const [first, second] = await Promise.all([
      render(resolver, { action: 'post-page', input: { who: 'ana' } }),
      render(resolver, { action: 'post-page', input: { who: 'bob' } })
    ]);

    expect(second).not.toBe(first);
  });

  /** The page's error state is reached by the slice being ABSENT — that is how `resolveRscData` reports a
   *  provider that did not resolve. A failed run answers an empty output, and publishing that would tell the
   *  element it resolved to nothing: an empty section where the truth is a failed fetch. */
  it('publishes nothing for a run that did not complete', async () => {
    const failing: ActionEntry = {
      ...entry,
      document: {
        ...entry.document,
        nodes: {
          ...entry.document.nodes,
          load: { ...entry.document.nodes.load, action: 'flow.fail', params: { message: 'no route to host' } }
        }
      }
    };

    await expect(resolve({ action: 'post-page' }, failing)).rejects.toThrow(/failed/);
  });

  /** The render gave up — its budget ran out, or the visitor left. The run must end with it rather than carry on
   *  holding a slot and a connection for a page that has already been answered. */
  it('ends the run when the render stops waiting for it', async () => {
    const controller = new AbortController();
    const slow: ActionEntry = {
      ...entry,
      document: {
        ...entry.document,
        nodes: {
          ...entry.document.nodes,
          load: { ...entry.document.nodes.load, action: 'flow.delay', params: { milliseconds: '2000' } }
        }
      }
    };

    const pending = render(resolverFor(slow), { action: 'post-page' }, controller.signal);
    controller.abort();

    // `flow.delay` resolves the moment the run is aborted, and the runner reports the run it did not finish.
    await expect(pending).rejects.toThrow(/aborted/);
  });

  it('leaves an element that names no action alone', async () => {
    expect(await resolve({ connector: 'cms' })).toBeUndefined();
  });

  it('says which action is missing rather than rendering an empty section silently', async () => {
    await expect(resolve({ action: 'ghost' }, null)).rejects.toThrow(/ghost/);
  });

  it('refuses an action that does not declare the render trigger', async () => {
    // The trigger STEP is the declaration: swap its kind and the action has no way in from a render.
    const callOnly: ActionEntry = {
      ...entry,
      document: {
        ...entry.document,
        nodes: { ...entry.document.nodes, start: { ...entry.document.nodes.start, action: 'call' } }
      }
    };

    await expect(resolve({ action: 'post-page' }, callOnly)).rejects.toThrow(/refused this render/);
  });
});
