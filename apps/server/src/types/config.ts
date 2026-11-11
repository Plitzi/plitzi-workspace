import type { CacheFilter, SSRFontsConfig, SSRImagesConfig, SSRTemplateFn, ServerServices } from './server';
import type { SSRAuthCookie, SSRPageAdapters, ServerBaseConfig } from '@plitzi/sdk-kernel/types';
import type {
  DraftStore,
  Environment,
  PluginSource,
  PubSubAdapter,
  SSRPreviewConfig,
  ServerAuth
} from '@plitzi/sdk-shared';

/**
 * A rendered page as a store shared by every replica keeps it: one encoding of its body, and when it was rendered — so
 * a replica that reads it knows how fresh it is, not when it read it.
 */
export type SharedPage = {
  encoding: 'br' | 'gzip' | 'identity';
  body: Buffer;
  renderedAt: number;
  /** The nonce the page was rendered with, which its script policy names (`scriptPolicy`); empty without one. */
  nonce: string;
};

/** Where a shared page is filed: what `server.cache.invalidate` filters it by. */
export type SharedPageFacts = { spaceId: number; environment: string; hostname: string };

/**
 * The pages every replica of a deployment shares, beside the copy each process keeps: a replica that never rendered a
 * page serves it from here, and a new one (a scale-up, a restart) starts with the pages warm. `createRedisPageStore`
 * is one; only pages rendered for nobody in particular are put here, never a signed-in visitor's.
 */
export type SharedPageStore = {
  get: (key: string) => Promise<SharedPage | undefined>;
  /** Kept for `ttlMs`, under `facts`, which an invalidation matches. */
  set: (key: string, page: SharedPage, facts: SharedPageFacts, ttlMs: number) => Promise<void>;
  /** Drops what `filter` matches (everything without one) and says how many pages that was. */
  invalidate: (filter?: CacheFilter) => Promise<number>;
};

/**
 * How the pages this server renders are kept. The TTL is `cacheTtlMs`; this is what is kept, for how long past it,
 * and how a deployment of several replicas keeps them in step.
 */
export type SSRCacheConfig = {
  /**
   * What one process keeps of rendered pages at most, in bytes. Default `SDK_SERVER_CACHE_MAX_BYTES` (`512MB`, `2GB`),
   * else 128 MB. A page is kept compressed — 60–120 KB for a 1 MB page — so that is some 1 200 large pages; what was
   * served once gives way before what is served again.
   */
  maxBytes?: number;
  /**
   * How long past its TTL a page is still served while one request renders it again behind it — the visitor after
   * the TTL gets the page as fast as the one before, not a render. Default 60 000; `0` renders on the request that
   * finds it expired. An invalidation drops a page outright: this never serves one a write made untrue.
   */
  staleMs?: number;
  /**
   * Query parameters a page is rendered as if absent, and cached as if absent: the ones a link carries for analytics
   * (`utm_*`, `fbclid`, `gclid`…), which a page has no business drawing differently. The browser still has them —
   * what reads them after the page loads reads them. Each `prefix*` matches by prefix. Default the
   * analytics ones a link is given by the common tools (sdk-server's `DEFAULT_IGNORED_QUERY_PARAMS`); `[]` keys every
   * parameter.
   */
  ignoredQueryParams?: string[];
  /**
   * How an invalidation reaches every replica: each process subscribes, and `server.cache.invalidate` publishes. The
   * realtime adapter does (`createRedisPubSub`). Without one, an invalidation reaches this process and its workers —
   * a deployment of several replicas serves a page a write made untrue until its TTL runs out, and says so at boot.
   */
  bus?: PubSubAdapter;
  /** The pages every replica shares. Without one, each process keeps its own. */
  store?: SharedPageStore;
};

export type SSRRscConfig = {
  /** Whether the RSC endpoint is active. Defaults to true when adapters.getRscData is provided. */
  enabled?: boolean;
  /** URL path for the RSC endpoint. Defaults to '/_rsc'. */
  path?: string;
  /** Server-side cache TTL for RSC responses in milliseconds. Defaults to 30 000. Set to 0 to disable. */
  cacheTtlMs?: number;
  /**
   * How long ONE server element may take before the page is answered without it. Defaults to 5 000.
   *
   * It is the page's ceiling, and it wins over the producer's own: an action may be allowed ten seconds of its
   * own (`action.limits.timeoutMs`) and still be cut off here, because a section is worth waiting for only as
   * long as the visitor is. Whichever is tighter decides, and now that the budget CANCELS what it stops waiting
   * for, being cut here ends the run rather than leaving it to finish for nobody.
   *
   * Raise it for a deployment whose sections are genuinely slow and worth the wait; lower it to keep a page fast
   * at the cost of showing more empty sections when a provider is having a bad day.
   */
  elementTimeoutMs?: number;
  /**
   * The deployment's own APIs a server provider may ask AS THE VISITOR (`credentials: 'include'`) — off unless named.
   * The page then arrives with the visitor's own data instead of drawing empty and asking once the browser has run.
   */
  visitorCredentials?: SSRVisitorCredentialsConfig;
};

/**
 * Who a server provider may carry the visitor's cookies to, as the browser would have carried them.
 *
 * The browser sends them to an API only when that API's CORS allows the page's site; the page server would send them
 * wherever a document said. So the API is named here, by whoever runs the server, and so are the spaces trusted to
 * ask it: on a server that serves its customers' spaces beside its own, a customer's page must never read a visitor's
 * account through that visitor's session. A page read this way is kept for nobody — not even that visitor's next
 * visit, which would show what a write a moment ago made untrue.
 */
export type SSRVisitorCredentialsConfig = {
  /**
   * The origins a provider's `query` may name (`https://api.example.com`), as its template comes to them on the visit.
   * Any other is the provider's error, saying so — never asked without the cookies it expected.
   */
  origins: string[];
  /**
   * Where this server reaches each of those origins on its own network — `{ 'https://api.example.com':
   * 'http://api.internal:8888' }` — rather than through the public edge. One not named is asked at its own address.
   */
  via?: Record<string, string>;
  /** The cookies carried, by name — the session's. Without it, every cookie the page request came with. */
  cookies?: string[];
  /**
   * Which spaces may ask as their visitor. Without it, every space this server serves — the answer for a server of one
   * space, and never for a platform that serves its customers' too.
   */
  spaces?: (space: { spaceId: number; environment: Environment }) => boolean | Promise<boolean>;
  /**
   * Where each of those APIs hands out a CSRF token (`'/auth/csrf'`, the kernel's flow). Given, the pages of the spaces
   * above are told the APIs and the cookie each keeps the token in (`<meta name="plitzi-csrf">`), and every write they
   * send there with the visitor's session echoes it (`@plitzi/sdk-shared/csrf`) — what an API that asks for it
   * (`createCsrfMiddleware`) needs. Never told to a space not trusted to carry its visitors' sessions.
   */
  csrfPath?: string;
};

export type SSRServerConfig = ServerBaseConfig & {
  /**
   * Every page this server renders listens for what changes under it: new documents for the space it shows, swapped
   * where it stands (`updatePages`), or everything loaded again (`reloadPages`) — the edit loop of a project that
   * authors its space in code, a page an agent keeps rewriting (`createAuthoringHost`). Off unless asked for, `devMode`
   * included: each open page holds a connection to the server for it, which a server whose space never changes under
   * it would only pay for.
   */
  livePages?: boolean;
  /**
   * How many pages of ONE space this process renders at once, so a space's burst waits behind its own renders instead
   * of taking every render from the other spaces this server serves. A kept page takes no turn: what is held back is
   * what costs — a visitor's own page, a draft drawn with its providers' answers, an address no kept page answers.
   * `perSpace` is every space's, unless its deployment says its own (`SSRSpaceDeployment.renderLimit`); without
   * either a space has no limit. A page past it waits `waitMs` (2000) for a turn, then is answered 503 with
   * `Retry-After`. Per process: a server of four workers renders up to four times as many.
   */
  renderLimit?: SSRRenderLimitConfig;
  /** What is kept of rendered pages, and how several replicas keep them in step — see {@link SSRCacheConfig}. */
  cache?: SSRCacheConfig;
  /**
   * A page says what it will load before it is rendered: a `103 Early Hints`, and a `Link` header a CDN keeps to send
   * its own. On by default; `false` for a proxy in front that mishandles a 103.
   */
  earlyHints?: boolean;
  loginPath?: string | false;
  logoutPath?: string | false;
  /** Where a page signs its person out on every device (`endSessions`). Defaults to `/auth/logout-everywhere`. */
  logoutEverywherePath?: string | false;
  /** Where a browser-obtained credential is handed over. Defaults to `/auth/exchange`; served only when the
   *  `exchangeCredential` adapter is supplied. */
  exchangePath?: string | false;
  /**
   * Signing visitors in by redirect, through an OAuth 2.1 authorization server — see {@link SSRSignInConfig}. Served
   * only with the `exchangeCredential` adapter, which is what turns what comes back into a session on this host.
   */
  signIn?: SSRSignInConfig;
  /**
   * The sign-in this server's pages are told about (`server.auth`), so a space that declares no `userProvider` signs
   * in with nothing to declare. `createServer({ auth })` fills it from the kernel's `basePath`; name it yourself when
   * the `/auth` flows are served by another host. The session hint cookie is added per request, named for the host.
   */
  pageAuth?: Omit<ServerAuth, 'sessionHintCookie'>;
  /** Naming and scope of the session cookies this server writes. See {@link SSRAuthCookie}. */
  authCookie?: SSRAuthCookie;
  templateFn?: SSRTemplateFn;
  plugins?: Record<string, PluginSource>;
  /** Where the plugins it builds are kept. Default: `tmp/.sdk-plugins` under the working directory. */
  pluginsCacheDir?: string;
  pluginsTtlMs?: number;
  /** Auto-download and cache plugins declared in the schema's offlineData.plugins list. Default: true. */
  autoLoadSchemaPlugins?: boolean;
  /** Where this deployment serves the font files a space uploaded — see {@link SSRFontsConfig}. */
  fonts?: SSRFontsConfig;
  /** Remote pictures resized by this server — see {@link SSRImagesConfig}. Absent, images keep their own `src`. */
  images?: SSRImagesConfig;
  /** Omit client-side JS from the rendered page — useful for verifying SSR HTML without hydration. Default: false. */
  ssrOnly?: boolean;
  /** Stream HTML to the client as React renders, reducing TTFB. Default: false. */
  streaming?: boolean;
  /**
   * A page's script policy, against cross-site scripting: only the scripts its template writes run — by the render's
   * nonce — and what they load (`'strict-dynamic'`); no plugin objects, no `<base>`. `'enforce'` refuses the rest — an
   * inline handler, a script a raw HTML block brought, an injected one. `'report-only'`, the default, refuses nothing:
   * the browser reports to `/_plitzi/csp-report` what it would have refused, and the server says it in its log, so a
   * space's own scripts are seen before anything is refused. A space's deployment may say otherwise for its host
   * (`SSRSpaceDeployment.security`). A cached page keeps its render's nonce while it is kept. `false` sends none.
   */
  scriptPolicy?: false | 'report-only' | 'enforce';
  /**
   * Trusted Types beside the script policy: every write of markup into the page (an `innerHTML`, a script's text) goes
   * through one of the SDK's named policies, which clean what an author or the data wrote (DOMPurify) when the page's
   * policy is enforced. `'report-only'` (the default, while there is a script policy) reports a write that went through
   * none; `false` asks nothing.
   */
  trustedTypes?: false | 'report-only';
  /** RSC (React Server Components) endpoint configuration. */
  rsc?: SSRRscConfig;
  /** Which request-handling services this server mounts: `ssr` on by default, `rsc` whenever
   *  `adapters.getRscData` exists. Stages a companion package contributes are deliberately NOT flags here —
   *  handing them over is the decision. Only createServer reads these as written; the surface factories pin what
   *  their name promises (a page server serves pages; a dedicated MCP server serves MCP alone). */
  services?: ServerServices;
  /** Cache-buster appended as ?v=<assetVersion> to all default SDK asset URLs (jsPath, cssPath, react vendor). Compute from file mtime or package version at startup. */
  assetVersion?: string;

  /** The draft-preview endpoint, and the store behind it. The draft is WRITTEN by an MCP tool and RENDERED here,
   *  so this is the one piece of that feature the page server owns: `@plitzi/sdk-mcp` carries everything else in
   *  its own options, and a deployment that never installs it leaves both unset.
   *
   *  `preview` mounts the endpoint (off unless `enabled`); `draftStore` backs the tokens and defaults to an
   *  in-memory store — inject a shared one (e.g. Redis) for multi-replica correctness. */
  preview?: SSRPreviewConfig;
  draftStore?: DraftStore;
};

/** The same config as seen by a server that serves PAGES: its adapters answer for a page request. This is what
 *  `createServer` from `@plitzi/sdk-server` takes and what the SSR stages are handed, so a page stage reaches
 *  `getOfflineData` without asking whether it is there — while a stage typed to the bare context (anything from
 *  `@plitzi/sdk-mcp`, which also runs in servers that have neither) still has to check. */
/**
 * A visitor signs in somewhere else and comes back signed in HERE: `GET <path>?return=/somewhere` sends them to the
 * authorization server, and `GET <path>/callback` takes the code it answers with, redeems it server to server and
 * hands the token to `exchangeCredential` — which is what makes the session, on this host, for this space.
 *
 * This server registers itself with the authorization server (RFC 7591) as the host the visitor is on, and proves the
 * exchange with PKCE. The state travels in a `__Host-` cookie, which no sibling host can set: a sign-in somebody else
 * started cannot be finished in this browser.
 */
export type SSRSignInConfig = {
  /** What `exchangeCredential` knows the tokens by. */
  provider: string;
  /** Where the visitor's browser is sent: the authorization server's `/authorize`, as the public reaches it. */
  authorizeUrl: string;
  /** Where this server registers itself and redeems codes — reachable from here, which may be a private address. */
  registerUrl: string;
  tokenUrl: string;
  /** What to ask for, for the space being signed into. */
  scope: (spaceId: number) => string;
  /** Where the flow answers. Default `/auth/sign-in`; the authorization server sends people back to `<path>/callback`. */
  path?: string;
};

/** `SSRServerConfig.renderLimit`: the turns of one space's renders in one process. */
export type SSRRenderLimitConfig = {
  /** Every space's limit, unless its deployment says its own. At least 1. */
  perSpace?: number;
  /** How long a page past the limit waits for a turn before it is answered 503. */
  waitMs?: number;
};

export type SSRPageServerConfig = SSRServerConfig & { adapters: SSRPageAdapters };
