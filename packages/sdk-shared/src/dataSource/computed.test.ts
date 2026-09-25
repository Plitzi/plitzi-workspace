import { describe, expect, it } from 'vitest';

import { evaluateComputed, liveSources } from './computed';

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

describe('liveSources', () => {
  const rendered = {
    state: { open: false },
    computed: { label: 'closed' },
    theme: { resolved: 'dark' },
    list_rows: { item: 1 }
  };

  it('reads the state from the store, not from what the last render copied', () => {
    expect(liveSources(rendered, { open: true }, undefined)).toEqual({ ...rendered, state: { open: true } });
  });

  it('evaluates the computed values over that state, with the other globals as rendered', () => {
    const definitions = { label: '{{ state.open ? "open" : "closed" }}', scheme: '{{ theme.resolved }}' };

    expect(liveSources(rendered, { open: true }, definitions).computed).toEqual({ label: 'open', scheme: 'dark' });
  });

  it('keeps every other source — a list row a flow runs in is one', () => {
    expect(liveSources(rendered, {}, {}).list_rows).toEqual({ item: 1 });
  });

  it('treats a missing state as an empty one', () => {
    expect(liveSources(rendered, undefined, undefined).state).toEqual({});
  });
});
