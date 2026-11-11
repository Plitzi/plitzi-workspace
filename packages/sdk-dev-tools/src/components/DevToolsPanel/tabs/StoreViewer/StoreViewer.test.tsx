// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createStore } from '@plitzi/nexus';
import { DevToolsContext } from '@plitzi/sdk-shared/devTools/react';

import StoreViewer from './StoreViewer';

import type { DevStoreEntry } from '@plitzi/nexus';

const selection = vi.hoisted(() => ({ entry: undefined as DevStoreEntry | undefined }));

vi.mock('../../../../scope/useScope', () => ({
  useSelectedStoreEntry: () => selection.entry,
  useSelectedStore: () => selection.entry?.store
}));

const parent = createStore<Record<string, unknown>>({ theme: 'dark' });

const scoped = (): DevStoreEntry => ({
  uid: '2',
  name: 'Queries',
  scopeId: 'sdk',
  store: createStore<Record<string, unknown>>({ orders: 3 }, { parent })
});

beforeEach(() => {
  localStorage.clear();
  selection.entry = scoped();
});

describe('StoreViewer', () => {
  it('shows the scope’s own layer, and the parent’s merged in when asked', () => {
    render(<StoreViewer />);

    expect(screen.queryByText('orders')).not.toBeNull();
    expect(screen.queryByText('theme')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Merged' }));

    expect(screen.queryByText('theme')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Own' }));

    expect(screen.queryByText('theme')).toBeNull();
  });

  it('follows the store as it changes', () => {
    render(<StoreViewer />);

    expect(screen.queryByText('3')).not.toBeNull();

    act(() => {
      selection.entry?.store.setState('orders', 41);
    });

    expect(screen.queryByText('41')).not.toBeNull();
    expect(screen.queryByText('3')).toBeNull();
  });

  it('shows the selected element’s data source instead, with no view to switch', () => {
    const getData = vi.fn(() => ({ product: { title: 'Mug' } }));
    render(
      <DevToolsContext value={{ logs: [], providers: {}, getData }}>
        <StoreViewer elementSelected="el-1" />
      </DevToolsContext>
    );

    expect(getData).toHaveBeenCalledWith('getElementDataSource-el-1');
    expect(screen.queryByText('product')).not.toBeNull();
    expect(screen.queryByText('orders')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Merged' })).toBeNull();
  });

  it('shows an empty tree with no store chosen', () => {
    selection.entry = undefined;
    const { container } = render(<StoreViewer />);

    expect(container.querySelector('.w-rjv')).not.toBeNull();
  });
});
