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
        callerId: 'ip:198.51.100.7',
        spaceId: space,
        environment: 'main',
        trigger: 'call',
        runId: id
      })
  };
};

const incrementFlow = counterAction({
  start: node('start', { type: 'trigger', action: 'call', params: { access: 'public' }, afterNode: 'inc' }),
  inc: node('inc', { action: 'kv.increment', afterNode: 'ret', params: { key: 'hits', amount: '1' } }),
  ret: node('ret', { action: 'flow.output', params: { values: '{"value": {{ inc.value }}}' } })
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
          start: node('start', {
            type: 'trigger',
            action: 'call',
            params: { access: 'public' },
            afterNode: 'set'
          }),
          set: node('set', { action: 'kv.set', afterNode: 'get', params: { key: 'greeting', value: 'hola' } }),
          get: node('get', { action: 'kv.get', afterNode: 'ret', params: { key: 'greeting' } }),
          ret: node('ret', { action: 'flow.output', params: { values: '{"value": "{{ get.value }}"}' } })
        },
        // Quoted on purpose: the output step's JSON IS the shape now, so a token in quotes answers text and an
        // unquoted one keeps its own type. There is no contract left to coerce it into something else.
        'text'
      )
    );

    const result = await call();

    expect(result.output).toEqual({ value: 'hola' });
  });

  it('writes over a value only when it is still the one read — the loser is told', async () => {
    const claim = counterAction(
      {
        start: node('start', { type: 'trigger', action: 'call', params: { access: 'public' }, afterNode: 'take' }),
        take: node('take', {
          action: 'kv.setIf',
          afterNode: 'ret',
          params: { key: 'seat:12', expected: '', value: 'taken' }
        }),
        ret: node('ret', { action: 'flow.output', params: { values: '{"value": {{ take.written }}}' } })
      },
      'text'
    );
    const { call } = run(claim);

    expect((await call('run-1')).output).toEqual({ value: true });
    expect((await call('run-2')).output).toEqual({ value: false });
  });
});

describe('list tasks', () => {
  const listAction = (score: string): ActionEntry => ({
    id: 'scores',
    document: {
      name: 'Scores',
      output: { top: { type: 'json' } },
      nodes: {
        start: node('start', { type: 'trigger', action: 'call', params: { access: 'public' }, afterNode: 'put' }),
        put: node('put', {
          action: 'list.put',
          afterNode: 'read',
          params: { list: 'leaderboard', id: `p${score}`, score, value: `{"points": ${score}}` }
        }),
        read: node('read', { action: 'list.range', afterNode: 'ret', params: { list: 'leaderboard', limit: '2' } }),
        ret: node('ret', { action: 'flow.output', params: { values: '{"top": {{ read.entries|json_encode }}}' } })
      }
    }
  });

  it('answers the highest scores first, a window of them', async () => {
    const module = createActionsModule({ lookups: { getAction: () => Promise.resolve(undefined) } });
    const call = (score: string) =>
      module.runAction({
        entry: listAction(score),
        input: {},
        callerId: 'ip:198.51.100.7',
        spaceId: 1,
        environment: 'main',
        trigger: 'call',
        runId: `run-${score}`
      });

    await call('5');
    await call('30');
    const result = await call('12');

    expect(result.output.top).toEqual([
      { id: 'p30', score: 30, value: { points: 30 } },
      { id: 'p12', score: 12, value: { points: 12 } }
    ]);
  });
});

describe('flow.rateLimit', () => {
  const limited: ActionEntry = counterAction({
    start: node('start', { type: 'trigger', action: 'call', params: { access: 'public' }, afterNode: 'limit' }),
    limit: node('limit', {
      action: 'flow.rateLimit',
      afterNode: 'ret',
      params: { bucket: 'comments', limit: '2', windowSeconds: '60', per: 'caller', message: 'Slow down' }
    }),
    ret: node('ret', { action: 'flow.output', params: { values: '{"value": {{ limit.remaining }}}' } })
  });

  const callAs = (module: ReturnType<typeof run>['module'], callerId: string, runId: string) =>
    module.runAction({
      entry: limited,
      input: {},
      callerId,
      spaceId: 1,
      environment: 'main',
      trigger: 'call',
      runId
    });

  it('lets a caller through up to the limit, then refuses them with the message', async () => {
    const { module } = run(limited);

    expect((await callAs(module, 'ip:198.51.100.7', 'r1')).output).toEqual({ value: 1 });
    expect((await callAs(module, 'ip:198.51.100.7', 'r2')).output).toEqual({ value: 0 });
    const refused = await callAs(module, 'ip:198.51.100.7', 'r3');

    expect(refused.status).toBe('failed');
    expect(refused.error).toBe('Slow down');
  });

  it('counts each person apart', async () => {
    const { module } = run(limited);
    await callAs(module, 'ip:198.51.100.7', 'r1');
    await callAs(module, 'ip:198.51.100.7', 'r2');

    expect((await callAs(module, 'user:42', 'r3')).status).toBe('completed');
  });
});
