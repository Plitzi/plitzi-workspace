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

  /**
   * A flow reads its sources before every step and every `when`. Evaluating a space's computed values each time was the
   * bulk of a busy frame; over the same snapshots the answer is the same one, and only a change evaluates again.
   */
  it('evaluates once over the same snapshots, and again when one of them changes', () => {
    const definitions = { label: '{{ state.open ? "open" : "shut" }}' };
    const state = { open: true };
    const sources = { theme: { resolved: 'dark' } };

    const first = liveSources(sources, state, definitions).computed;
    const again = liveSources(sources, state, definitions).computed;
    const changed = liveSources(sources, { open: false }, definitions).computed;
    const otherTheme = liveSources({ theme: { resolved: 'light' } }, { open: false }, definitions).computed;

    expect(again).toBe(first);
    expect(changed).toEqual({ label: 'shut' });
    expect(otherTheme).not.toBe(changed);
  });
});
