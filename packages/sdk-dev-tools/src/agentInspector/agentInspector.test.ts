// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import { createStore } from '@plitzi/nexus';

import { flowRunLine, flowRunOf } from './flowRuns';
import { createAgentInspector } from './inspector';

import type { FlowRun } from './flowRuns';
import type { ElementInteraction, Log } from '@plitzi/sdk-shared';

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
const flowLog = (status: 'completed' | 'failed'): Log => ({
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
      b: {
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
    runtime: { state: { count: 2 }, sources: { state: { count: 2 } }, elements: { cart: { open: true } } }
  }));
  const provider = createStore<Record<string, unknown>>(() => ({
    runtime: { sources: { apiContainer_site: { data: { total: 3 }, isLoading: false, refetch: () => undefined } } }
  }));
  const runs: FlowRun[] = [];
  const writeState = vi.fn();
  const setWatching = vi.fn();
  const inspector = createAgentInspector({
    root,
    writeState,
    stores: () => [provider],
    runs: () => runs,
    setWatching,
    document
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

  it('describes an element: what it is, its own state, and whether it is on screen', () => {
    document.body.innerHTML = '<span data-id="cart">2</span>';

    expect(inspector.element('cart')).toMatchObject({
      id: 'cart',
      type: 'text',
      attributes: { content: '{{ state.count }}' },
      bindings: [{ category: 'attributes', to: 'content', source: 'state.count', template: '{{ source }} items' }],
      state: { open: true },
      copies: 1,
      visible: false
    });
    expect(inspector.element('nowhere')).toBeUndefined();
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
