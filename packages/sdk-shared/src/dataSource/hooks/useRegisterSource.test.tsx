import { renderHook, act, render } from '@testing-library/react';
import { createElement, useContext } from 'react';
import { describe, it, expect } from 'vitest';

import { StoreContext, StoreProvider } from '@plitzi/nexus/react';

import useRegisterSource from './useRegisterSource';

import type { StoreApi } from '@plitzi/nexus/react';
import type { ReactNode } from 'react';

type SourceState = Record<string, unknown>;

const useStoreCapture = (ref: { current: StoreApi<SourceState> | undefined }) => {
  ref.current = useContext(StoreContext) as StoreApi<SourceState>;
};

const createStoreProvider = (value: SourceState, children?: ReactNode) =>
  createElement(StoreProvider<SourceState>, { value }, children);

const makeWrapper =
  (value: SourceState = {}) =>
  ({ children }: { children?: ReactNode }) =>
    createStoreProvider(value, children);

const getSources = (store: StoreApi<SourceState> | undefined): Record<string, unknown> => {
  if (!store) {
    return {};
  }

  return (store.getState().sources ?? {}) as Record<string, unknown>;
};

describe('useRegisterSource', () => {
  it('registers source metadata on mount at sources.<uniqueId>', () => {
    const storeRef = { current: undefined as StoreApi<SourceState> | undefined };

    act(() => {
      renderHook(
        () => {
          useStoreCapture(storeRef);
          useRegisterSource({ id: 'form', source: 'form', name: 'My Form', fields: [] });
        },
        { wrapper: makeWrapper({}) }
      );
    });

    const sources = getSources(storeRef.current);
    const keys = Object.keys(sources);
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^form_/);

    const entry = sources[keys[0]] as { id: string; meta: { id: string; source: string; name: string } };
    expect(entry.id).toBe(keys[0]);
    expect(entry.meta.source).toBe('form');
    expect(entry.meta.name).toBe('My Form');
  });

  it('sets sources.<uniqueId> to undefined on unmount (cleanup)', () => {
    const storeRef = { current: undefined as StoreApi<SourceState> | undefined };

    const { unmount } = renderHook(
      () => {
        useStoreCapture(storeRef);
        useRegisterSource({ id: 'list', source: 'list_x', name: 'List X', fields: [] });
      },
      { wrapper: makeWrapper({}) }
    );

    const sourcesBefore = getSources(storeRef.current);
    const key = Object.keys(sourcesBefore)[0];
    expect(sourcesBefore[key]).toBeDefined();

    act(() => {
      unmount();
    });

    const sourcesAfter = getSources(storeRef.current);
    expect(sourcesAfter[key]).toBeUndefined();
  });

  it('does NOT clobber a sibling scope source when unmounting (no scope collision)', () => {
    // Before the fix, the cleanup wrote to path "sources" (the parent key), which
    // overwrote the entire sources object, destroying all sibling data.
    // After the fix, the cleanup writes to "sources.<uniqueId>" (unique per instance),
    // so each scope only removes its own entry.
    const rootRef = { current: undefined as StoreApi<SourceState> | undefined };
    const showSecondRef = { current: true };

    const RootCapture = ({ children }: { children?: ReactNode }) => {
      rootRef.current = useContext(StoreContext) as StoreApi<SourceState>;

      return children;
    };

    const RootWrapper = ({ children }: { children?: ReactNode }) =>
      createElement(StoreProvider<SourceState>, { value: {} }, createElement(RootCapture, null, children));

    const ScopedSource = ({ sourceId }: { sourceId: string }) =>
      createElement(
        StoreProvider<SourceState>,
        { inherit: 'live', value: {} },
        createElement(SourceComponent, { sourceId })
      );

    const SourceComponent = ({ sourceId }: { sourceId: string }) => {
      useRegisterSource({ id: sourceId, source: `list_${sourceId}`, name: sourceId, fields: [] });

      return null;
    };

    const App = () =>
      createElement(
        'div',
        null,
        createElement(ScopedSource, { sourceId: 'first' }),
        showSecondRef.current && createElement(ScopedSource, { sourceId: 'second' })
      );

    const { rerender } = render(createElement(App), { wrapper: RootWrapper });

    const sourcesBefore = getSources(rootRef.current);
    const keysBefore = Object.keys(sourcesBefore);
    expect(keysBefore).toHaveLength(2);

    const firstKey = keysBefore.find(k => k.startsWith('first_'));
    const secondKey = keysBefore.find(k => k.startsWith('second_'));

    // Unmount only the second sibling
    showSecondRef.current = false;

    act(() => {
      rerender(createElement(App));
    });

    const sourcesMiddle = getSources(rootRef.current);
    // First sibling should still be intact
    expect(sourcesMiddle[firstKey as string]).toBeDefined();
    expect((sourcesMiddle[firstKey as string] as { meta: { source: string } }).meta.source).toBe('list_first');
    // Second sibling was cleaned up
    expect(sourcesMiddle[secondKey as string]).toBeUndefined();
  });

  it('does NOT throw when a single scope registers multiple sources', () => {
    const { unmount } = renderHook(
      () => {
        useRegisterSource({ id: 'a', source: 'form', name: 'Form A', fields: [] });
        useRegisterSource({ id: 'b', source: 'form', name: 'Form B', fields: [] });
      },
      { wrapper: makeWrapper({}) }
    );

    expect(() => {
      act(() => {
        unmount();
      });
    }).not.toThrow();
  });
});
