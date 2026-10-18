import type { ActionAccess } from './ActionTypes';
import type { InteractionCallbackParam } from './InteractionTypes';
import type { JobStatus } from './JobTypes';

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

/** One job the functions declare (`defineFunctions({ jobs })`): everything but its code. */
export type FunctionJobManifest = {
  /**
   * Who may watch it besides whoever started it — a channel's access, read against the visitor's permissions in the
   * space. Absent, only whoever started it does.
   */
  watch?: ActionAccess;
  /** How long it may run, every slice together, in seconds — never past what the server allows. */
  maxSeconds?: number;
};

/**
 * A job as whoever may watch it sees it: what `ctx.jobs.get` answers, what `$job:<id>` says each time it moves, and
 * what `useJob` holds. Never its input or what it saved: those are its code's.
 */
export type FunctionJobView = {
  id: string;
  /** The job's name, as the functions declare it. */
  name: string;
  status: JobStatus;
  /** From 0 to 1, as its code last reported. */
  progress?: number;
  /** What it is doing, in its code's words. */
  step?: string;
  /** What it answered, once it succeeded. */
  result?: unknown;
  /** Why it failed — for a refusal, its code's own words; for anything else, that it failed. */
  error?: string;
  /** Epoch ms. */
  createdAt: number;
  updatedAt: number;
};

/** What a space's functions declare, read from the bundle when it is saved: its tasks, routes and reachable hosts. */
/**
 * One OAuth 2.0 connection a space's code makes on its visitors' (or its own) behalf, declared as data: any provider,
 * none of them known to the platform by name. `issuer` for one that publishes OpenID metadata — its endpoints are read
 * from `<issuer>/.well-known/openid-configuration` — or the endpoints themselves for one that does not.
 */
export type FunctionOAuthConnection = {
  /** An OpenID provider's issuer (`https://accounts.google.com`): the endpoints are discovered from it. */
  issuer?: string;
  /** Where the visitor is sent to consent, when there is no `issuer` (or to override what it publishes). */
  authorizeUrl?: string;
  /** Where the code is exchanged and the token refreshed, when there is no `issuer` (or to override it). */
  tokenUrl?: string;
  /** Where a token is revoked on `disconnect`, when the provider has one. */
  revokeUrl?: string;
  /** The space's credential holding the app's `clientId` and `clientSecret`: the code names it, never holds it. */
  credential: string;
  /** What is asked for, as the provider spells it. */
  scopes?: string[];
  /** More of the consent URL, as the provider needs it: `{ access_type: 'offline', prompt: 'consent' }`. */
  authorizeParams?: Record<string, string>;
  /** How the app proves who it is to `tokenUrl`: in the body (the default) or as HTTP Basic. */
  clientAuth?: 'body' | 'basic';
  /**
   * The code may read the access token (`ctx.oauth.token`), for a provider's SDK that runs in the page and asks for it
   * itself — Spotify's Web Playback, Google's Picker. Off by default: the token then leaves the server, as far as the
   * code hands it. The refresh token never does.
   */
  exposeToken?: boolean;
};

export type FunctionsManifest = {
  hosts: string[];
  tasks: FunctionTaskManifest[];
  /** The route keys, `'GET /board-assets/:board/:asset'`, as declared. */
  routes: string[];
  /** What every task and route asks for beyond the default, unless a task asks for its own. */
  limits?: FunctionTimeLimits;
  /** The OAuth connections its code makes (`ctx.oauth`), by the name the code calls them. */
  oauth?: Record<string, FunctionOAuthConnection>;
  /** The jobs it runs (`ctx.jobs.start`), by name. */
  jobs?: Record<string, FunctionJobManifest>;
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
