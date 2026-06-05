import { afterEach, describe, expect, it } from 'vitest';

import { __setCodegenEnabled, UNCHANGED, writeByPath } from './writeByPath';
import parsePath from '../../helpers/parsePath';

// `writeByPath` has two interchangeable implementations: a `new Function` codegen (fast path) and a recursive
// fallback used when a strict CSP blocks `new Function`. Every behavioural test runs against BOTH so the fallback
// — which production CSP environments depend on — stays correct and identical to the fast path.
const write = (root: unknown, path: string, value: unknown, isFn = false) =>
  writeByPath(root, path, parsePath(path), value, isFn);

afterEach(() => __setCodegenEnabled(undefined));

describe.each([
  ['codegen', true],
  ['recursive fallback', false]
])('writeByPath (%s)', (_label, enabled) => {
  const setup = () => __setCodegenEnabled(enabled);

  it('writes a deep leaf with structural sharing', () => {
    setup();
    const prev = { a: { b: { c: 1 } }, sibling: { kept: true } };
    const next = write(prev, 'a.b.c', 2) as typeof prev;

    expect(next).not.toBe(UNCHANGED);
    expect(next.a.b.c).toBe(2);
    expect(prev.a.b.c).toBe(1); // immutable
    expect(next.sibling).toBe(prev.sibling); // untouched subtree shared
    expect(next.a).not.toBe(prev.a); // touched spine cloned
  });

  it('returns UNCHANGED when the leaf value is identical', () => {
    setup();
    expect(write({ a: { b: 5 } }, 'a.b', 5)).toBe(UNCHANGED);
  });

  it('resolves an updater function against the previous leaf', () => {
    setup();
    const next = write({ a: { b: 10 } }, 'a.b', (p: number) => p + 1, true) as { a: { b: number } };

    expect(next.a.b).toBe(11);
  });

  it('creates missing intermediate objects', () => {
    setup();
    const next = write({}, 'a.b.c', 7) as { a: { b: { c: number } } };

    expect(next.a.b.c).toBe(7);
  });

  it('handles non-identifier segments safely (no code injection, bracket access)', () => {
    setup();
    // Breakout chars (quote/bracket/brace/semicolon) but no dots (the path separator). If a segment were
    // concatenated into the codegen body unescaped this would be a SyntaxError or execute; JSON.stringify keeps
    // it an inert string key.
    const evil = 'a"]; b=1; c[{';
    const next = write({}, `flat.${evil}`, 1) as Record<string, Record<string, number>>;

    expect(next.flat[evil]).toBe(1);
  });

  it('writes through array-index-like and hyphenated segments', () => {
    setup();
    const next = write({ list: { '0': { 'a-b': 1 } } }, 'list.0.a-b', 9) as Record<
      string,
      Record<string, Record<string, number>>
    >;

    expect(next.list['0']['a-b']).toBe(9);
  });
});
