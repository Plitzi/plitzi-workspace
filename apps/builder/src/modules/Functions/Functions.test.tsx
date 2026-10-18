import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import AppContext from '@pmodules/App/AppContext';

import Functions from './Functions';
import { STARTER_FILES } from './helpers';

import type { NewTask, SourceEdit, SourceFunctions, SourcePlace } from './editor/source';
import type {
  FunctionsDraft,
  FunctionsSaveResult,
  FunctionTimeLimits,
  JobControlAction,
  SpaceJob
} from '@plitzi/sdk-shared';
import type { AppContextValue } from '@pmodules/App/AppContext';

const save = vi.fn<(files: Record<string, string>) => Promise<FunctionsSaveResult>>();
const tryTask = vi.fn();
const install = vi.fn<() => Promise<FunctionsSaveResult>>();
const remove = vi.fn();
let draft: FunctionsDraft | undefined;

vi.mock('./useFunctions', () => ({
  default: () => ({ draft, error: '', isLoading: false, save, install, remove, tryTask })
}));

// The space's runs of the job the inspector shows, and the controls it sends — the queue's answers are `SpaceJobs`'.
const queue = vi.hoisted(() => ({
  jobs: [] as SpaceJob[],
  asked: [] as string[],
  control: vi.fn<(jobId: string, action: JobControlAction) => Promise<string | undefined>>()
}));

vi.mock('./useJobs', () => ({
  default: (name: string) => {
    queue.asked.push(name);

    return { jobs: queue.jobs, total: queue.jobs.length, error: '', isLoading: false, control: queue.control };
  }
}));

// What the person answers a confirmation with.
const dialog = vi.hoisted(() => ({ answer: true }));

vi.mock('@plitzi/plitzi-ui/Modal', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/plitzi-ui/Modal')>()),
  useModal: () => ({ showModal: () => undefined, showDialog: () => Promise.resolve(dialog.answer) })
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
  dialog.answer = true;
  typescript.ready = false;
  typescript.source = undefined;
  typescript.addTask.mockReset();
  typescript.setTaskLimits.mockReset();
  queue.jobs = [];
  queue.asked = [];
  queue.control.mockReset();
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
    typescript.source = { defined: true, tasks: [], routes: [], jobs: [], hosts: [], unreadable: [] };
    typescript.addTask.mockImplementation(task => {
      typescript.source = {
        defined: true,
        tasks: [{ ...task, params: {}, at: { file: 'index.ts', line: 1, start: 0, end: 10 } }],
        routes: [],
        jobs: [],
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
      jobs: [],
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

  it('discards every unsaved change, back to what was last saved', async () => {
    draft = {
      files: { 'index.ts': 'export default {};' },
      version: 'v1',
      manifest: { hosts: [], tasks: [], routes: [] },
      offer: null
    };
    renderPanel();

    fireEvent.click(screen.getByTitle('New file'));
    const name = screen.getByPlaceholderText('lib/feed.ts');
    fireEvent.change(name, { target: { value: 'lib/feed.ts' } });
    fireEvent.keyDown(name, { key: 'Enter' });
    expect(screen.getByText('Unsaved · 1 file')).toBeDefined();

    // Kept when the person thinks better of it.
    dialog.answer = false;
    fireEvent.click(screen.getByText('Discard'));
    await waitFor(() => expect(filesList().getByText('feed.ts')).toBeDefined());

    dialog.answer = true;
    fireEvent.click(screen.getByText('Discard'));
    await waitFor(() => expect(filesList().queryByText('feed.ts')).toBeNull());
    expect(screen.getByText('Saved')).toBeDefined();
    expect(screen.queryByText('Discard')).toBeNull();
  });

  it('discards functions never saved back to where the space started', async () => {
    renderPanel();

    fireEvent.click(screen.getByText('Start with an example'));
    fireEvent.click(await screen.findByText('Discard'));

    await waitFor(() => expect(screen.getByText('Start with an example')).toBeDefined());
    expect(save).not.toHaveBeenCalled();
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

  it('lists the jobs the code declares, and shows the runs of one live with the controls each takes', async () => {
    draft = {
      files: { 'index.ts': 'export default defineFunctions({ jobs: { train: {} } });' },
      version: 'v1',
      manifest: { hosts: [], tasks: [], routes: [], jobs: { train: { maxSeconds: 5400 } } },
      offer: null
    };
    queue.jobs = [
      {
        id: 'job:1',
        environment: 'main',
        kind: 'function',
        name: 'train',
        startedBy: 'ada',
        status: 'running',
        progress: 0.4,
        step: 'epoch 4 of 10',
        attempts: 1,
        maxAttempts: 3,
        dueAt: 1,
        createdAt: 1,
        updatedAt: 1
      },
      {
        id: 'job:0',
        environment: 'main',
        kind: 'function',
        name: 'train',
        status: 'failed',
        error: 'Out of memory',
        attempts: 3,
        maxAttempts: 3,
        dueAt: 1,
        createdAt: 1,
        updatedAt: 1
      }
    ];
    queue.control.mockResolvedValue(
      'This job is running, already being set aside: only one waiting or running can be paused'
    );
    renderPanel();

    const jobs = within(screen.getByRole('region', { name: 'Jobs' }));
    expect(jobs.getByText('1 h 30 min')).toBeDefined();
    fireEvent.click(jobs.getByText('train'));

    expect(screen.getByText('Up to 1 h 30 min')).toBeDefined();
    expect(screen.getByText('Only whoever started it')).toBeDefined();
    expect(queue.asked.at(-1)).toBe('train');
    expect(screen.getByText('40% · epoch 4 of 10')).toBeDefined();
    expect(screen.getByText('Out of memory')).toBeDefined();
    expect(screen.getByText('Run again')).toBeDefined();

    fireEvent.click(screen.getByText('Pause'));
    await waitFor(() => expect(queue.control).toHaveBeenCalledWith('job:1', 'pause'));
    expect(
      await screen.findByText('This job is running, already being set aside: only one waiting or running can be paused')
    ).toBeDefined();
  });

  it('reads no runs of a job only written so far, and says to save it', () => {
    draft = {
      files: { 'index.ts': 'export default defineFunctions({});' },
      version: 'v1',
      manifest: { hosts: [], tasks: [], routes: [] },
      offer: null
    };
    typescript.source = {
      defined: true,
      tasks: [],
      routes: [],
      jobs: [{ name: 'export-all', at: { file: 'index.ts', line: 1, start: 0, end: 10 } }],
      hosts: [],
      unreadable: []
    };
    renderPanel();

    fireEvent.click(within(screen.getByRole('region', { name: 'Jobs' })).getByText('export-all'));

    expect(queue.asked.at(-1)).toBe('');
    expect(screen.getByText('Save the code, and the code can start it.')).toBeDefined();
  });
});
