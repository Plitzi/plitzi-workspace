import { stripVTControlCharacters } from 'node:util';

import { describe, expect, it } from 'vitest';

import { attentionLines } from './monitorAttention';

import type { RunView } from '../../runs/view';

// velada-polish: what needed attention was a wall of sentences, each with its task and agent somewhere in it.
describe('what needs attention, as the monitor lists it', () => {
  it('says for whom, what, the task and its agent in columns — the most pressing first, what is only to know last', () => {
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
      // Only the fields the table reads: a whole view is the run's, and no part of what is tested.
    } as unknown as RunView;

    const lines = attentionLines(view, 160, 5).map(line => stripVTControlCharacters(line).trimEnd());

    expect(lines[0]).toMatch(/^ ■ you\s+reconciliation\s+In reconciliation: theme\.ts$/);
    expect(lines[1]).toMatch(/^ ⚠ lead\s+question\s+t-404\s+dev-3\s+\(m5\) a 404 page check can never pass\?$/);
    expect(lines[2]).toMatch(/^ ⚠ lead\s+to know\s+t-faq\s+dev-1\s+\(m3\) the pill is gold$/);
  });
});
