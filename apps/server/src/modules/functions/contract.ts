import type { LaterAnswer, LaterRequest } from '../actions/jobs/later';
import type { RateCount, RateLimit } from '../actions/runtime/rateLimit';
import type { ActionKvStore } from '../actions/types';
import type { Environment, FunctionTimeLimits, InteractionCallbackParam } from '@plitzi/sdk-shared';

/**
 * Who started the run, as a space's own code may know them: everything a function decides by — who, their roles and
 * permissions — and never their session. A token inside the sandbox is a token a function could send anywhere.
 */
export type FunctionUser = {
  id: number;
  username: string;
  email: string;
  verified: boolean;
  permissions: string[];
  roles: string[];
};

/**
 * A request a function makes: `fetch`'s own init, and `credential` — the id of one of the space's credentials, whose
 * values the platform writes into the request where it says `{{credential.<key>}}` (in the URL, a header or the
 * body). The code never holds the value; it names it.
 */
export type FunctionFetchInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  credential?: string;
};

/** What a function's `fetch` answers: a web `Response`, whichever runner it is in. */
export type FunctionFetch = (url: string | URL, init?: FunctionFetchInit) => Promise<Response>;

/**
 * Everything a space's code can do besides computing — one object, the same wherever it runs. In a self-hosted server
 * it is built from the run's own context; in the sandbox each method is a call back to the platform, which scopes it
 * to the space and the run before doing it.
 */
export type FunctionContext = {
  spaceId: number;
  environment: Environment;
  runId: string;
  /** How the run was started: `call`, `render`, `schedule`, `webhook`… */
  trigger: string;
  /** `user:<id>` for a session, `ip:<address>` for everyone else — what a limit per person keys on. */
  callerId: string;
  user?: FunctionUser;
  /**
   * The space's own key/value store: `get`, `set`, `swap`, `increment`, lists — and `change`, to read, change and write
   * a value back without undoing a writer that got there first.
   */
  kv: ActionKvStore;
  /**
   * Counts one more of `bucket` — per caller unless `per: 'everyone'` — and says whether it was within `most` in every
   * `perSeconds`. The same count as a flow's `flow.rateLimit` step on that bucket. What to answer when it is not is the
   * code's.
   */
  rateLimit: (bucket: string, limit: RateLimit) => Promise<RateCount>;
  /**
   * Signs `value` with a key of the space's own that the platform keeps and the code never sees: HMAC-SHA-256,
   * base64url. What a link, an invitation or a key handed to a page is made of. Refused on a server with no signing
   * secret.
   */
  sign: (value: string) => Promise<string>;
  /** Whether `signature` is what `sign` answered for `value`, compared in constant time. */
  verify: (value: string, signature: string) => Promise<boolean>;
  /** To the hosts the space declared (`allow.hosts`) — and, with `credential`, with one of its secrets written in. */
  fetch: FunctionFetch;
  /** Says something on one of the space's realtime channels, as the server. */
  publish: (topic: string, type: string, data: unknown) => Promise<void>;
  /** Lets the visitor into one topic of a private (`grant: true`) channel. */
  grant: (topic: string, ttlSeconds?: number) => Promise<string>;
  /** Takes a grant back — or every grant for the topic, naming none. */
  revoke: (topic: string, grant?: string) => Promise<void>;
  /**
   * Starts one of the space's actions — one with a `later` trigger — in so many seconds, on the server, whether or not a
   * page is still open: a turn that runs out, a bot's move, a hold that lapses. A `key` names it: set again under the
   * same key, the one still waiting is replaced. Answers the job and when it is due (epoch ms, by the queue's clock).
   * `ctx.later({ action: 'game.timeout', in: 45, input: { room }, key: 'turn:' + room })`.
   */
  later: (request: LaterRequest) => Promise<LaterAnswer>;
  /** Drops what waits under `key` — the timer of a game that ended — and answers how many. */
  cancelLater: (key: string) => Promise<number>;
  /**
   * One file of the space's data — a project's `src/data/<file>` — parsed, as of the version the run belongs to: what
   * a page must not carry, read here and answered only as far as it is shown. Read-only. `ctx.data('products.json')`.
   */
  data: (file: string) => Promise<unknown>;
  /** A line for whoever reads the run: the builder's Try, and the deployment's logs. */
  log: (...values: unknown[]) => void;
  /** Progress for a caller that asked for a stream — a no-op when nobody did. */
  emit: (chunk: unknown) => void;
  /** Aborted when the run is: cancelled, or out of time. Hand it to what can stop early. */
  signal: AbortSignal;
};

/**
 * One step a server action can take, written by the space. The shape of the platform's own tasks — addressed as
 * `<namespace>.<action>`, drawn in the builder from `params` — run with a {@link FunctionContext} rather than the
 * platform's full one.
 */
export type FunctionTask<T extends Record<string, unknown> = Record<string, unknown>> = {
  namespace: string;
  action: string;
  title: string;
  description?: string;
  params: Record<keyof T, InteractionCallbackParam<T>>;
  /**
   * More CPU or time than an invocation gets by default — `{ cpuMs: 1000 }` for a task that reshapes a big feed — up to
   * what the server allows. Over the functions' own `limits`, for this task.
   */
  limits?: FunctionTimeLimits;
  run: (params: T, ctx: FunctionContext) => unknown;
};

/** What a route's handler gets besides the request: the context, and the `:params` its key named, by name. */
export type FunctionRouteContext = FunctionContext & { params: Record<string, string> };

/**
 * An HTTP endpoint of the space, under `/fn/`: a web-standard handler, the shape every edge runtime runs. The request
 * carries no credentials — `ctx.user` says who is asking — and the response sets no cookies: the host's are the
 * platform's.
 */
export type FunctionRoute = (request: Request, ctx: FunctionRouteContext) => Response | Promise<Response>;

/** What a space's `functions/index.ts` exports: its tasks, its routes, and where its code may reach. */
export type FunctionsDefinition = {
  /** The hosts `ctx.fetch` may reach. Anything else is refused before it leaves. */
  allow?: { hosts?: string[] };
  tasks?: FunctionTask<never>[];
  /** `'GET /board-assets/:board/:asset'` → a handler, served at `/fn/board-assets/…`. */
  routes?: Record<string, FunctionRoute>;
  /** More CPU or time than an invocation gets by default, for every task and route — a task may ask for its own. */
  limits?: FunctionTimeLimits;
};

/**
 * What a function throws to refuse, with a reason written for whoever asked — a wrong password, a board that is
 * read-only. Its message reaches the page as the step's error (`{{ step.error }}`), and a route answers it with a 400;
 * anything else a function throws stays in the run's record, since an error can carry what a visitor must not read.
 * The platform's own class: the same natively and, printed into the bundle, in the sandbox.
 */
export { ActionRefusal } from '../actions/runtime/errors';

/**
 * Declares a space's functions. An identity at run time: it is here for the types, and so the same file is valid
 * wherever it is loaded — natively in a self-hosted server, or built by the platform and run in its sandbox.
 */
export const defineFunctions = (definition: FunctionsDefinition): FunctionsDefinition => definition;
