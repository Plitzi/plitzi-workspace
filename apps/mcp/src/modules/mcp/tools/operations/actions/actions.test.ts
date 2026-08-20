import { describe, expect, it } from 'vitest';

import { deleteAction } from './deleteAction';
import { patchAction } from './patchAction';
import { upsertAction } from './upsertAction';
import { emptySpace } from '../../../helpers';

import type { UpsertAction } from './upsertAction';
import type { Space } from '../../../helpers';

const env = 'main';

const base = (overrides: Partial<UpsertAction> = {}): UpsertAction => ({
  type: 'upsertAction',
  ref: 'send-quote',
  name: 'Send quote',
  access: { mode: 'session' },
  triggers: [{ type: 'call' }],
  input: { amount: { type: 'number', required: true } },
  output: { total: { type: 'number' } },
  nodes: [
    {
      id: 'start',
      title: 'Called',
      type: 'trigger',
      action: 'call',
      params: {},
      afterNode: 'ret',
      beforeNode: '',
      enabled: true
    },
    {
      id: 'ret',
      title: 'Return',
      type: 'task',
      action: 'flow.output',
      params: { values: '{"total": "{{ input.amount }}"}' },
      afterNode: '',
      beforeNode: 'start',
      enabled: true
    }
  ],
  ...overrides
});

const spaceWith = (op: UpsertAction = base()): Space => {
  const space = emptySpace();
  upsertAction(space, env, op);

  return space;
};

describe('action ops', () => {
  it('creates an action and keys the flow by step id', () => {
    const space = emptySpace();

    const result = upsertAction(space, env, base());

    expect(result.created).toBe(1);
    expect(space.actions[0].id).toBe('send-quote');
    expect(Object.keys(space.actions[0].document.nodes)).toEqual(['start', 'ret']);
  });

  it('replaces the whole document on a second upsert', () => {
    const space = spaceWith();

    upsertAction(space, env, base({ name: 'Renamed', output: {} }));

    expect(space.actions).toHaveLength(1);
    expect(space.actions[0].document.name).toBe('Renamed');
    expect(space.actions[0].document.output).toEqual({});
  });

  // The rule the shared validator exists for, reached through the op the agent actually calls.
  it('refuses a browser step in a server flow', () => {
    const space = emptySpace();

    const result = upsertAction(
      space,
      env,
      base({
        nodes: [
          {
            id: 'start',
            title: 'Called',
            type: 'trigger',
            action: 'call',
            params: {},
            afterNode: 'set',
            beforeNode: '',
            enabled: true
          },
          {
            id: 'set',
            title: 'Set',
            type: 'task',
            action: 'setState',
            params: {},
            afterNode: '',
            beforeNode: 'start',
            enabled: true
          }
        ]
      })
    );

    expect(result.errors?.[0].message).toContain('<namespace>.<action>');
    expect(space.actions).toHaveLength(0);
  });

  it('patches one step and preserves the rest', () => {
    const space = spaceWith();

    const result = patchAction(space, env, {
      type: 'patchAction',
      ref: 'send-quote',
      nodes: [
        {
          id: 'ret',
          title: 'Return',
          type: 'task',
          action: 'flow.output',
          params: { values: '{"total": 0}' },
          afterNode: '',
          beforeNode: 'start',
          enabled: true
        }
      ]
    });

    expect(result.updated).toBe(1);
    expect(Object.keys(space.actions[0].document.nodes)).toEqual(['start', 'ret']);
    expect(space.actions[0].document.nodes.ret.params).toEqual({ values: '{"total": 0}' });
    expect(space.actions[0].document.input).toEqual({ amount: { type: 'number', required: true } });
  });

  it('validates the MERGED document, not the patch alone', () => {
    const space = spaceWith();

    // Removing the only trigger leaves a flow nothing can start — visible only against what it lands on.
    const result = patchAction(space, env, {
      type: 'patchAction',
      ref: 'send-quote',
      nodes: [
        {
          id: 'start',
          title: 'Called',
          type: 'trigger',
          action: 'call',
          params: {},
          afterNode: '',
          beforeNode: '',
          enabled: true,
          remove: true
        }
      ]
    });

    expect(result.errors?.[0].message).toContain('no trigger step');
    expect(space.actions[0].document.nodes.start).toBeDefined();
  });

  it('refuses to patch or delete an action that does not exist', () => {
    const space = spaceWith();

    expect(patchAction(space, env, { type: 'patchAction', ref: 'ghost' }).errors?.[0].message).toContain(
      'does not exist'
    );
    expect(deleteAction(space, env, { type: 'deleteAction', ref: 'ghost' }).errors?.[0].message).toContain(
      'does not exist'
    );
  });

  it('deletes an action and reports its resources stale', () => {
    const space = spaceWith();

    const result = deleteAction(space, env, { type: 'deleteAction', ref: 'send-quote' });

    expect(result.deleted).toBe(1);
    expect(space.actions).toHaveLength(0);
    expect(result.staleResources).toContain('plitzi://actions/main');
  });
});
