import { act, renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import useElementState from './useElementState';

import type { ElementBinding } from '@plitzi/sdk-shared';

const binding = (toPath: string, enabled = true): ElementBinding => ({
  id: toPath,
  source: 'variables',
  toPath,
  enabled
});

describe('useElementState', () => {
  it('does not change state and returns false when not in preview mode', () => {
    const { result } = renderHook(() => useElementState({ previewMode: false }));

    let returned = true;
    act(() => {
      returned = result.current.setElementState({ foo: 'bar' });
    });

    expect(returned).toBe(false);
    expect(result.current.state).toEqual({});
  });

  it('updates state and returns true in preview mode', () => {
    const { result } = renderHook(() => useElementState({ previewMode: true }));

    let returned = false;
    act(() => {
      returned = result.current.setElementState({ foo: 'bar' });
    });

    expect(returned).toBe(true);
    expect(result.current.state).toEqual({ foo: 'bar' });
  });

  it('resets state to an empty object when called without a value', () => {
    const { result } = renderHook(() => useElementState({ previewMode: true }));

    act(() => {
      result.current.setElementState({ foo: 'bar' });
    });
    act(() => {
      result.current.setElementState();
    });

    expect(result.current.state).toEqual({});
  });

  it('supports a function updater', () => {
    const { result } = renderHook(() => useElementState({ previewMode: true }));

    act(() => {
      result.current.setElementState({ count: 1 });
    });
    act(() => {
      result.current.setElementState((prev: Record<string, unknown>) => ({
        count: (prev.count as number) + 1
      }));
    });

    expect(result.current.state).toEqual({ count: 2 });
  });

  it('omits attribute-bound keys from the next state', () => {
    const { result } = renderHook(() =>
      useElementState({ previewMode: true, bindings: { attributes: [binding('text')] } })
    );

    act(() => {
      result.current.setElementState({ text: 'bound', other: 'kept' });
    });

    expect(result.current.state).toEqual({ other: 'kept' });
  });

  it('does not omit bindings that are disabled', () => {
    const { result } = renderHook(() =>
      useElementState({ previewMode: true, bindings: { attributes: [binding('text', false)] } })
    );

    act(() => {
      result.current.setElementState({ text: 'kept' });
    });

    expect(result.current.state).toEqual({ text: 'kept' });
  });
});
