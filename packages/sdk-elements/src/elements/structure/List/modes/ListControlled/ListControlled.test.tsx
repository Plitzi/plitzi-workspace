import { act, render } from '@testing-library/react';
import { use, useEffect } from 'react';
import { describe, it, expect, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

import ListControlled from './ListControlled';
import useElementDataSource from '../../../../../Element/hooks/useElementDataSource';
import useElementState from '../../../../../Element/hooks/useElementState';
import { anchorInRows, RowAnchorContext, rowAnchorName } from '../../../../../Element/RowAnchor';

import type { ReactNode } from 'react';

// A list renders ONE template (its children) once per record, each under its own row scope that publishes that
// record as the row's data source. This verifies (a) the shared template renders with each row's own context data,
// and (b) two rows of the same element id keep isolated state via the per-row scopePath sub-key.

vi.mock('../../../../../Element/RootElement', () => ({
  default: ({ children }: { children?: ReactNode }) => children
}));

// A list publishes its rows under `list_<id>` — the exact key a binding targets, built from the one name the list
// answers to.
vi.mock('../../../../../Element/hooks/useElement', () => ({
  default: () => ({ id: 'my-list', definition: { label: 'List' } })
}));

vi.mock('../../../../../dataSource/useRegisterSource', () => ({ default: () => undefined }));

vi.mock('@plitzi/sdk-shared/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/sdk-shared/hooks')>()),
  usePlitzi: () => ({ settings: { previewMode: true } })
}));

// `ReplicaProvider` (mounted by each row) reads the interactions manager from this context, so the mock is a real React
// context whose default value carries a minimal manager.
vi.mock('@plitzi/sdk-interactions', async importOriginal => {
  const { createContext } = await import('react');

  const manager = { createChildManager: () => manager, removeChildManager: () => undefined };

  return {
    ...(await importOriginal<typeof import('@plitzi/sdk-interactions')>()),
    InteractionsContext: createContext({ interactionsManager: manager })
  };
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

  /** Filtered or reordered, a row keeps the state it holds with its record, never with the position it was in. */
  it('keeps a row’s state with its record when the records around it change', () => {
    const { rerender } = renderList([
      { id: 'a', name: 'Alpha' },
      { id: 'b', name: 'Beta' },
      { id: 'c', name: 'Gamma' }
    ]);

    act(() => {
      captured.b.setElementState({ open: true });
    });

    rerender(
      <StoreProvider value={{}}>
        <ListControlled
          className=""
          items={[
            { id: 'b', name: 'Beta' },
            { id: 'c', name: 'Gamma' }
          ]}
        >
          <RowTemplate />
        </ListControlled>
      </StoreProvider>
    );

    expect(captured.b.state).toEqual({ open: true });
    expect(captured.c.state).toEqual({});
  });

  // "The current slide" as a one-row list: a row that came back under another item's key arrives anew, and an entrance
  // animation in its class plays again.
  it('mounts a row again when its item changes, by the field the list names', () => {
    const mounts = vi.fn();
    const Counted = () => {
      useEffect(() => {
        mounts();
      }, []);

      return null;
    };
    const slide = (items: { slug: string }[]) => (
      <StoreProvider value={{}}>
        <ListControlled className="" items={items} itemKey="slug">
          <Counted />
        </ListControlled>
      </StoreProvider>
    );

    const { rerender } = render(slide([{ slug: 'one' }]));
    rerender(slide([{ slug: 'two' }]));

    expect(mounts).toHaveBeenCalledTimes(2);
  });

  // A run's activity strip: each bin kept its id while its count changed, and its bar kept the old height until the
  // count was put in the id.
  it('draws a row’s new values when its record changes under the same key', () => {
    const { getByTestId, rerender } = renderList([{ id: 'a', name: 'Alpha' }]);
    expect(getByTestId('row-a').textContent).toBe('Alpha');

    rerender(
      <StoreProvider value={{}}>
        <ListControlled className="" items={[{ id: 'a', name: 'Alpha, again' }]}>
          <RowTemplate />
        </ListControlled>
      </StoreProvider>
    );

    expect(getByTestId('row-a').textContent).toBe('Alpha, again');
  });

  // …read by its field, as a binding reads it (`bins.item.pct`): the path under the row's item is told too.
  it('tells a binding on a field of the row’s item that it changed', () => {
    const Named = () => {
      const dataSource = useElementDataSource({ sources: ['list_my-list.item.name'] });
      const name = (dataSource['list_my-list'] as { item?: { name?: string } } | undefined)?.item?.name;

      return <div data-testid="named">{name}</div>;
    };
    const named = (name: string) => (
      <StoreProvider value={{}}>
        <ListControlled className="" items={[{ id: 'a', name }]}>
          <Named />
        </ListControlled>
      </StoreProvider>
    );
    const { getByTestId, rerender } = render(named('Alpha'));
    rerender(named('Alpha, again'));

    expect(getByTestId('named').textContent).toBe('Alpha, again');
  });

  // A template counts with it — `index + 1` is the next row, not "01".
  it('publishes each row’s position as a number', () => {
    const indexes: unknown[] = [];
    const Position = () => {
      const dataSource = useElementDataSource({ sources: ['list_my-list'] });
      indexes.push((dataSource['list_my-list'] as { index?: unknown } | undefined)?.index);

      return null;
    };

    render(
      <StoreProvider value={{}}>
        <ListControlled className="" items={[{ id: 'a' }, { id: 'b' }]}>
          <Position />
        </ListControlled>
      </StoreProvider>
    );

    expect(indexes).toEqual(expect.arrayContaining([0, 1]));
  });

  /** An anchor in a row is the row's own: each row gives its anchors its name, nested rows each theirs. */
  it('names each row for the anchors drawn in it — by its key, nested lists one after the other', () => {
    const Anchored = () => <span data-testid="answer" id={anchorInRows('faq-answer', use(RowAnchorContext))} />;
    const { getAllByTestId } = render(
      <StoreProvider value={{}}>
        <ListControlled className="" items={[{ id: 'luna' }, { id: 'Kira Two' }]}>
          <Anchored />
        </ListControlled>
      </StoreProvider>
    );

    expect(getAllByTestId('answer').map(node => node.id)).toEqual(['faq-answer-luna', 'faq-answer-kira-two']);
    expect(rowAnchorName(3)).toBe('3');
    expect(rowAnchorName('slug:Field Notes')).toBe('field-notes');
    expect(anchorInRows('faq-answer', [])).toBe('faq-answer');
    expect(anchorInRows('note', ['luna', '2'])).toBe('note-luna-2');
  });
});
