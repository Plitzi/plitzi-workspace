import { describe, expect, it } from 'vitest';

import { evaluateComputed } from './computed';

describe('evaluateComputed', () => {
  const globals = { state: { favourites: ['a', 'b'], runs: 3 }, variables: { bonus: 25 } };

  it('gives a single expression its value, and anything else its text', () => {
    expect(
      evaluateComputed(
        { xp: '{{ state.favourites|length * 10 + state.runs }}', label: '{{ state.runs }} runs' },
        globals
      )
    ).toEqual({ xp: 23, label: '3 runs' });
  });

  it('lets a value read the ones declared before it, and the variables by name', () => {
    expect(
      evaluateComputed({ xp: '{{ state.runs * 100 }}', level: '{{ (computed.xp + bonus) // 100 }}' }, globals)
    ).toEqual({ xp: 300, level: 3 });
  });
});
