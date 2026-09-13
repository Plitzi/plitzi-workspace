import { describe, expect, it } from 'vitest';

import mapFunctionValues, { readFunctionLabel } from './mapFunctionValues';

/**
 * The store viewer walks the WHOLE store on every store write, and under `debugMode` that is constantly.
 *
 * On a dense page the store holds `schema.flat` with thousands of elements, so the two things that matter here are
 * that the walk is fast and that it CLONES NOTHING it did not have to change — a fresh object for every subtree
 * would mean the JSON view re-rendering, and re-diffing, all of it on every keystroke.
 */

const denseStore = (elements: number) => {
  const flat: Record<string, unknown> = {};
  for (let index = 0; index < elements; index += 1) {
    flat[`el-${index}`] = {
      id: `el-${index}`,
      attributes: { content: 'text', subType: 'div' },
      definition: {
        rootId: 'page',
        label: `Element ${index}`,
        type: 'container',
        styleSelectors: { base: `cls-${index}` },
        items: [`el-${index + 1}`]
      }
    };
  }

  return { schema: { flat }, navigation: { currentPageId: 'page' }, render: { previewMode: true } };
};

describe('mapFunctionValues under a dense page', () => {
  it('walks a two-thousand element store quickly', () => {
    const state = denseStore(2000);

    const started = performance.now();
    mapFunctionValues(state);
    const elapsed = performance.now() - started;

    expect(elapsed).toBeLessThan(500);
  });

  /**
   * The identity rule, which is the whole reason this is not a plain deep clone: a store with no functions in it
   * comes back AS ITSELF, so the viewer's diffing sees nothing changed and re-renders nothing.
   */
  it('returns the same object when there was nothing to swap', () => {
    const state = denseStore(200);

    expect(mapFunctionValues(state)).toBe(state);
  });

  it('keeps the identity of every subtree that has no function under it', () => {
    const state = { ...denseStore(50), actions: { run: () => undefined } };
    const mapped = mapFunctionValues(state) as typeof state;

    expect(mapped).not.toBe(state);
    // Only the branch that held the function is rebuilt; the schema is handed straight back.
    expect(mapped.schema).toBe(state.schema);
    expect(readFunctionLabel(mapped.actions.run as unknown as string)).toBe('ƒ run()');
  });

  it('survives a store with nothing in it', () => {
    expect(mapFunctionValues()).toBeUndefined();
    expect(mapFunctionValues({})).toEqual({});
  });
});
