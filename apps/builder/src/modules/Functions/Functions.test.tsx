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

  it('opens another file without marking either as changed', async () => {
    draft = {
      files: { 'index.ts': 'export default {};\n', 'lib/feed.ts': 'export const feed = 1;\n' },
      version: 'v1',
      manifest: { hosts: [], tasks: [], routes: [] },
      offer: null
    };
    const { container } = renderPanel();
    await waitFor(() => expect(container.querySelector('.cm-content')?.textContent).toBe('export default {};'));

    fireEvent.click(screen.getByText('feed.ts'));
    await waitFor(() => expect(container.querySelector('.cm-content')?.textContent).toBe('export const feed = 1;'));
    fireEvent.click(screen.getByText('index.ts'));
    await waitFor(() => expect(container.querySelector('.cm-content')?.textContent).toBe('export default {};'));

    expect(screen.queryByText('●')).toBeNull();
    expect(screen.getByText('Save').closest('button')?.disabled).toBe(true);
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

    // A new file is named where the list starts, and Enter adds it — its folder with it.
    fireEvent.click(screen.getByTitle('New file'));
    const name = screen.getByPlaceholderText('lib/feed.ts');
    fireEvent.change(name, { target: { value: 'lib/feed.ts' } });
    fireEvent.keyDown(name, { key: 'Enter' });
    expect(screen.getByText('lib')).toBeDefined();
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText('lib/feed.ts:3')).toBeDefined();
      expect(screen.getByText(/Expected ";"/)).toBeDefined();
    });
  });

  it('shows what the saved code declares, and tries only what was saved', async () => {
    draft = {
      files: { 'index.ts': 'export default {};' },
      version: 'v1',
      manifest: {
        hosts: ['api.example.com'],
        tasks: [
          {
            namespace: 'feed',
            action: 'read',
            title: 'Read',
            params: {
              window: {
                type: 'select',
                label: 'Window',
                defaultValue: 'day',
                options: [
                  { label: 'Day', value: 'day' },
                  { label: 'Week', value: 'week' }
                ]
              }
            },
            limits: { cpuMs: 1000 }
          }
        ],
        routes: ['GET /feed/:id']
      },
      offer: null
    };
    tryTask.mockResolvedValue({ status: 'completed', steps: [], output: { value: { ok: true } } });
    renderPanel();

    expect(screen.getByText('api.example.com')).toBeDefined();
    expect(screen.getByText('/fn/feed/:id')).toBeDefined();
    expect(screen.getByText('1000 ms CPU')).toBeDefined();
    expect(screen.queryByText(/save your changes first/)).toBeNull();

    // Its params are drawn as its step draws them, starting from their defaults.
    fireEvent.change(screen.getByLabelText('Window'), { target: { value: 'week' } });
    fireEvent.click(screen.getByText('Run'));
    await waitFor(() => expect(tryTask).toHaveBeenCalledWith('feed.read', { window: 'week' }));
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
