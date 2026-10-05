import { DEFAULT_FUNCTION_TIME_LIMITS } from '@plitzi/sdk-shared/actions';

import type { SourceFunctions, SourcePlace, SourceRoute } from './editor/source';
import type { Text } from '@codemirror/state';
import type { FunctionsManifest, FunctionsProblem, FunctionTaskManifest, FunctionTimeLimits } from '@plitzi/sdk-shared';

/** What a space's functions start as: one file and one task already written, to change rather than to learn from blank. */
export const STARTER_FILES: Record<string, string> = {
  'index.ts': `import { defineFunctions } from '@plitzi/sdk-server/functions';

export default defineFunctions({
  // The hosts ctx.fetch may reach — anything else is refused before it leaves: ['api.example.com', '*.example.com']
  allow: { hosts: [] },
  tasks: [
    {
      namespace: 'hello',
      action: 'greet',
      title: 'Greet',
      description: 'Says hello, and counts how many times it has.',
      params: { name: { type: 'text', label: 'Name', defaultValue: 'world', canBind: true } },
      run: async ({ name }: { name: string }, ctx) => {
        const count = await ctx.kv.increment('greetings', 1);
        ctx.log('greeting', name, count);

        return { message: \`Hello, \${name}\`, count };
      }
    }
  ]
});
`
};

/** Where a problem is, as a person reads it: `lib/feed.ts:12:4`. */
export const problemPlace = ({ file, line, column }: FunctionsProblem): string =>
  file ? `${file}${line ? `:${String(line)}${column ? `:${String(column)}` : ''}` : ''}` : 'functions';

/** The params a Try sends, from what was typed: a JSON object, or the reason it is not one. */
export const readParams = (text: string): { params: Record<string, unknown> } | { error: string } => {
  try {
    const value: unknown = JSON.parse(text.trim() || '{}');
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return { params: Object.fromEntries(Object.entries(value)) };
    }
  } catch {
    // Answered below, the same as JSON that is not an object.
  }

  return { error: 'Params are a JSON object, by name: { "name": "Ada" }' };
};

/** A task's name, as a step addresses it: `seismic.feed`. */
export const taskNameOf = (task: Pick<FunctionTaskManifest, 'namespace' | 'action'>): string =>
  `${task.namespace}.${task.action}`;

/** What a Try starts from: each param at the value the task declared for it — what a new step would start from. */
export const paramDefaults = (task: FunctionTaskManifest | undefined): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(task?.params ?? {}).map(([name, param]) => [
      name,
      param.defaultValue ?? (param.type === 'boolean' ? false : param.type === 'elements' ? [] : '')
    ])
  );

/** A route key, read for showing: its method, and the address it answers at under `prefix`. */
export const routeParts = (route: string, prefix: string): { method: string; path: string } => {
  const [method = '', path = ''] = route.trim().split(/\s+/);

  return { method, path: `${prefix}${path}` };
};

/** A new file's name as typed, made a file's: trimmed, and a TypeScript one when it says nothing else. */
export const newFileName = (typed: string): string => {
  const name = typed.trim();

  return !name || /\.(ts|js|mjs|json)$/.test(name) ? name : `${name}.ts`;
};

/** A param's value as a field shows it: text as it is, a number as its digits, anything else as nothing. */
export const fieldText = (value: unknown): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';

/**
 * The CPU a task may ask for from the panel, in milliseconds: from the default an invocation gets to a second, in steps
 * a person can tell apart. More than that is asked for in the code, up to what the server allows.
 */
export const TIME_LIMIT = {
  min: DEFAULT_FUNCTION_TIME_LIMITS.cpuMs,
  max: 1000,
  step: 50,
  presets: [DEFAULT_FUNCTION_TIME_LIMITS.cpuMs, 250, 500, 1000]
} as const;

/** A task as the panel lists it: what the source declares right now, where, and whether a save has it yet. */
export type ListedTask = FunctionTaskManifest & {
  limits?: FunctionTimeLimits;
  /** Where it is written — none while the source has not been read, when the saved list is all there is. */
  at?: SourcePlace;
  /** In the saved draft too: what Try can run. A task only written so far is run once it is saved. */
  saved: boolean;
};

/**
 * The tasks to list: what the source declares as it is written — so the list follows the code — or, until the source
 * has been read, what the last save declared.
 */
export const listedTasks = (source: SourceFunctions | undefined, manifest: FunctionsManifest | null): ListedTask[] => {
  const savedNames = new Set((manifest?.tasks ?? []).map(taskNameOf));
  if (!source?.defined) {
    return (manifest?.tasks ?? []).map(task => ({ ...task, saved: true }));
  }

  return source.tasks.map(task => ({ ...task, saved: savedNames.has(taskNameOf(task)) }));
};

/** A time as the panel says it: milliseconds under a second, seconds from one. */
export const timeLabel = (ms: number): string => (ms < 1000 ? `${String(ms)} ms` : `${String(ms / 1000)} s`);

/** What a new task is called as a step: lowercase words joined by dashes — `seismic`, `feed-week`. */
export const isTaskWord = (value: string): boolean => /^[a-z][a-z0-9-]*$/.test(value);

/** A step's title from its action, until somebody writes one: `feed-week` reads `Feed week`. */
export const titleFromAction = (action: string): string =>
  action ? `${action.charAt(0).toUpperCase()}${action.slice(1).replaceAll('-', ' ')}` : '';

/** A route as the panel lists it: its key, and where it is written once the source has been read. */
export type ListedRoute = Pick<SourceRoute, 'key'> & { at?: SourcePlace };

/** The routes to list: the source's as written, or — until it has been read — the last save's. */
export const listedRoutes = (source: SourceFunctions | undefined, manifest: FunctionsManifest | null): ListedRoute[] =>
  source?.defined ? source.routes : (manifest?.routes ?? []).map(key => ({ key }));

/** The hosts `ctx.fetch` may reach: the source's as written, or the last save's until it has been read. */
export const listedHosts = (source: SourceFunctions | undefined, manifest: FunctionsManifest | null): string[] =>
  source?.defined ? source.hosts : (manifest?.hosts ?? []);

/** The namespace a new task is offered: the one the tasks already share, the first one's, or none. */
export const usualNamespace = (tasks: readonly ListedTask[]): string => tasks[0]?.namespace ?? '';

/**
 * The CPU a task runs with, and whether it chose it: its own `limits.cpuMs`, else the one every task of the space gets
 * from `defineFunctions`, else the server's default.
 */
export const cpuOf = (task: ListedTask, shared: FunctionTimeLimits | undefined): { ms: number; asked: boolean } => {
  if (task.limits?.cpuMs !== undefined) {
    return { ms: task.limits.cpuMs, asked: true };
  }

  return { ms: shared?.cpuMs ?? DEFAULT_FUNCTION_TIME_LIMITS.cpuMs, asked: false };
};

/** What the run button says: running, or whether it saves first. */
export const runLabel = (isRunning: boolean, needsSave: boolean): string => {
  if (isRunning) {
    return 'Running…';
  }

  return needsSave ? 'Save & run' : 'Run';
};

/** A place to bring the editor to: a file's line, asked for again whenever `key` changes. */
export type EditorTarget = {
  file: string;
  line: number;
  key: number;
  /** Whether the editor takes the keyboard too — not when the change came from a control the person is still on. */
  focus: boolean;
};

/** Where a line starts and ends in a document, for line numbers that may run past its end. */
export const lineRange = (doc: Text, line: number): { from: number; to: number } =>
  doc.line(Math.min(Math.max(line, 1), doc.lines));

/** A task's time limits with its CPU set — or taken out, to run with the default — and the rest as they were. */
export const withCpu = (limits: FunctionTimeLimits | undefined, cpuMs: number | undefined): FunctionTimeLimits => ({
  ...(cpuMs === undefined ? {} : { cpuMs }),
  ...(limits?.wallMs === undefined ? {} : { wallMs: limits.wallMs })
});

/** Why the panel cannot write a task's limits for you right now, or nothing when it can. */
export const limitsBlockedBy = (ready: boolean, task: ListedTask): string => {
  if (!ready) {
    return 'Reading the code… the limit can be set once it is read.';
  }

  return task.at ? '' : 'Built by a call: set its limits: { cpuMs } in the code.';
};

/** The task written around an offset of a file — the one the cursor is in — or none. */
export const taskAt = (tasks: readonly ListedTask[], file: string, offset: number): ListedTask | undefined =>
  tasks.find(task => task.at?.file === file && task.at.start <= offset && offset <= task.at.end);
