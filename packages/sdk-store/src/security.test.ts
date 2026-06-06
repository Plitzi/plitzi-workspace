import { describe, it, expect } from 'vitest';

import createStore from './createStore';

// Adversarial: an attacker controls the path string or the seed object and tries to poison a prototype, inject a
// phantom key, or corrupt the store. The writers always clone and `getState` spreads, so `Object.prototype` is never
// the target — but a `__proto__` segment invokes the prototype setter, which is the one primitive that escapes
// "create an own property on a clone". Each test reproduces a real pre-fix corruption.

describe('security — prototype pollution', () => {
  it('rejects a `__proto__` segment in a setState path instead of swapping a prototype', () => {
    const store = createStore<Record<string, unknown>>({ a: { b: 1 } });

    expect(() => store.setState('a.__proto__.x' as never, 9 as never)).toThrow(/__proto__/);

    expect(({} as Record<string, unknown>).x).toBeUndefined(); // no global pollution
    expect((store.getState().a as Record<string, unknown>).x).toBeUndefined(); // no phantom key on the nested object
    expect(store.getState().a).toEqual({ b: 1 });
  });

  it('rejects a top-level `__proto__` write', () => {
    const store = createStore<Record<string, unknown>>({ a: 1 });

    expect(() => store.setState('__proto__' as never, { polluted: true } as never)).toThrow(/__proto__/);
    expect(() => store.setState('__proto__.polluted' as never, true as never)).toThrow(/__proto__/);

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(store.getState().polluted).toBeUndefined();
  });

  it('does not let a JSON-seeded child poison the merged state through deepMerge', () => {
    const parent = createStore<Record<string, unknown>>({ a: 1 });
    const evil = JSON.parse('{"__proto__":{"polluted":true}}') as Record<string, unknown>;
    const child = createStore<Record<string, unknown>>(evil, { parent });

    const merged = child.getState();

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(merged.polluted).toBeUndefined();
    expect((Object.getPrototypeOf(merged) as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('treats `constructor`/`prototype` as ordinary data keys (no global reach, so no over-blocking)', () => {
    const store = createStore<Record<string, unknown>>({});

    store.setState('constructor.prototype.evil' as never, 1 as never);

    expect(({} as Record<string, unknown>).evil).toBeUndefined(); // the writers cloned — Object.prototype is intact
    expect((store.getState().constructor as { prototype: Record<string, unknown> }).prototype.evil).toBe(1);
  });
});
