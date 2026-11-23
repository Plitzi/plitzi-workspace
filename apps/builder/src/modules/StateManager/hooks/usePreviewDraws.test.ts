import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useBuilderStore } from '@plitzi/sdk-shared/store';

import usePreviewDraws from './usePreviewDraws';

import type { Element } from '@plitzi/sdk-shared';

vi.mock('@plitzi/sdk-shared/store', () => ({ useBuilderStore: vi.fn() }));

const setShown = vi.fn();

const element = (id: string, type: string, attributes: Record<string, unknown> = {}, items?: string[]): Element => ({
  id,
  attributes,
  definition: { rootId: 'home', label: type, type, styleSelectors: { base: '' }, ...(items ? { items } : {}) }
});

/** A space holding one test by chance, two variants at 50 each. */
const loaded = {
  pricing: element('pricing', 'variants', { experiment: 'pricing' }, ['a', 'b']),
  a: element('a', 'variantItem', { weight: 50 }),
  b: element('b', 'variantItem', { weight: 50 })
};

/** The builder's store as the hook reads it: the space's tree — `undefined` before it has loaded — and the preview's. */
const storeWith = (flat: Record<string, Element> | undefined) => {
  // The hook reads one list of keys and one key with its setter: answered as the store answers each.
  vi.mocked(useBuilderStore).mockImplementation(((keys: unknown) =>
    Array.isArray(keys)
      ? [[flat, {}, undefined, undefined]]
      : [undefined, setShown]) as unknown as typeof useBuilderStore);
};

beforeEach(() => {
  setShown.mockClear();
});

describe('usePreviewDraws', () => {
  // The builder mounts it above the space's loading: the first build read the tree before it was there and threw.
  it('does nothing, and throws nothing, before the space has loaded', () => {
    storeWith(undefined);

    expect(() => renderHook(() => usePreviewDraws(true))).not.toThrow();
    expect(setShown).not.toHaveBeenCalled();
  });

  it('draws every test with no variant yet once the space is there, in the preview', () => {
    storeWith(loaded);
    renderHook(() => usePreviewDraws(true));

    expect(setShown).toHaveBeenCalledTimes(1);
    expect(Object.keys(setShown.mock.calls[0][0] as object)).toEqual(['pricing']);
  });

  it('draws nothing while editing: the canvas shows what each test’s settings pick', () => {
    storeWith(loaded);
    renderHook(() => usePreviewDraws(false));

    expect(setShown).not.toHaveBeenCalled();
  });
});
