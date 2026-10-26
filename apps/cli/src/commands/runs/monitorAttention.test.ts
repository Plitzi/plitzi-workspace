import { describe, expect, it } from 'vitest';

import { fixOf, needsOf } from './monitorAttention';

import type { RunView } from '../../runs/view';

// What needed attention was a wall of sentences, each with its task and agent somewhere in it, and the command that
// answered it printed in its row.
describe('what needs someone, as the panel asks it', () => {
  it('says each notice by its sort, its task and agent — the person’s first, what is only to know last', () => {
    const view = {
      tasks: [
        { id: 't-faq', agent: 'dev-1' },
        { id: 't-404', agent: 'dev-3' }
      ],
      attention: [
        {
          kind: 'message',
          task: 't-faq',
          message: 'm3',
          fyi: true,
          who: 'lead',
          text: 't-faq says (m3), for you to know: the pill is gold — read: plitzi task inbox'
        },
        {
          kind: 'message',
          task: 't-404',
          message: 'm5',
          who: 'lead',
          text: 't-404 asks (m5): a 404 page check can never pass?'
        },
        { kind: 'reconciliation', who: 'person', text: 'In reconciliation: theme.ts' }
      ]
      // Only the fields the notices read: a whole view is the run's, and no part of what is tested.
    } as unknown as RunView;

    expect(needsOf(view).map(need => [need.person, need.sort, need.task, need.agent, need.said])).toEqual([
      [true, 'reconciliation', undefined, undefined, 'In reconciliation: theme.ts'],
      [false, 'question', 't-404', 'dev-3', '(m5) a 404 page check can never pass?'],
      [false, 'to know', 't-faq', 'dev-1', '(m3) the pill is gold']
    ]);
  });

  it('finds the command a notice names, whole, to copy', () => {
    expect(
      fixOf(
        'agent-4, of the team’s base, is not running: start it again — plitzi run agent agent-4 --launch — it waits'
      )
    ).toBe('plitzi run agent agent-4 --launch');
    expect(fixOf('the block holds its file (plitzi task claim src/space/theme.ts --release), then block again')).toBe(
      'plitzi task claim src/space/theme.ts --release'
    );
    expect(fixOf('agent-1 and agent-3 have nothing to take')).toBeUndefined();
  });
});
