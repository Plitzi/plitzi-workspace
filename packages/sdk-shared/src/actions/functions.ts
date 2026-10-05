import type { FunctionTimeLimits } from '../types/FunctionTypes';

/**
 * Where a space's functions answer HTTP: `GET /feed/:id` declared, `GET /fn/feed/42` served. The path is the functions'
 * and never a page's — the page server and the page linter both read it from here. `/fn`, not `/api`: a space's pages
 * are its own to name, and `api` is a slug a site wants for a page about its API.
 */
export const FUNCTION_ROUTES_PREFIX = '/fn';

/** The segment under `/fn` where plugins answer — `/fn/plugins/<type>/…` — and nobody else's routes may. */
export const PLUGIN_ROUTES_SEGMENT = 'plugins';

/**
 * A plugin's server half as its package carries it: the source of its \`functions/\`, by path, in this file beside the
 * bundle (\`plugin-manifest.json\` names it under \`functions\`). Built by whatever runs the plugin — the platform when it
 * is uploaded, a server of one's own when it loads the packed plugin.
 */
export const PLUGIN_FUNCTIONS_SOURCE = 'functions.source.json';

/** Where a plugin's route answers: `pluginRoutePath('board', '/layout')` is `/fn/plugins/board/layout`. */
export const pluginRoutePath = (plugin: string, path = '/'): string =>
  `${FUNCTION_ROUTES_PREFIX}/${PLUGIN_ROUTES_SEGMENT}/${encodeURIComponent(plugin)}${path.startsWith('/') ? path : `/${path}`}`;

/**
 * The CPU and time an invocation gets when its task asks for none: what the server runs it with, and what the builder
 * shows as "default". A task asks for more in its `limits`, up to what its deployment allows.
 */
export const DEFAULT_FUNCTION_TIME_LIMITS = {
  cpuMs: 100,
  wallMs: 10_000
} as const satisfies Required<FunctionTimeLimits>;

/** Whether a page at `path` would sit where the space's functions answer. */
export const isFunctionRoutePath = (path: string): boolean =>
  path === FUNCTION_ROUTES_PREFIX || path.startsWith(`${FUNCTION_ROUTES_PREFIX}/`);

/**
 * Whether a path is one of a space's functions files: relative, inside `functions/`, a `.ts`, `.js`, `.mjs` or `.json`.
 * The one rule for what a source is — the platform's build refuses anything else, and every reader of a working copy
 * reads exactly this.
 */
export const isFunctionsSourcePath = (path: string): boolean =>
  /^[A-Za-z0-9_][A-Za-z0-9_./-]*\.(ts|js|mjs|json)$/.test(path) &&
  !path.split('/').some(segment => segment === '..' || segment === '.' || segment === '');

/** How a reader reaches a directory, whatever it runs on: Node's `fs`, a test's map. */
export type FunctionsSourceReader = {
  list: (dir: string) => Promise<{ name: string; directory: boolean }[]>;
  read: (file: string) => Promise<string>;
};

/**
 * A space's functions as a directory holds them — every source file under `root`, by its path there (`lib/feed.ts`),
 * `node_modules` and dotted folders skipped. What a project's working copy is read as, by the CLI and by a server
 * loading its own; a directory that is not there reads as none.
 */
export const readFunctionsSource = async (
  root: string,
  reader: FunctionsSourceReader
): Promise<Record<string, string>> => {
  const files: Record<string, string> = {};
  const walk = async (relative: string): Promise<void> => {
    let entries: { name: string; directory: boolean }[];
    try {
      entries = await reader.list(relative ? `${root}/${relative}` : root);
    } catch {
      return;
    }

    for (const entry of entries) {
      const path = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.directory) {
        if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
          await walk(path);
        }
      } else if (isFunctionsSourcePath(path)) {
        files[path] = await reader.read(`${root}/${path}`);
      }
    }
  };
  await walk('');

  return files;
};
