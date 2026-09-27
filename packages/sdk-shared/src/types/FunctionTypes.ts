import type { InteractionCallbackParam } from './InteractionTypes';

/**
 * A space's own functions, as everything outside the runner sees them: the builder, the CLI, the MCP and the
 * platform that stores them. The contract the code itself is written against is `@plitzi/sdk-server/functions`.
 */

/** One task the functions declare: everything but its code — what the catalog shows and a step is drawn from. */
export type FunctionTaskManifest = {
  namespace: string;
  action: string;
  title: string;
  description?: string;
  params: Record<string, InteractionCallbackParam<Record<string, unknown>>>;
};

/** What a space's functions declare, read from the bundle when it is saved: its tasks, routes and reachable hosts. */
export type FunctionsManifest = {
  hosts: string[];
  tasks: FunctionTaskManifest[];
  /** The route keys, `'GET /board-assets/:board/:asset'`, as declared. */
  routes: string[];
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
};

/** Why nothing was built: the draft moved on since the copy this save started from. */
export type FunctionsRefusal = { status: 409; error: string; limit: 'version' };

export type FunctionsSaveResult =
  | { ok: true; version: string; manifest: FunctionsManifest }
  | { ok: false; problems: FunctionsProblem[] }
  | { ok: false; refusal: FunctionsRefusal };
