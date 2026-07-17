import { act, render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

import ListControlled from './ListControlled';
import useElementDataSource from '../../../../../Element/hooks/useElementDataSource';
import useElementState from '../../../../../Element/hooks/useElementState';

import type { ReactNode } from 'react';

// A list renders ONE template (its children) once per record, each under its own row scope that publishes that
// record as the row's data source. This verifies (a) the shared template renders with each row's own context data,
// and (b) two rows of the same element id keep isolated state via the per-row scopePath sub-key.

vi.mock('../../../../../Element/RootElement', () => ({
  default: ({ children }: { children?: ReactNode }) => children
}));

// A list publishes its rows under `list_<idRef>` — the exact key a binding targets. `idRef` is swapped per test to
// cover the element that has none, which must publish nothing at all rather than fall back to its opaque id.
let elementIdRef: string | undefined = 'my-list';

vi.mock('../../../../../Element/hooks/useElement', () => ({
  default: () => ({ id: 'list1', idRef: elementIdRef, definition: { label: 'List' } })
}));

vi.mock('@plitzi/sdk-shared/dataSource/hooks/useRegisterSource', () => ({ default: () => undefined }));

// `ReplicaProvider` (mounted by each row) reads the interactions manager from this context, so the mock owns a real
// React context whose default value carries a minimal manager.
vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', async () => {
  const { createContext } = await import('react');
  const manager = { createChildManager: () => manager, removeChildManager: () => undefined };
  const InteractionsContext = createContext({ interactionsManager: manager });

  return { default: () => ({ settings: { previewMode: true }, contexts: { InteractionsContext } }) };
});

type Item = { id: string; name: string };

type RowHandle = { item: Item } & ReturnType<typeof useElementState>;

const captured: Record<string, RowHandle> = {};

// The single template element, reused for every row. Every row mounts the SAME element id ('rowItem'), so state
// isolation must come from the row scope, not the id. It reads the row's published source for its own data.
const RowTemplate = () => {
  const dataSource = useElementDataSource({ sources: ['list_my-list'] });
  const row = (dataSource['list_my-list'] as { item?: Item } | undefined)?.item;
  const { state, setElementState } = useElementState({ id: 'rowItem', previewMode: true });
  if (row) {
    captured[row.id] = { item: row, state, setElementState };
  }

  return <div data-testid={`row-${row?.id ?? '?'}`}>{row?.name}</div>;
};

const renderList = (items: Item[]) =>
  render(
    <StoreProvider value={{}}>
      <ListControlled className="" items={items}>
        <RowTemplate />
      </ListControlled>
    </StoreProvider>
  );

describe('ListControlled', () => {
  beforeEach(() => {
    elementIdRef = 'my-list';
  });

  it('renders the template once per record, each with its own context data', () => {
    const { getByTestId } = renderList([
      { id: 'a', name: 'Alpha' },
      { id: 'b', name: 'Beta' },
      { id: 'c', name: 'Gamma' }
    ]);

    expect(getByTestId('row-a').textContent).toBe('Alpha');
    expect(getByTestId('row-b').textContent).toBe('Beta');
    expect(getByTestId('row-c').textContent).toBe('Gamma');
    expect(captured.a.item.name).toBe('Alpha');
    expect(captured.b.item.name).toBe('Beta');
  });

  it('publishes no row source when the list has no idRef, instead of falling back to its opaque id', () => {
    elementIdRef = undefined;
    const { getAllByTestId } = renderList([
      { id: 'a', name: 'Alpha' },
      { id: 'b', name: 'Beta' }
    ]);

    // Rows still render, but nothing can bind to them: no `list_list1` key ever exists, which is what lets an idRef
    // be assigned later without invalidating a binding written against it.
    expect(getAllByTestId('row-?')).toHaveLength(2);
  });

  it('isolates element state between rows even though every row shares the same element id', () => {
    renderList([
      { id: 'a', name: 'Alpha' },
      { id: 'b', name: 'Beta' }
    ]);

    act(() => {
      captured.a.setElementState({ selected: true });
    });

    expect(captured.a.state).toEqual({ selected: true });
    expect(captured.b.state).toEqual({});
  });
});
