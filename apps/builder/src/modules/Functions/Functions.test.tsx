import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import AppContext from '@pmodules/App/AppContext';

import Functions from './Functions';
import { STARTER_FILES } from './helpers';

import type { NewTask, SourceEdit, SourceFunctions, SourcePlace } from './editor/source';
import type { FunctionsDraft, FunctionsSaveResult, FunctionTimeLimits } from '@plitzi/sdk-shared';
import type { AppContextValue } from '@pmodules/App/AppContext';

const save = vi.fn<(files: Record<string, string>) => Promise<FunctionsSaveResult>>();
const tryTask = vi.fn();
const install = vi.fn<() => Promise<FunctionsSaveResult>>();
const remove = vi.fn();
let draft: FunctionsDraft | undefined;

vi.mock('./useFunctions', () => ({
  default: () => ({ draft, error: '', isLoading: false, save, install, remove, tryTask })
}));

// The language service as the panel sees it: what the code declares, and the edits it writes. Its own reading and
// writing of the code are `editor/source`'s, tested there.
const typescript = vi.hoisted(() => ({
  ready: false,
  source: undefined as SourceFunctions | undefined,
  addTask: vi.fn<(task: NewTask) => Promise<SourceEdit | undefined>>(),
  setTaskLimits: vi.fn<(place: SourcePlace, limits: FunctionTimeLimits) => Promise<SourceEdit | undefined>>()
}));

vi.mock('./editor/useFunctionsTypeScript', () => ({
  default: () => ({ ...typescript, extensionsFor: () => [] })
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
  tryTask.mockReset();
  install.mockReset();
  draft = { files: {}, version: 'v0', manifest: null, offer: null };
  typescript.ready = false;
  typescript.source = undefined;
  typescript.addTask.mockReset();
  typescript.setTaskLimits.mockReset();
});

const filesList = () => within(screen.getByRole('region', { name: 'Files' }));

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
      expect(filesList().getByText('index.ts')).toBeDefined();
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

    fireEvent.click(filesList().getByText('feed.ts'));
    await waitFor(() => expect(container.querySelector('.cm-content')?.textContent).toBe('export const feed = 1;'));
    fireEvent.click(filesList().getByText('index.ts'));
    await waitFor(() => expect(container.querySelector('.cm-content')?.textContent).toBe('export default {};'));

    expect(screen.queryByTitle('Unsaved changes')).toBeNull();
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
    expect(filesList().getByText('lib')).toBeDefined();
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
    // What it asked for, in the list and in the inspector — and nothing to save before a run.
    expect(within(screen.getByRole('region', { name: 'Tasks' })).getByText('1 s')).toBeDefined();
    expect(screen.getByLabelText<HTMLInputElement>('CPU per run').value).toBe('1000');
    expect(screen.getByText('of CPU per run')).toBeDefined();

    // Its params are drawn as its step draws them, starting from their defaults.
    fireEvent.change(screen.getByLabelText('Window'), { target: { value: 'week' } });
    fireEvent.click(screen.getByText('Run'));
    await waitFor(() => expect(tryTask).toHaveBeenCalledWith('feed.read', { window: 'week' }));
  });

  it('lists the tasks as the code declares them, and writes a new one into it', async () => {
    const index = 'export default defineFunctions({ tasks: [] });';
    const written = 'export default defineFunctions({ tasks: [seismicStats] });';
    draft = {
      files: { 'index.ts': index },
      version: 'v1',
      manifest: { hosts: [], tasks: [], routes: [] },
      offer: null
    };
    typescript.ready = true;
    typescript.source = { defined: true, tasks: [], routes: [], hosts: [], unreadable: [] };
    typescript.addTask.mockImplementation(task => {
      typescript.source = {
        defined: true,
        tasks: [{ ...task, params: {}, at: { file: 'index.ts', line: 1, start: 0, end: 10 } }],
        routes: [],
        hosts: [],
        unreadable: []
      };

      return Promise.resolve({ file: 'index.ts', code: written });
    });
    save.mockResolvedValue({ ok: true, version: 'v2', manifest: { hosts: [], tasks: [], routes: [] } });
    tryTask.mockResolvedValue({ status: 'completed', steps: [], output: { value: 1 } });
    renderPanel();

    fireEvent.click(screen.getByTitle('New task'));
    fireEvent.change(screen.getByLabelText('Namespace'), { target: { value: 'seismic' } });
    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'stats' } });
    fireEvent.click(screen.getByText('Create task'));

    await waitFor(() => expect(screen.getByText('Unsaved · 1 file')).toBeDefined());
    expect(typescript.addTask).toHaveBeenCalledWith({ namespace: 'seismic', action: 'stats', title: 'Stats' });
    // Written, not saved: running it saves first, then runs what was saved.
    expect(screen.getAllByText(/not saved/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('Save & run'));

    await waitFor(() => expect(tryTask).toHaveBeenCalledWith('seismic.stats', {}));
    expect(save).toHaveBeenCalledWith({ 'index.ts': written });
  });

  it('writes the time a task asks for into its code, and takes it out for the default', async () => {
    const at = { file: 'index.ts', line: 3, start: 40, end: 120 };
    draft = {
      files: { 'index.ts': 'export default defineFunctions({});' },
      version: 'v1',
      manifest: { hosts: [], tasks: [], routes: [] },
      offer: null
    };
    typescript.ready = true;
    typescript.source = {
      defined: true,
      tasks: [
        { namespace: 'feed', action: 'read', title: 'Read', params: {}, limits: { cpuMs: 300, wallMs: 20000 }, at }
      ],
      routes: [],
      hosts: [],
      unreadable: []
    };
    typescript.setTaskLimits.mockResolvedValue({ file: 'index.ts', code: 'limits written' });
    renderPanel();

    fireEvent.click(screen.getByText('500 ms'));
    await waitFor(() => expect(typescript.setTaskLimits).toHaveBeenCalledWith(at, { cpuMs: 500, wallMs: 20000 }));

    fireEvent.click(screen.getByText('Use default'));
    await waitFor(() => expect(typescript.setTaskLimits).toHaveBeenLastCalledWith(at, { wallMs: 20000 }));
    expect(screen.getByText('Unsaved · 1 file')).toBeDefined();
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
