import { stripVTControlCharacters } from 'node:util';

import { describe, expect, it } from 'vitest';

import { nextText } from './next';

// An agent met Plitzi's frictions and said them only in its last words, which the run's feedback never reads.
describe('plitzi task next, with nothing left', () => {
  it('asks for what of Plitzi got in the way before the agent stops', () => {
    const said = stripVTControlCharacters(
      nextText(
        { why: 'every task is done. You can stop', ready: [], messages: [], finished: true, scratch: '/s' },
        'dev-1'
      )
    );

    expect(said).toContain('plitzi run notice --plitzi');
    expect(
      stripVTControlCharacters(nextText({ why: 'nothing is ready', ready: [], messages: [], scratch: '/s' }, 'dev-1'))
    ).not.toContain('--plitzi');
  });
});

// encore-14's scout kept its answers' last line alone, and missed two of the lead's redirects for 20 minutes.
describe('what the lead said, in an answer', () => {
  it('comes last, the newest thing said', () => {
    const said = stripVTControlCharacters(
      nextText(
        {
          why: 'nothing is ready',
          ready: [],
          messages: [{ id: 'm2', at: '2026-10-27T15:00:00.000Z', from: 'lead', to: 's-scope', text: 'Stop b-38 now' }],
          scratch: '/s'
        },
        'scout-1'
      )
    ).split('\n');

    expect(said.at(-1)).toBe('  ✉ lead (m2): Stop b-38 now');
  });
});
