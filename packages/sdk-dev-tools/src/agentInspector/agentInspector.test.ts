// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import { createStore } from '@plitzi/nexus';

import { flowRunLine, flowRunOf } from './flowRuns';
import { createAgentInspector } from './inspector';
import { recordAt } from './report';

import type { FlowRun } from './flowRuns';
import type { ElementInteraction, InteractionNode, Log } from '@plitzi/sdk-shared';

// Only the fields a flow summary reads; the rest of an interaction is what the builder edits.
const step = (id: string, title: string, action: string): ElementInteraction =>
  ({
    id,
    title,
    action,
    type: 'callback',
    elementId: 'cart',
    enabled: true,
    params: {}
  }) as unknown as ElementInteraction;

// A flow as the interactions write it when it ends: the trigger, and each step with its own times.
const flowLog = (status: 'completed' | 'failed', last?: InteractionNode): Log => ({
  logType: status === 'failed' ? 'danger' : 'info',
  category: 'interactions',
  message: 'Interaction triggered',
  time: '12:00:00.000',
  params: {
    elementId: 'add',
    hostElementId: 'add',
    status,
    startTime: 0,
    endTime: 14,
    node: step('t', 'Click', 'onClick'),
    nodes: {
      t: { node: step('t', 'Click', 'onClick'), status: 'success', postCallbacks: [], startTime: 0, endTime: 1 },
      a: { node: step('a', 'Add', 'setState'), status: 'success', postCallbacks: [], startTime: 1, endTime: 3 },
      b: last ?? {
        node: step('b', 'Save', 'webHook'),
        status: status === 'failed' ? 'failed' : 'success',
        postCallbacks: [],
        result: status === 'failed' ? 'HTTP 500' : undefined,
        startTime: 3,
        endTime: 14
      }
    }
  }
});

describe('flow runs', () => {
  it('reads a finished flow as its trigger, element, outcome and steps', () => {
    const run = flowRunOf(flowLog('failed'));

    expect(run).toEqual({
      at: '12:00:00.000',
      trigger: 'Click [onClick]',
      on: 'add',
      status: 'failed',
      ms: 14,
      steps: [
        { title: 'Add', action: 'setState', status: 'success', ms: 2 },
        { title: 'Save', action: 'webHook', status: 'failed', ms: 11, error: 'HTTP 500' }
      ]
    });
    expect(run && flowRunLine(run)).toBe(
      '[flow] Click [onClick] on add → failed (2 steps, 14ms)\n  ✗ Save [webHook]: HTTP 500'
    );
  });

  it('says a step whose server action was refused as refused, with the server’s words — never a success', () => {
    const run = flowRunOf(
      flowLog('completed', {
        node: step('b', 'Made', 'runServerAction'),
        status: 'success',
        postCallbacks: [],
        result: { status: 'failed', reason: 'invalid_input', runId: '', output: {}, error: 'Pick 1 to 3 genres.' },
        startTime: 3,
        endTime: 14
      })
    );

    expect(run?.steps.at(-1)).toEqual({
      title: 'Made',
      action: 'runServerAction',
      status: 'refused',
      ms: 11,
      error: 'Pick 1 to 3 genres. (invalid_input)'
    });
    expect(run && flowRunLine(run)).toBe(
      '[flow] Click [onClick] on add → completed (2 steps, 14ms)\n  refused Made [runServerAction]: Pick 1 to 3 genres. (invalid_input)'
    );
  });

  it('is not a note about one step', () => {
    // A note about one step carries no summary of the flow it is in.
    expect(flowRunOf({ ...flowLog('completed'), params: { error: 'boom' } } as Log)).toBeUndefined();
  });
});

describe('window.__plitzi', () => {
  const root = createStore<Record<string, unknown>>(() => ({
    schema: {
      flat: {
        cart: {
          definition: {
            type: 'text',
            bindings: {
              attributes: [
                {
                  to: 'content',
                  source: 'state.count',
                  transformers: [{ action: 'twigTemplate', params: { template: '{{ source }} items' } }]
                }
              ]
            }
          },
          attributes: { content: '{{ state.count }}' }
        }
      }
    },
    runtime: { state: { count: 2 }, sources: { state: { count: 2 } }, elements: { cart: { open: true } } },
    rsc: { failures: { dmThread: 'Action "dm-thread" refused this render: invalid_input — Invalid input: with' } }
  }));
  const provider = createStore<Record<string, unknown>>(() => ({
    runtime: { sources: { apiContainer_site: { data: { total: 3 }, isLoading: false, refetch: () => undefined } } }
  }));
  const runs: FlowRun[] = [];
  const writeState = vi.fn();
  const writeTestAccount = vi.fn();
  const setWatching = vi.fn();
  const inspector = createAgentInspector({
    root,
    writeState,
    writeTestAccount,
    stores: () => [provider],
    runs: () => runs,
    setWatching,
    document
  });

  // A journey that plays as one of the space's test accounts: the page's visitor, signed in, with no session.
  it('signs the visitor in as a test account, refuses one written wrong, and signs it out', () => {
    expect(inspector.signInAs({ id: 'editor', roles: ['editor'], permissions: ['spaceEdit'] })).toContain('editor');
    expect(writeTestAccount).toHaveBeenLastCalledWith({ id: 'editor', roles: ['editor'], permissions: ['spaceEdit'] });
    expect(inspector.signInAs({ id: 'an editor' })).toEqual({
      refused: expect.stringContaining('{ id, email?') as unknown
    });
    expect(inspector.signInAs(null)).toContain('guest');
    expect(writeTestAccount).toHaveBeenLastCalledWith(undefined);
  });

  it('moves the page as a link does — or says it cannot, on a page with no navigation', () => {
    expect(inspector.navigate('/account')).toBe(false);

    const navigate = vi.fn();
    const routed = createAgentInspector({
      root: createStore<Record<string, unknown>>(() => ({ navigation: { navigate } })),
      writeState: vi.fn(),
      writeTestAccount: vi.fn(),
      stores: () => [],
      runs: () => [],
      setWatching: vi.fn(),
      document
    });
    expect(routed.navigate('/account')).toBe('/account');
    expect(navigate).toHaveBeenCalledWith('/account');
  });

  it('reads and writes the state, as plain data', () => {
    expect(inspector.state()).toEqual({ count: 2 });
    expect(inspector.state('count')).toBe(2);
    inspector.setState('count', 5);

    expect(writeState).toHaveBeenCalledWith('count', 5);
  });

  it('lists every source by its name, from the store it lives in, with nothing that cannot be printed', () => {
    expect(inspector.sources('apiContainer_site')).toEqual({ data: { total: 3 }, isLoading: false });
    expect(inspector.sources()).toHaveProperty('state');
  });

  // A designer approved a list it had only seen empty: nothing put a provider's answer on the page to see it filled.
  it('writes a source, or a path in it, where its provider keeps it — and says when no store holds one', () => {
    const page = createStore<Record<string, unknown>>(() => ({ runtime: { sources: {} } }));
    const chart = createStore<Record<string, unknown>>(
      () => ({ runtime: { sources: { apiContainer_chart: { clapped: [], isLoading: false } } } }),
      { parent: page }
    );
    const writer = createAgentInspector({
      root: page,
      writeState,
      writeTestAccount: vi.fn(),
      stores: () => [chart],
      runs: () => runs,
      setWatching,
      document
    });

    expect(writer.setSource('apiContainer_chart.clapped', [{ title: 'Night Drive', claps: 12 }])).toBe(
      'apiContainer_chart'
    );
    expect(writer.sources('apiContainer_chart')).toEqual({
      clapped: [{ title: 'Night Drive', claps: 12 }],
      isLoading: false
    });
    expect(writer.setSource('apiContainer_none.items', [])).toBe(false);
    // By its element's id, as a run's designer wrote it: the one source that element publishes, its name said.
    expect(writer.setSource('chart.clapped', [])).toBe('apiContainer_chart');
    expect(writer.sources('apiContainer_chart')).toEqual({ clapped: [], isLoading: false });
    expect(writer.setSource('none.items', [])).toBe(false);
  });

  // A plugin's new attribute no page bound yet could not be seen drawn: only the page's state could be written.
  it('gives an element an attribute as a page binding it would, and says when the space has no such element', () => {
    expect(inspector.setAttribute('cart.title', 'Your basket')).toBe('cart');
    expect(recordAt(root.getState(), 'schema', 'flat', 'cart', 'attributes').title).toBe('Your basket');
    expect(inspector.setAttribute('nowhere.content', 'x')).toBe(false);
    expect(inspector.setAttribute('cart', 'x')).toBe(false);
  });

  // A run's designer wrote strongest-magnitude.content "WATCH", saw nothing change, and nothing said why: it is bound.
  it('refuses an attribute a binding gives, naming what to write instead, and leaves it as it was', () => {
    expect(inspector.setAttribute('cart.content', 'WATCH')).toEqual({
      refused:
        "cart.content is given by its binding, from state.count: what is written on it is drawn over at once — write what it reads (setSource('state.count', …))"
    });
    expect(recordAt(root.getState(), 'schema', 'flat', 'cart', 'attributes').content).toBe('{{ state.count }}');
  });

  it('reads a list’s rows from its provider and its own source, whatever store registered first', () => {
    const picks = [{ title: 'A' }, { title: 'B' }];
    const page = createStore<Record<string, unknown>>(() => ({
      runtime: { sources: { apiContainer_feed: { data: { picks }, isLoading: false } } }
    }));
    const list = createStore<Record<string, unknown>>(
      () => ({ runtime: { sources: { list_feed: { items: picks } } } }),
      {
        parent: page
      }
    );
    const row = createStore<Record<string, unknown>>(
      () => ({ runtime: { sources: { list_feed: { item: picks[0], index: 0 } } } }),
      { parent: list }
    );
    for (const order of [
      [row, list],
      [list, row]
    ]) {
      const reader = createAgentInspector({
        root: page,
        writeState,
        writeTestAccount: vi.fn(),
        stores: () => order,
        runs: () => runs,
        setWatching,
        document
      });

      expect(reader.sources()).toEqual({
        apiContainer_feed: { data: { picks }, isLoading: false },
        list_feed: { items: picks }
      });
    }
  });

  // A run's designer wrote strongestPick.item and saw nothing change: a row's item comes from the list's items.
  it('refuses a list row’s item, naming the source its items are bound from', () => {
    const schema = createStore<Record<string, unknown>>(() => ({
      schema: {
        flat: {
          feed: {
            definition: { type: 'list', bindings: { attributes: [{ to: 'items', source: 'feed.records' }] } },
            attributes: {}
          }
        }
      },
      runtime: { sources: { list_feed: { items: [] } } }
    }));
    const writer = createAgentInspector({
      root: schema,
      writeState,
      writeTestAccount: vi.fn(),
      stores: () => [],
      runs: () => runs,
      setWatching,
      document
    });

    expect(writer.setSource('list_feed.item', { label: 'WATCH' })).toEqual({
      refused:
        "list_feed.item is each row's own — a list's item comes from its items, bound from feed.records: write that source (setSource('feed.records', …))"
    });
    expect(writer.setSource('feed.item.label', 'WATCH')).toEqual({
      refused:
        "list_feed.item.label is each row's own — a list's item comes from its items, bound from feed.records: write that source (setSource('feed.records', …))"
    });
  });

  it('cuts a value that holds itself, and nothing else', () => {
    const cycle: Record<string, unknown> = { name: 'loop' };
    cycle.self = cycle;
    const holder = createStore<Record<string, unknown>>(() => ({ runtime: { sources: { state: { cycle } } } }));
    const reader = createAgentInspector({
      root: holder,
      writeState,
      writeTestAccount: vi.fn(),
      stores: () => [],
      runs: () => runs,
      setWatching,
      document
    });

    expect(reader.sources('state')).toEqual({ cycle: { name: 'loop', self: '[…]' } });
  });

  it('describes an element: what it is, its own state, and whether it is on screen', () => {
    document.body.innerHTML = '<span data-id="cart">2  items</span>';

    expect(inspector.element('cart')).toMatchObject({
      id: 'cart',
      type: 'text',
      attributes: { content: '{{ state.count }}' },
      bindings: [{ category: 'attributes', to: 'content', source: 'state.count', template: '{{ source }} items' }],
      state: { open: true },
      copies: 1,
      // What it shows, its template resolved: the count read, not worked out.
      text: '2 items',
      visible: false
    });
    expect(inspector.element('nowhere')).toBeUndefined();
  });

  // Two of a run's agents could not tell what a plugin received: --element said the binding's template, never what the
  // map's `hazards` held after a filter — one pictured the globe at two filters to compare.
  it('says what each binding gave the element, from the sources it sees', () => {
    document.body.innerHTML = '<span data-id="cart">2 items</span>';
    const seeing = createAgentInspector({
      root,
      writeState,
      writeTestAccount: vi.fn(),
      stores: () => [provider],
      runs: () => runs,
      setWatching,
      elementSources: id => (id === 'cart' ? { state: { count: 7 } } : undefined),
      document
    });

    expect(seeing.element('cart')?.resolved).toEqual({ 'attributes.content': '7 items' });
    expect(inspector.element('cart')?.resolved).toBeUndefined();
  });

  // A run's panel read visible:true at y=614, clipped by its 495 px column: a box drawn is not one a visitor sees.
  it('reads an element as visible only when a visitor sees it, and says what clips it', () => {
    document.body.innerHTML =
      '<div style="overflow-x: hidden; overflow-y: hidden" data-plitzi-el="left-column"><span data-id="cart">2 items</span></div>';
    const column = document.body.firstElementChild;
    const boxes = new Map<Element | null, DOMRect>([
      [column, { left: 0, top: 118, right: 300, bottom: 613, width: 300, height: 495 } as DOMRect],
      [
        document.querySelector('[data-id="cart"]'),
        { left: 0, top: 614, right: 300, bottom: 1079, width: 300, height: 465 } as DOMRect
      ]
    ]);
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement
    ) {
      return boxes.get(this) ?? ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 } as DOMRect);
    });

    expect(inspector.element('cart')).toMatchObject({
      visible: false,
      sight:
        'clipped by left-column, which hides what spills past it and does not scroll: nothing a visitor does brings it into sight'
    });
    rect.mockRestore();
  });

  it('finds an element inside a component, and says which component an instance places', () => {
    const withComponent = createStore<Record<string, unknown>>(() => ({
      schema: {
        flat: {
          lamp: {
            id: 'lamp',
            definition: { type: 'reference', label: 'lamp', items: [] },
            attributes: { referenceType: 'component', referenceId: 'card', title: 'Lamp' }
          }
        },
        components: {
          card: {
            id: 'card',
            rootId: 'card-root',
            flat: { 'card-title': { id: 'card-title', definition: { type: 'heading' }, attributes: {} } }
          }
        }
      },
      runtime: {}
    }));
    const reader = createAgentInspector({
      root: withComponent,
      writeState,
      writeTestAccount: vi.fn(),
      stores: () => [],
      runs: () => runs,
      setWatching,
      document
    });

    expect(reader.element('lamp')).toMatchObject({
      type: 'reference',
      instanceOf: 'card',
      attributes: { title: 'Lamp' }
    });
    expect(reader.element('card-title')).toMatchObject({ type: 'heading', inComponent: 'card' });
  });

  // A conversation's provider failed on the page server on every load and the browser answered it after: no check saw it.
  it('says why each server element failed on the page server, though the browser answered it since', () => {
    expect(inspector.serverFailures()).toEqual({
      dmThread: 'Action "dm-thread" refused this render: invalid_input — Invalid input: with'
    });
    expect(inspector.help()).toContain('serverFailures()');
  });

  it('keeps the last flows, and says them in the console on request', () => {
    const run = flowRunOf(flowLog('completed'));
    if (run) {
      runs.push(run, run, run);
    }

    expect(inspector.flows(2)).toHaveLength(2);
    expect(inspector.watch()).toMatch(/said in the console/);
    expect(setWatching).toHaveBeenCalledWith(true);
    expect(inspector.help()).toContain('setState(key, value)');
  });
});
