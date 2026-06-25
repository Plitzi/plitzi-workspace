import { describe, it, expect } from 'vitest';

import createStore from './createStore';

// `exclusive` keys let a scoped store fully shadow the parent at a key it owns — no deep-merge, no fall-through —
// so a per-instance slice (an element's `state`) stays isolated from an ancestor scope that uses the same key.

type S = { state: Record<string, unknown>; runtime: { sources: Record<string, unknown> } };

describe('scoped store: exclusive keys', () => {
  it('without exclusive, an owned object key deep-merges with the parent (the leak)', () => {
    const parent = createStore<S>({ state: { foo: 1 }, runtime: { sources: {} } });
    const child = createStore<S>({ state: {} }, { parent });

    expect(child.getPath('state')).toEqual({ foo: 1 });
  });

  it('with exclusive, the owned key shadows the parent — no merge', () => {
    const parent = createStore<S>({ state: { foo: 1 }, runtime: { sources: {} } });
    const child = createStore<S>({ state: {} }, { parent, exclusive: ['state'] });

    expect(child.getPath('state')).toEqual({});
  });

  it('exclusive shadows deep paths too (parent value never bleeds in)', () => {
    const parent = createStore<S>({ state: { foo: 1 }, runtime: { sources: {} } });
    const child = createStore<S>({ state: { bar: 2 } }, { parent, exclusive: ['state'] });

    expect(child.getPath('state')).toEqual({ bar: 2 });
    expect(child.getPath('state.foo')).toBeUndefined();
    expect(child.getPath('state.bar')).toBe(2);
  });

  it('the exclusive key shadows in the full-state view as well', () => {
    const parent = createStore<S>({ state: { foo: 1 }, runtime: { sources: {} } });
    const child = createStore<S>({ state: { bar: 2 } }, { parent, exclusive: ['state'] });

    expect(child.getState().state).toEqual({ bar: 2 });
  });

  it('non-exclusive keys still inherit and merge through the chain', () => {
    const parent = createStore<S>({ state: { foo: 1 }, runtime: { sources: { a: 1 } } });
    const child = createStore<S>({ state: {}, runtime: { sources: { b: 2 } } }, { parent, exclusive: ['state'] });

    // `runtime.sources` is not exclusive → still deep-merged across the chain.
    expect(child.getPath('runtime.sources')).toEqual({ a: 1, b: 2 });
    // `state` is exclusive → isolated.
    expect(child.getPath('state')).toEqual({});
  });

  it('a key the scope does not seed is still inherited even if listed as exclusive', () => {
    const parent = createStore<S>({ state: { foo: 1 }, runtime: { sources: {} } });
    const child = createStore<S>({ runtime: { sources: {} } }, { parent, exclusive: ['state'] });

    // The child never seeded `state`, so exclusivity does not apply — it inherits the parent's.
    expect(child.getPath('state')).toEqual({ foo: 1 });
  });

  it('an exclusive write stays local and does not touch the parent', () => {
    const parent = createStore<S>({ state: { foo: 1 }, runtime: { sources: {} } });
    const child = createStore<S>({ state: {} }, { parent, exclusive: ['state'] });

    child.setState('state', { bar: 2 });

    expect(child.getPath('state')).toEqual({ bar: 2 });
    expect(parent.getPath('state')).toEqual({ foo: 1 });
  });
});
