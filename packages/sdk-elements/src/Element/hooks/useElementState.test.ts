import { act, render as renderTree, renderHook } from '@testing-library/react';
import { createElement, Fragment } from 'react';
import { describe, it, expect } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

import useElementState from './useElementState';

import type { ElementBinding } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

const binding = (toPath: string, enabled = true): ElementBinding => ({
  id: toPath,
  source: 'variables',
  toPath,
  enabled
});

// Mirrors the per-element live scope `withElement` mounts: a live store owning a private `state` slice exclusively.
const elementScope = (segment: string, children: ReactNode) =>
  createElement(
    StoreProvider,
    { inherit: 'live', autoSync: false, isolate: ['state'], segment, value: { state: {} } },
    children
  );

const wrapper = ({ children }: { children: ReactNode }) => elementScope('el', children);

const render = <T>(hook: () => T) => renderHook(hook, { wrapper });

describe('useElementState', () => {
  it('does not change state and returns false when not in preview mode', () => {
    const { result } = render(() => useElementState({ previewMode: false }));

    let returned = true;
    act(() => {
      returned = result.current.setElementState({ foo: 'bar' });
    });

    expect(returned).toBe(false);
    expect(result.current.state).toEqual({});
  });

  it('updates state and returns true in preview mode', () => {
    const { result } = render(() => useElementState({ previewMode: true }));

    let returned = false;
    act(() => {
      returned = result.current.setElementState({ foo: 'bar' });
    });

    expect(returned).toBe(true);
    expect(result.current.state).toEqual({ foo: 'bar' });
  });

  it('resets state to an empty object when called without a value', () => {
    const { result } = render(() => useElementState({ previewMode: true }));

    act(() => {
      result.current.setElementState({ foo: 'bar' });
    });
    act(() => {
      result.current.setElementState();
    });

    expect(result.current.state).toEqual({});
  });

  it('supports a function updater', () => {
    const { result } = render(() => useElementState({ previewMode: true }));

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
    const { result } = render(() =>
      useElementState({
        previewMode: true,
        bindings: { attributes: [binding('text')] }
      })
    );

    act(() => {
      result.current.setElementState({ text: 'bound', other: 'kept' });
    });

    expect(result.current.state).toEqual({ other: 'kept' });
  });

  it('does not omit bindings that are disabled', () => {
    const { result } = render(() =>
      useElementState({
        previewMode: true,
        bindings: { attributes: [binding('text', false)] }
      })
    );

    act(() => {
      result.current.setElementState({ text: 'kept' });
    });

    expect(result.current.state).toEqual({ text: 'kept' });
  });

  it('isolates state between nested element scopes — an ancestor element state never leaks in', () => {
    const captured: Record<string, ReturnType<typeof useElementState>> = {};
    const Probe = ({ name }: { name: string }) => {
      captured[name] = useElementState({ previewMode: true });

      return null;
    };

    renderTree(
      elementScope(
        'outer',
        createElement(
          Fragment,
          null,
          createElement(Probe, { name: 'outer' }),
          elementScope('inner', createElement(Probe, { name: 'inner' }))
        )
      )
    );

    act(() => {
      captured.outer.setElementState({ a: 1 });
    });

    expect(captured.outer.state).toEqual({ a: 1 });
    expect(captured.inner.state).toEqual({});
  });
});
