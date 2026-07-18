import { describe, expect, it } from 'vitest';

import { findNodeDefinition, getNodeWarnings, summarizeFlow, worstLevel } from './nodeWarnings';

import type { ElementInteraction, InteractionCallback } from '@plitzi/sdk-shared';

const definitions = [
  { type: 'utility', action: 'delayTime', title: 'Delay', params: {} },
  { type: 'callback', action: 'setState', title: 'Set State', elementId: 'nice-work-btn', params: {} },
  { type: 'globalCallback', action: 'addNotification', title: 'Notify', elementId: 'space', params: {} }
] as unknown as InteractionCallback[];

const node = (over: Partial<ElementInteraction>): ElementInteraction => ({
  id: 'n',
  title: 't',
  type: 'utility',
  action: 'delayTime',
  params: {},
  preview: {},
  elementId: null,
  beforeNode: '',
  afterNode: '',
  flowId: 'n',
  enabled: true,
  ...over
});

describe('getNodeWarnings', () => {
  it('accepts a clean utility with no target', () => {
    const n = node({ type: 'utility', action: 'delayTime', elementId: null });
    expect(getNodeWarnings(n, findNodeDefinition(n, definitions), false)).toEqual([]);
  });

  it('flags a utility that carries a real (host) target as a warning (still runs)', () => {
    const n = node({ type: 'utility', action: 'delayTime', elementId: 'nice-work-btn' });
    const warnings = getNodeWarnings(n, findNodeDefinition(n, definitions), false);
    expect(warnings.some(w => w.message.includes('utility runs on no element') && w.level === 'warning')).toBe(true);
    expect(worstLevel(warnings)).toBe('warning');
  });

  it('flags the stringified nullish target "undefined"', () => {
    const n = node({ type: 'utility', action: 'delayTime', elementId: 'undefined' });
    const warnings = getNodeWarnings(n, findNodeDefinition(n, definitions), false);
    expect(warnings.some(w => w.message.includes('Invalid target'))).toBe(true);
  });

  it('flags an unrecognized action as danger (will not run)', () => {
    const n = node({ type: 'callback', action: 'bogusAction', elementId: 'nice-work-btn' });
    const warnings = getNodeWarnings(n, findNodeDefinition(n, definitions), false);
    expect(warnings.some(w => w.message.includes('not recognized') && w.level === 'danger')).toBe(true);
    expect(worstLevel(warnings)).toBe('danger');
  });

  it('flags a step with no action selected as danger', () => {
    const n = node({ type: 'callback', action: '', elementId: '' });
    const warnings = getNodeWarnings(n, undefined, false);
    expect(warnings.some(w => w.message.includes('No action selected') && w.level === 'danger')).toBe(true);
  });

  it('does not flag a well-formed element callback', () => {
    const n = node({ type: 'callback', action: 'setState', elementId: 'nice-work-btn' });
    expect(getNodeWarnings(n, findNodeDefinition(n, definitions), false)).toEqual([]);
  });
});

describe('summarizeFlow', () => {
  it('counts malformed nodes and reports the worst severity (danger wins)', () => {
    const nodes: Record<string, ElementInteraction> = {
      a: node({ id: 'a', type: 'callback', action: 'setState', elementId: 'nice-work-btn' }),
      b: node({ id: 'b', type: 'utility', action: 'delayTime', elementId: 'nice-work-btn' }),
      c: node({ id: 'c', type: 'callback', action: 'bogusAction', elementId: 'x' })
    };
    expect(summarizeFlow(nodes, definitions)).toEqual({ count: 2, level: 'danger' });
  });

  it('reports warning level when only warning-level nodes are present', () => {
    const nodes: Record<string, ElementInteraction> = {
      b: node({ id: 'b', type: 'utility', action: 'delayTime', elementId: 'nice-work-btn' })
    };
    expect(summarizeFlow(nodes, definitions)).toEqual({ count: 1, level: 'warning' });
  });
});
