import { describe, expect, it } from 'vitest';

import { createActionsModule } from '../index';

import type { ActionDocument, ActionEntry, ElementInteraction } from '@plitzi/sdk-shared';

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

const counterAction = (nodes: ActionDocument['nodes'], valueType: 'number' | 'text' = 'number'): ActionEntry => ({
  id: 'counter',
  document: {
    name: 'Counter',
    enabled: true,
    access: { mode: 'public' },
    triggers: [{ type: 'call' }],
    input: {},
    output: { value: { type: valueType } },
    nodes
  }
});

const run = (entry: ActionEntry, spaceId = 1) => {
  const module = createActionsModule({ lookups: { getAction: () => Promise.resolve(undefined) } });

  return {
    module,
    call: (id = 'run-1', space = spaceId) =>
      module.runAction({
        entry,
        input: {},
        spaceId: space,
        environment: 'main',
        trigger: 'call',
        runId: id
      })
  };
};

const incrementFlow = counterAction({
  start: node('start', { type: 'trigger', action: 'call', afterNode: 'inc' }),
  inc: node('inc', { action: 'kv.increment', afterNode: 'ret', params: { key: 'hits', amount: '1' } }),
  ret: node('ret', { action: 'flow.return', params: { values: '{"value": "{{ inc.value }}"}' } })
});

describe('kv tasks', () => {
  it('counts across runs of the same action', async () => {
    const { call } = run(incrementFlow);

    await call('run-1');
    const second = await call('run-2');

    expect(second.output).toEqual({ value: 2 });
  });

  it('keeps one space out of another space’s keys', async () => {
    const { call } = run(incrementFlow);

    await call('run-1', 1);
    const other = await call('run-2', 2);

    // Same key, same action, different space: the runner prefixes it, so this is a fresh counter and not a read of
    // somebody else's.
    expect(other.output).toEqual({ value: 1 });
  });

  it('reads back what it stored', async () => {
    const { call } = run(
      counterAction(
        {
          start: node('start', { type: 'trigger', action: 'call', afterNode: 'set' }),
          set: node('set', { action: 'kv.set', afterNode: 'get', params: { key: 'greeting', value: 'hola' } }),
          get: node('get', { action: 'kv.get', afterNode: 'ret', params: { key: 'greeting' } }),
          ret: node('ret', { action: 'flow.return', params: { values: '{"value": "{{ get.value }}"}' } })
        },
        // Declared as text: the output contract coerces, so a number-typed key would drop this string rather than
        // return it — which is the projection doing its job, not a bug worth working around.
        'text'
      )
    );

    const result = await call();

    expect(result.output).toEqual({ value: 'hola' });
  });
});
