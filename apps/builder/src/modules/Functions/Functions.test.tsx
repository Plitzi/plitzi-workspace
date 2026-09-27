import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import AppContext from '@pmodules/App/AppContext';

import Functions from './Functions';
import { STARTER_FILES } from './helpers';

import type { FunctionsDraft, FunctionsSaveResult } from '@plitzi/sdk-shared';
import type { AppContextValue } from '@pmodules/App/AppContext';

const save = vi.fn<(files: Record<string, string>) => Promise<FunctionsSaveResult>>();
const tryTask = vi.fn();
const remove = vi.fn();
let draft: FunctionsDraft | undefined;

vi.mock('./useFunctions', () => ({
  default: () => ({ draft, error: '', isLoading: false, save, remove, tryTask })
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
  draft = { files: {}, version: 'v0', manifest: null };
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
      manifest: { hosts: [], tasks: [], routes: [] }
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
      }
    };
    renderPanel();

    expect(screen.getByText('api.example.com')).toBeDefined();
    expect(screen.getByText('GET /feed/:id')).toBeDefined();
    expect(screen.queryByText('Try runs the saved draft: save your changes first.')).toBeNull();
  });
});
