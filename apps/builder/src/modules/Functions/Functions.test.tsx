import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import AppContext from '@pmodules/App/AppContext';

import Functions from './Functions';
import { STARTER_FILES } from './helpers';

import type { FunctionsDraft, FunctionsSaveResult } from '@plitzi/sdk-shared';
import type { AppContextValue } from '@pmodules/App/AppContext';

const save = vi.fn<(files: Record<string, string>) => Promise<FunctionsSaveResult>>();
const tryTask = vi.fn();
const install = vi.fn<() => Promise<FunctionsSaveResult>>();
const remove = vi.fn();
let draft: FunctionsDraft | undefined;

vi.mock('./useFunctions', () => ({
  default: () => ({ draft, error: '', isLoading: false, save, install, remove, tryTask })
}));

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  save.mockReset();
  tryTask.mockReset();
  install.mockReset();
  draft = { files: {}, version: 'v0', manifest: null, offer: null };
});

const renderPanel = () =>
  render(
    <AppContext value={{ functionsWorkerUrl: '' } as AppContextValue}>
      <Functions />
    </AppContext>
  );

describe('the Functions panel', () => {
  it('starts a space with nothing from one file and one task already written, and saves them', async () => {
    save.mockResolvedValue({ ok: true, version: 'v1', manifest: { hosts: [], tasks: [], routes: [] } });
    renderPanel();

    fireEvent.click(screen.getByText('Start with an example'));
    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeDefined();
    });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(save).toHaveBeenCalledWith(STARTER_FILES);
    });
  });

  it('shows where the saved code is wrong', async () => {
    draft = {
      files: { 'index.ts': 'export default {};' },
      version: 'v1',
      manifest: { hosts: [], tasks: [], routes: [] },
      offer: null
    };
    save.mockResolvedValue({ ok: false, problems: [{ file: 'lib/feed.ts', line: 3, message: 'Expected ";"' }] });
    renderPanel();

    fireEvent.change(screen.getByPlaceholderText('lib/feed.ts'), { target: { value: 'lib/feed.ts' } });
    fireEvent.click(screen.getByText('Add'));
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText('lib/feed.ts:3')).toBeDefined();
      expect(screen.getByText(/Expected ";"/)).toBeDefined();
    });
  });

  it('shows what the saved code declares, and tries only what was saved', () => {
    draft = {
      files: { 'index.ts': 'export default {};' },
      version: 'v1',
      manifest: {
        hosts: ['api.example.com'],
        tasks: [{ namespace: 'feed', action: 'read', title: 'Read', params: {} }],
        routes: ['GET /feed/:id']
      },
      offer: null
    };
    renderPanel();

    expect(screen.getByText('api.example.com')).toBeDefined();
    expect(screen.getByText('GET /feed/:id')).toBeDefined();
    expect(screen.queryByText('Try runs the saved draft: save your changes first.')).toBeNull();
  });

  it('offers the functions the space’s template brought, and installs them', async () => {
    draft = { files: {}, version: 'v0', manifest: null, offer: { template: 'Shipping quote' } };
    install.mockResolvedValue({ ok: true, version: 'v1', manifest: { hosts: [], tasks: [], routes: [] } });
    renderPanel();

    expect(screen.getByText('Shipping quote')).toBeDefined();
    expect(screen.queryByText('Start with an example')).toBeNull();
    fireEvent.click(screen.getByText('Install the template’s functions'));

    await waitFor(() => {
      expect(install).toHaveBeenCalled();
    });
  });

  /** Server code is kept in the space's private bucket: without one the save is refused with how to add it. */
  it('says how to add a private bucket when the space has none', async () => {
    const error = 'This space has no private bucket to keep its server code in. In Resources, add a bucket…';
    draft = { files: {}, version: 'v0', manifest: null, offer: { template: 'Shipping quote' } };
    install.mockResolvedValue({ ok: false, refusal: { status: 409, limit: 'storage', error } });
    renderPanel();

    fireEvent.click(screen.getByText('Install the template’s functions'));

    await waitFor(() => {
      expect(screen.getByText(error)).toBeDefined();
    });
  });
});
