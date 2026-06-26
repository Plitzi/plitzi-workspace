import { act, render as renderTree, renderHook } from '@testing-library/react';
import { createElement } from 'react';
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

// Element state lives in the shared root store under `runtime.elements.<id>`. A plain root provider is enough; the
// hook resolves the nearest scope's `scopePath` (empty at the root) to build its slice path.
const rootWrapper = ({ children }: { children: ReactNode }) => createElement(StoreProvider, { value: {} }, children);

const render = <T>(hook: () => T) => renderHook(hook, { wrapper: rootWrapper });

describe('useElementState', () => {
  it('does not change state and returns false when not in preview mode', () => {
    const { result } = render(() => useElementState({ id: 'el', previewMode: false }));

    let returned = true;
    act(() => {
      returned = result.current.setElementState({ foo: 'bar' });
    });

    expect(returned).toBe(false);
    expect(result.current.state).toEqual({});
  });

  it('updates state and returns true in preview mode', () => {
    const { result } = render(() => useElementState({ id: 'el', previewMode: true }));

    let returned = false;
    act(() => {
      returned = result.current.setElementState({ foo: 'bar' });
    });

    expect(returned).toBe(true);
    expect(result.current.state).toEqual({ foo: 'bar' });
  });

  it('resets state to an empty object when called without a value', () => {
    const { result } = render(() => useElementState({ id: 'el', previewMode: true }));

    act(() => {
      result.current.setElementState({ foo: 'bar' });
    });
    act(() => {
      result.current.setElementState();
    });

    expect(result.current.state).toEqual({});
  });

  it('supports a function updater', () => {
    const { result } = render(() => useElementState({ id: 'el', previewMode: true }));

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
      useElementState({ id: 'el', previewMode: true, bindings: { attributes: [binding('text')] } })
    );

    act(() => {
      result.current.setElementState({ text: 'bound', other: 'kept' });
    });

    expect(result.current.state).toEqual({ other: 'kept' });
  });

  it('does not omit bindings that are disabled', () => {
    const { result } = render(() =>
      useElementState({ id: 'el', previewMode: true, bindings: { attributes: [binding('text', false)] } })
    );

    act(() => {
      result.current.setElementState({ text: 'kept' });
    });

    expect(result.current.state).toEqual({ text: 'kept' });
  });

  it('isolates state by element id within the same scope', () => {
    const captured: Record<string, ReturnType<typeof useElementState>> = {};
    const Probe = ({ id }: { id: string }) => {
      captured[id] = useElementState({ id, previewMode: true });

      return null;
    };

    renderTree(
      createElement(StoreProvider, { value: {} }, createElement(Probe, { id: 'a' }), createElement(Probe, { id: 'b' }))
    );

    act(() => {
      captured.a.setElementState({ v: 1 });
    });

    expect(captured.a.state).toEqual({ v: 1 });
    expect(captured.b.state).toEqual({});
  });

  it('isolates state between duplicated ids under distinct scopePaths (the list-row case)', () => {
    const captured: Record<string, ReturnType<typeof useElementState>> = {};
    // Same element id rendered under two scopes whose `segment` yields distinct scopePaths — the sub-key keeps each
    // instance's slice separate, exactly as list rows do.
    const Probe = ({ name }: { name: string }) => {
      captured[name] = useElementState({ id: 'dup', previewMode: true });

      return null;
    };

    renderTree(
      createElement(
        StoreProvider,
        { value: {} },
        createElement(
          StoreProvider,
          { inherit: 'live', segment: 'row#0', value: {} },
          createElement(Probe, { name: 'row0' })
        ),
        createElement(
          StoreProvider,
          { inherit: 'live', segment: 'row#1', value: {} },
          createElement(Probe, { name: 'row1' })
        )
      )
    );

    act(() => {
      captured.row0.setElementState({ v: 'a' });
    });
    act(() => {
      captured.row1.setElementState({ v: 'b' });
    });

    expect(captured.row0.state).toEqual({ v: 'a' });
    expect(captured.row1.state).toEqual({ v: 'b' });
  });
});
