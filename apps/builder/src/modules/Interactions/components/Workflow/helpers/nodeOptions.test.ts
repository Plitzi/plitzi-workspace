import { describe, expect, it } from 'vitest';

import { nodeOptionGroups, selectedNodeOption } from './nodeOptions';

import type { InteractionCallback } from '@plitzi/sdk-shared';

const step = (action: string, extra: Partial<InteractionCallback> = {}): InteractionCallback => ({
  action,
  title: action,
  type: 'task',
  params: {},
  ...extra
});

describe('the step picker', () => {
  const groups = nodeOptionGroups([
    step('webhook', { type: 'trigger' }),
    step('http.request'),
    step('seismic.feed', { group: 'Functions' }),
    step('kv.get'),
    step('log', { type: 'utility' })
  ]);

  it('lists a space’s own functions apart from the platform’s tasks, and leaves the triggers out', () => {
    expect(groups.map(group => [group.label, group.options.map(option => option.label)])).toEqual([
      ['Tasks', ['http.request', 'kv.get']],
      ['Functions', ['seismic.feed']],
      ['Utilities', ['log']]
    ]);
  });

  it('finds the step a node is set to under whichever heading of its type has it', () => {
    expect(selectedNodeOption(groups, 'task', '', 'seismic.feed')?.label).toBe('seismic.feed');
    expect(selectedNodeOption(groups, 'task', '', 'kv.get')?.label).toBe('kv.get');
    expect(selectedNodeOption(groups, 'utility', '', 'kv.get')).toBeUndefined();
  });
});
