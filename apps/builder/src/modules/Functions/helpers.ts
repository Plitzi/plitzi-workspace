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

/**
 * What a task is given beyond the default, in words: its own limits over its functions' — `1000 ms CPU · 20 s` — or
 * `undefined` when it asked for nothing and runs with the server's default.
 */
export const limitsLabel = (task: FunctionTaskManifest, manifest: FunctionsManifest): string | undefined => {
  const limits: FunctionTimeLimits = { ...manifest.limits, ...task.limits };
  const parts = [
    limits.cpuMs === undefined ? '' : `${String(limits.cpuMs)} ms CPU`,
    limits.wallMs === undefined ? '' : `${String(limits.wallMs / 1000)} s to finish`
  ].filter(Boolean);

  return parts.length ? parts.join(' · ') : undefined;
};

/** A route key, read for showing: its method, and the address it answers at under `prefix`. */
export const routeParts = (route: string, prefix: string): { method: string; path: string } => {
  const [method = '', path = ''] = route.trim().split(/\s+/);

  return { method, path: `${prefix}${path}` };
};

/** How far a file or a folder is indented for each folder it is in, in pixels. */
export const FILE_INDENT_PX = 12;

/** A new file's name as typed, made a file's: trimmed, and a TypeScript one when it says nothing else. */
export const newFileName = (typed: string): string => {
  const name = typed.trim();

  return !name || /\.(ts|js|mjs|json)$/.test(name) ? name : `${name}.ts`;
};

/** One row of the file list: a folder, or a file under the folders before it. */
export type FileRow =
  { kind: 'folder'; path: string; depth: number } | { kind: 'file'; path: string; name: string; depth: number };

/**
 * The files as a tree reads, top to bottom: each folder once, before what is in it, and every name indented by how
 * deep it is — `index.ts` first, as the file everything starts from.
 */
export const fileRows = (files: readonly string[]): FileRow[] => {
  const sorted = [...files].sort((a, b) => (a === 'index.ts' ? -1 : b === 'index.ts' ? 1 : a.localeCompare(b)));
  const seen = new Set<string>();
  const rows: FileRow[] = [];
  for (const path of sorted) {
    const parts = path.split('/');
    parts.slice(0, -1).forEach((_, index) => {
      const folder = parts.slice(0, index + 1).join('/');
      if (!seen.has(folder)) {
        seen.add(folder);
        rows.push({ kind: 'folder', path: folder, depth: index });
      }
    });
    rows.push({ kind: 'file', path, name: parts[parts.length - 1], depth: parts.length - 1 });
  }

  return rows;
};

/** A param's value as a field shows it: text as it is, a number as its digits, anything else as nothing. */
export const fieldText = (value: unknown): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';

/** Whether a key press is "save": ⌘S on a Mac, Ctrl+S elsewhere. */
export const isSaveKey = (event: KeyboardEvent): boolean =>
  (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 's';

/**
 * Where the files stand, in a few words: changes not saved yet — how many files — or saved, which is what the builder
 * runs; the live site runs what the space was last published with. Nothing for a space with no functions.
 */
export const saveStatus = (modified: number, saved: boolean): string => {
  if (modified > 0) {
    return `Unsaved changes in ${String(modified)} ${modified === 1 ? 'file' : 'files'}`;
  }

  return saved ? 'Saved · the live site runs what was last published' : '';
};
