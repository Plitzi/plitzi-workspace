import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import Data from './Data';
import { STARTER_FILES } from './helpers';

import type { DataDraft, DataSaveResult } from '@plitzi/sdk-shared';

/**
 * The Data panel: the space's JSON, a file at a time, saved whole as the draft — with what the platform refused shown
 * where it is, and a newer copy never overwritten unseen.
 */

const save = vi.fn<(files: Record<string, string>) => Promise<DataSaveResult>>();
let draft: DataDraft | undefined;

vi.mock('./useData', () => ({
  default: () => ({ draft, error: '', isLoading: false, save })
}));

vi.mock('@plitzi/plitzi-ui/Modal', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/plitzi-ui/Modal')>()),
  useModal: () => ({ showModal: () => undefined, showDialog: () => Promise.resolve(true) })
}));

beforeAll(() => {
  // jsdom lays nothing out, and its ranges have no rectangles: CodeMirror measures the text it shows through them.
  Range.prototype.getClientRects = () => document.createElement('div').getClientRects();
  Range.prototype.getBoundingClientRect = () => document.createElement('div').getBoundingClientRect();
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  save.mockReset();
  draft = { files: {}, version: 'd0' };
});

const filesList = () => within(screen.getByRole('region', { name: 'Files' }));

describe('the Data panel', () => {
  it('starts a space with no data from one file already written, and saves it', async () => {
    save.mockResolvedValue({ ok: true, version: 'd1' });
    render(<Data />);

    fireEvent.click(screen.getByText('Start with an example'));
    await waitFor(() => {
      expect(filesList().getByText('items.json')).toBeDefined();
    });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(save).toHaveBeenCalledWith(STARTER_FILES);
    });
  });

  it('shows the query a provider reads the open file by, and whether it is JSON', async () => {
    draft = { files: { 'shop/products.json': '[1, 2]' }, version: 'd1' };
    const { container } = render(<Data />);

    await waitFor(() => expect(container.querySelector('.cm-content')?.textContent).toBe('[1, 2]'));

    expect(screen.getByText('/data/shop/products.json')).toBeDefined();
    expect(screen.getByTitle('It reads as JSON')).toBeDefined();
    expect(screen.getByText('Save').closest('button')?.disabled).toBe(true);
  });

  it('shows by file what the save was refused for, and opens the file', async () => {
    draft = { files: { 'a.json': '{}', 'b.json': '[]' }, version: 'd1' };
    save.mockResolvedValue({ ok: false, problems: [{ file: 'b.json', message: 'is not JSON — Unexpected end' }] });
    render(<Data />);

    fireEvent.click(await filesList().findByText('a.json'));
    fireEvent.click(screen.getByTitle('Remove a.json'));
    fireEvent.click(screen.getByText('Save'));

    const problem = await screen.findByText('is not JSON — Unexpected end', { exact: false });
    fireEvent.click(problem);

    expect(screen.getByText('/data/b.json')).toBeDefined();
  });

  it('says why a save was refused when the data changed elsewhere since it was read', async () => {
    draft = { files: { 'a.json': '{}' }, version: 'd1' };
    save.mockResolvedValue({
      ok: false,
      refusal: { status: 409, limit: 'version', error: 'The space’s data changed since this copy was taken' }
    });
    render(<Data />);

    fireEvent.click(await filesList().findByText('a.json'));
    fireEvent.click(screen.getByTitle('New file'));
    fireEvent.change(screen.getByPlaceholderText('shop/products.json'), { target: { value: 'hours' } });
    fireEvent.keyDown(screen.getByPlaceholderText('shop/products.json'), { key: 'Enter' });
    await waitFor(() => expect(filesList().getByText('hours.json')).toBeDefined());
    fireEvent.click(screen.getByText('Save'));

    expect(await screen.findByText('The space’s data changed since this copy was taken')).toBeDefined();
    expect(save).toHaveBeenCalledWith({ 'a.json': '{}', 'hours.json': '{}\n' });
  });
});
