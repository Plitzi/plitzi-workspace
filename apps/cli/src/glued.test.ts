import { describe, expect, it } from 'vitest';

import { unglued } from './glued';

// Twelve runs were refused "unknown option '--steps  click …'": zsh hands a variable's flags as one argument.
describe('flags a shell handed as one argument', () => {
  it('splits one option from its value, and several flags where each starts — anything else as it is', () => {
    expect(unglued(['page', 'measure', '/rooms/new', '--steps  click a; click b'])).toEqual({
      args: ['page', 'measure', '/rooms/new', '--steps', 'click a; click b'],
      split: ['--steps  click a; click b']
    });
    expect(unglued(['page', 'check', '/', '--as mika --width 390,1440']).args).toEqual([
      'page',
      'check',
      '/',
      '--as',
      'mika',
      '--width',
      '390,1440'
    ]);
    expect(unglued(['task', 'tell', 'it works -- fine', '--width', '390']).args).toEqual([
      'task',
      'tell',
      'it works -- fine',
      '--width',
      '390'
    ]);
    expect(unglued(['--json']).split).toEqual([]);
  });
});
