import { stripVTControlCharacters } from 'node:util';

import { describe, expect, it } from 'vitest';

import { nextText } from './next';

// lx-controls: an agent met Plitzi's frictions and said them only in its last words, which the run's feedback never reads.
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
