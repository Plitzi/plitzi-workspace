import type { InteractionCallbackParam } from './InteractionTypes';

/**
 * A space's own functions, as everything outside the runner sees them: the builder, the CLI, the MCP and the
 * platform that stores them. The contract the code itself is written against is `@plitzi/sdk-server/functions`.
 */

/**
 * What a task — or every task and route, declared once for all of them — asks to be given beyond an invocation's
 * default: CPU time, awaits not counted, and wall time, from the moment it starts. Never more than the server allows;
 * asking for more is a problem when the functions are saved.
 */
export type FunctionTimeLimits = { cpuMs?: number; wallMs?: number };

/** One task the functions declare: everything but its code — what the catalog shows and a step is drawn from. */
export type FunctionTaskManifest = {
  namespace: string;
  action: string;
  title: string;
  description?: string;
  params: Record<string, InteractionCallbackParam<Record<string, unknown>>>;
  /** What it asks for beyond the default — over what the functions ask for all of their tasks. */
  limits?: FunctionTimeLimits;
};

/** What a space's functions declare, read from the bundle when it is saved: its tasks, routes and reachable hosts. */
export type FunctionsManifest = {
  hosts: string[];
  tasks: FunctionTaskManifest[];
  /** The route keys, `'GET /board-assets/:board/:asset'`, as declared. */
  routes: string[];
  /** What every task and route asks for beyond the default, unless a task asks for its own. */
  limits?: FunctionTimeLimits;
};

/** One reason functions were not saved, where it is — what an editor underlines. */
export type FunctionsProblem = { file?: string; line?: number; column?: number; message: string };

/** The live draft: the source files, which copy of them this is, and what they declared when last saved. */
export type FunctionsDraft = {
  /** `{ "index.ts": "…", "lib/feed.ts": "…" }`. */
  files: Record<string, string>;
  /** Hand it back as `base` when saving: a draft that moved on since is refused rather than overwritten. */
  version: string;
  manifest: FunctionsManifest | null;
  /**
   * The functions the space's template brought, not installed yet: server code is kept in the space's own private
   * bucket, and a space created from a template has none at first. `template` names it, for the notice that offers to
   * install them.
   */
  offer: { template: string } | null;
};

/**
 * Why nothing was saved: `version`, the draft moved on since the copy this save started from; `storage`, the space has
 * no private bucket to keep server code in (the error says how to add one).
 */
export type FunctionsRefusal = { status: 409; error: string; limit: 'version' | 'storage' };

export type FunctionsSaveResult =
  | { ok: true; version: string; manifest: FunctionsManifest }
  | { ok: false; problems: FunctionsProblem[] }
  | { ok: false; refusal: FunctionsRefusal };
