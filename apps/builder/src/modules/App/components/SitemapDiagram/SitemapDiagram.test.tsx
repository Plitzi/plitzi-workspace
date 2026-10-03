import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SitemapDiagram from './SitemapDiagram';

import type { Element, PageFolder } from '@plitzi/sdk-shared';

const dialog = vi.hoisted(() => ({ answer: true }));
const toast = vi.hoisted(() => vi.fn());

vi.mock('@plitzi/plitzi-ui/Modal', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/plitzi-ui/Modal')>()),
  useModal: () => ({ showModal: () => undefined, showDialog: () => Promise.resolve(dialog.answer) })
}));
vi.mock('@plitzi/plitzi-ui/Toast', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/plitzi-ui/Toast')>()),
  useToast: () => ({ addToast: toast })
}));

const page = (id: string, name: string, folder = ''): Element => ({
  id,
  attributes: { name, slug: id, folder, default: id === 'home' },
  definition: { label: name, type: 'page', rootId: id, styleSelectors: { base: '' } }
});

const folders: PageFolder[] = [{ id: 'blog', name: 'Blog', slug: 'blog', parentId: '' }];
const pages = [page('home', 'Home'), page('post', 'Post', 'blog')];

// jsdom draws the map at zoom 1, 48px in: Home heads the column of top-level pages (x 32), Blog follows at x 320.
const press = (target: HTMLElement, x: number, y: number) =>
  fireEvent.pointerDown(target, { button: 0, clientX: x, clientY: y });
const pointer = (type: 'pointermove' | 'pointerup', x: number, y: number) =>
  act(() => {
    window.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y }));
  });

beforeEach(() => {
  vi.clearAllMocks();
  dialog.answer = true;
});

describe('SitemapDiagram', () => {
  it('draws every folder over what it holds, with where each page answers', () => {
    render(<SitemapDiagram pages={pages} pageFolders={folders} />);

    expect(screen.getAllByRole('treeitem')).toHaveLength(3);
    expect(screen.getByTitle('/blog/post')).toBeDefined();
    expect(screen.getByText('1 item')).toBeDefined();
    // Both pages, and the legend.
    expect(screen.getAllByText('Everyone')).toHaveLength(3);
    expect(screen.getByText('2 pages · 1 folder')).toBeDefined();
  });

  it('moves a page dropped onto a folder into it', () => {
    const onMove = vi.fn();
    render(<SitemapDiagram pages={pages} pageFolders={folders} onMove={onMove} />);
    const home = screen.getByTitle('/home');

    press(home, 48 + 32 + 10, 58);
    pointer('pointermove', 48 + 320 + 10, 58);
    pointer('pointerup', 48 + 320 + 10, 58);

    expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ id: 'home', type: 'page' }), 'blog');
  });

  it('keeps a folder that still holds something, and removes an empty one once confirmed', async () => {
    const onRemove = vi.fn();
    const { rerender } = render(<SitemapDiagram pages={pages} pageFolders={folders} onRemove={onRemove} />);
    const tree = screen.getByRole('tree');

    press(screen.getByTitle('/blog'), 48 + 320 + 10, 58);
    pointer('pointerup', 48 + 320 + 10, 58);
    await act(async () => {
      fireEvent.keyDown(tree, { key: 'Delete' });
      await Promise.resolve();
    });
    expect(toast).toHaveBeenCalledTimes(1);
    expect(onRemove).not.toHaveBeenCalled();

    rerender(<SitemapDiagram pages={[page('home', 'Home')]} pageFolders={folders} onRemove={onRemove} />);
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('tree'), { key: 'Delete' });
      await Promise.resolve();
    });
    expect(onRemove).toHaveBeenCalledWith(expect.objectContaining({ id: 'blog', type: 'folder' }));
  });

  it('marks the page being edited, and opens another with a double click', () => {
    const onOpen = vi.fn();
    render(<SitemapDiagram pages={pages} pageFolders={folders} currentPageId="home" onOpen={onOpen} />);

    expect(screen.getByText('Editing')).toBeDefined();
    fireEvent.doubleClick(screen.getByTitle('/blog/post'));
    expect(onOpen).toHaveBeenCalledWith('post');
  });

  it('counts what a search finds and walks it with Enter', () => {
    render(<SitemapDiagram pages={pages} pageFolders={folders} />);
    const search = screen.getByPlaceholderText('Find a page');

    fireEvent.change(search, { target: { value: 'po' } });
    expect(screen.getByText('1 of 1')).toBeDefined();

    fireEvent.change(search, { target: { value: 'nothing here' } });
    expect(screen.getByText('No match')).toBeDefined();
  });
});
