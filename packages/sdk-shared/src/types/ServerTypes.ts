import type { ActionRunSummary } from './ActionTypes';
import type { PluginDeclaration } from './ComponentTypes';
import type { OfflineDataRaw } from './SdkTypes';
import type { SSRMeterDecision, SSRSpaceDeployment } from './ServerAdapterTypes';
import type { FontHead } from './StyleTypes';
import type { SpaceChange } from '../history/types';
import type { IncomingHttpHeaders } from 'node:http';
import type { FC } from 'react';

export type ServerEnvironment = 'development' | 'production' | 'staging' | 'local';

export type SSRHeaders = IncomingHttpHeaders & {
  ':authority'?: string;
  ':method'?: string;
  ':path'?: string;
  ':scheme'?: string;
};

export type SSRRequest = {
  method: string;
  path: string;
  search: string;
  url: string;
  hostname: string;
  protocol: 'http' | 'https';
  headers: SSRHeaders;
  query: Record<string, string>;
  /** Raw request body. Populated only for endpoints that consume it (e.g. the login/logout handlers). */
  body?: string;
  /**
   * The client's address, when the host resolved one — through the proxies it sits behind. Forgeable by a direct
   * client like every forwarded header, so it names things (a session in a device list) and never decides anything.
   */
  ip?: string;
  ctx: SSRContext;
};

/** A body's compressed forms, by content encoding — filled as they are first asked for. */
export type CompressedBodies = Partial<Record<'br' | 'gzip', Buffer>>;

export type SSRResponseHelpers = {
  status: number;
  /** Multi-valued for the headers that genuinely are, `Set-Cookie` above all — see `setHeader`. */
  headers: Record<string, string | string[]>;
  /** An array sets the header once per entry, which `Set-Cookie` needs: a response that grants a session writes
   *  several, and collapsing them into one string would produce a single malformed cookie. */
  setHeader: (name: string, value: string | string[]) => void;
  setStatus: (code: number) => void;
  /**
   * A `Buffer` is sent byte for byte and never compressed: it is how a binary reaches the wire — a font file, an
   * image — and what it holds is usually compressed already. A string keeps the encoding negotiation.
   *
   * `compressed` is where this body's compressed forms are kept, for a body that is sent again unchanged — a cached
   * page, a static file. The first send of each encoding compresses and stores it; every later one sends the stored
   * bytes. Without it a cache hit recompressed the same page on every request, which was nearly all the CPU a cached
   * page cost.
   *
   * A function is a body read only when it is needed: when the stored form for this request's encoding is missing, or
   * the client takes no compression. A static file is then read from disk once per encoding, not on every request.
   */
  send: (body: string | Buffer | (() => string), options?: { compressed?: CompressedBodies }) => void;
  write: (chunk: string | Buffer) => void;
  end: () => void;
};

// Mutable channel written during the React SSR render and read back by the server to shape the HTTP
// response (status, redirect, extra headers). Passed by reference as a prop so it crosses the
// server/SDK bundle boundary without relying on a shared React context instance.
export type SSRRenderResult = {
  status?: number;
  redirect?: string;
  headers?: Record<string, string>;
};

export type SSRCredential = {
  provider: string;
  data: unknown;
};

/**
 * How a plugin's build reaches the page.
 *
 * `copy`, `compile` and `download` all end with a file on this server's disk, which is also what lets the SSR
 * render import the component and put its output in the HTML. `cdn` deliberately does not: the published URL is
 * handed straight to the browser and the plugin renders on the client only.
 *
 * That trade is worth taking for a plugin this server did not build. Importing a third-party bundle into the
 * render process means the bundle's own copy of React runs inside the renderer, and two copies of React is an
 * invalid hook call — a crash that takes the whole page down rather than the one component.
 */
export type PluginAction = 'copy' | 'compile' | 'download' | 'cdn';

export type PluginSourceFile<T = Record<string, unknown>> = {
  js: string;
  css?: string;
  action?: PluginAction;
  version?: string;
  props?: T;
};

export type PluginSourceComponent<T = Record<string, unknown>> = {
  component: unknown;
  js?: string;
  css?: string;
  version?: string;
  props?: T;
};

export type PluginSource<T = Record<string, unknown>> = PluginSourceFile<T> | PluginSourceComponent<T>;

export type PluginEntry = {
  name: string;
  /** JS-safe identifier for the import statement (hyphens/dots replaced with underscores, no @version). */
  varName: string;
  /** SDK lookup key used as the object property (base name without @version). */
  keyName: string;
  /** Browser-facing URL served by the SSR server (e.g. /sdk-plugins/name@ver/index.js). */
  js?: string;
  /** Absolute filesystem path used for server-side dynamic import() during SSR. */
  filePath?: string;
  css?: string;
  props: Record<string, unknown>;
  /**
   * Whether the SSR render actually included this plugin's own output.
   *
   * False for a plugin served straight from its CDN, and for one whose server-side import failed. Either way the
   * client must not render it on the hydration pass: the markup would not be in the document React is hydrating
   * against, and the mismatch throws away the whole tree it happens in.
   */
  ssr?: boolean;
  /**
   * What the plugin declares, when this page draws none of its types: its code and stylesheet are left out of the
   * document and loaded when a page that draws it is opened. Absent, the page loads it up front.
   */
  deferred?: PluginDeclaration;
};

export type SSRTemplateProps = {
  title?: string;
  /** Meta description for the document, and the share-preview text derived from it. */
  description?: string;
  jsPath?: string;
  cssPath?: string;
  /** Font Awesome's rules, after `cssPath`; its fonts are files beside it, fetched only for a style the page uses. */
  iconsCssPath?: string;
  /**
   * Where the page fetches the space from, when it travels beside the document rather than in its payload: the
   * page preloads it, and the bootstrap reads it before hydrating.
   */
  spaceDocumentPath?: string;
  builderJsPath?: string;
  builderCssPath?: string;
  plugins?: PluginEntry[];
  react?: string;
  reactJsx?: string;
  reactDom?: string;
  reactDomClient?: string;
  reactCompilerRuntime?: string;
  /** When true the client-side <script> block is omitted — useful for inspecting raw SSR HTML. */
  ssrOnly?: boolean;
  /** The page listens for what the server tells it changed — with `livePages` on (`updatePages`, `reloadPages`). */
  livePages?: boolean;
  /** The draft the page shows (`?__pt=<id>`), named in its listening address so it hears its own changes alone. */
  liveDraft?: string;
  /** The page's plugins can be swapped where they are drawn — a server developing (`devMode`) with `livePages` on. */
  hotPlugins?: boolean;
  debugMode?: boolean;
  /**
   * The theme class this document wears on `<html>` — `dark`, `light`, or nothing at all.
   *
   * The theme is kept in a cookie, so the server that renders the document already knows it: the page arrives
   * painted correctly, with no blocking script in the head and no first paint in the other theme. Empty is not a
   * failure — it is `system`, and the stylesheet's `prefers-color-scheme` queries answer it.
   */
  themeClass?: string;
  /**
   * The document's web fonts: `fontsToHead(style.fonts, ...)` from this package.
   *
   * In the template rather than left to the SDK because a page paints before its JavaScript exists. A face
   * requested at hydration arrives after the text it is for has already been drawn in a fallback, which is a
   * reflow the visitor watches happen.
   */
  fonts?: FontHead;
};

/**
 * Remote pictures this server fetches, resizes and keeps, at `/_plitzi/img`.
 *
 * A picture from a dozen other sites, some 1500 px wide for a 360 px card, is the heaviest part of most pages; with
 * this on, an `image` whose `src` is another site's offers the browser a `srcset` of sizes this server makes — in
 * AVIF or WebP when the browser takes them, and with `sharp` installed (without it the picture is passed through,
 * still cached).
 */
export type SSRImagesConfig = {
  /**
   * The hosts a picture may come from: `images.example.com`, or `*.example.com` for every subdomain. Nothing else is
   * fetched — the endpoint is otherwise a way to make this server download anything — and each address is also held
   * to the rule every outbound request is (no private network, every redirect judged).
   */
  domains: readonly string[];
  /** Where the resized files are kept. Default: `tmp/images` under the working directory. */
  cacheDir?: string;
};

/**
 * How a store-relative font path becomes a URL a browser can fetch.
 *
 * A space's manifest stores paths, never absolute URLs: the same space is rendered by Plitzi's cloud from a CDN,
 * by a self-hosted server from its own disk, and by a static export from wherever it was published to. Baking one
 * of those origins into the document would send every other deployment asking Plitzi for its customer's fonts.
 */
export type SSRFontsConfig = {
  /** Prefix joined to each path, e.g. `/fonts` or `https://cdn.example.com/fonts`. Default: `/fonts`. */
  baseUrl?: string;
  /**
   * A directory this server serves the uploaded files from, under `/fonts/*`.
   *
   * The self-hosting answer, and the reason `baseUrl` defaults to a path rather than an origin: with a directory
   * here a deployment needs no object storage, no credentials and no network to serve its customers' fonts. A
   * cloud deployment leaves it out and points `baseUrl` at its CDN instead.
   */
  dir?: string;
};

export type SSRPlugin = {
  component: FC;
  props: Record<string, unknown>;
};

/** What a space token is worth. `render` is the public credential every published site embeds — it is readable
 *  by anyone who views the page, so it may only read, and only from the origins it declares. `host` is that same
 *  read access for a SERVER that renders the space as its own (self-hosting): secret rather than published, since
 *  a server has no browser origin for the allowlist to check. `agent` is the delegated grant an MCP connector
 *  receives after a member consents, and is the only bearer that may write without a session behind it. */
export type SpaceScope = 'render' | 'agent' | 'host';

/** A resolved space token: which space, what the bearer may do, and (for `agent`) the member who consented.
 *  `canWrite` is computed by the consumer from its own authorization model — the MCP never derives it. */
export type SSRGrant = {
  spaceId: number;
  scope: SpaceScope;
  userId?: number;
  /** For an `agent` grant, the application the member connected (`Claude`): what its writes are recorded and shown as. */
  client?: string;
  canWrite: boolean;
};

/** A page of a space's change history, newest first; `nextBefore` reads further back, null at the end. */
export type SSRChangePage = { changes: SpaceChange[]; nextBefore: number | null };

/** What to read of the history: older than `before`, only the changes that touched `entityId`, `limit` at a time. */
export type SSRChangeQuery = { before?: number; entityId?: string; limit: number };

/** Who a write is made for and which request made it, for a consumer that records its changes. Every document one
 *  request writes shares its `batch`: one `plitzi_apply`, read back as one change. `client` is the application that
 *  wrote it for them (`SSRGrant.client`). */
export type SSRWriteContext = { userId?: number; batch: string; client?: string };

/**
 * A session, as the thing that issued it describes it. Deliberately free of transport: whoever mints one says what
 * the credentials are and when they die, and the server decides how they are carried — which is what lets a
 * deployment bring its own identity source without also reimplementing cookies.
 */
export type SSRSession = {
  token: string;
  /** Unix seconds. */
  expiresAt: number;
  refreshToken?: string;
  refreshExpiresAt?: number;
};

/**
 * How this deployment's session cookies are named and scoped. Every field has a working default derived from the
 * request host, so a server that says nothing still gets a correct cookie; the function forms exist for deployments
 * whose naming varies by environment or host, which is a policy only they know.
 */
export type SSRAuthCookie = {
  name?: string | ((hostname: string) => string);
  /** Return undefined for a host-only cookie. Defaults to the registrable domain, so sibling sub-domains share it. */
  domain?: string | ((hostname: string) => string | undefined);
  sameSite?: 'lax' | 'none';
  secure?: boolean;
  /** Path the refresh credential is confined to, so it never rides along on ordinary traffic. Defaults to `/auth`. */
  refreshPath?: string;
  /** Suffix of the readable companion cookie that carries only expiries. Defaults to `_hint`. */
  hintSuffix?: string;
};

export type SSRUser = {
  token: string; // e.g. JWT or opaque token from auth provider
  /** Unix seconds the token dies at, so the rendered page can renew ahead of it rather than on a refusal. */
  expiresAt?: number;
  id: number;
  username: string;
  email: string;
  verified: boolean;
  permissions: string[];
  roles: string[];
};

/**
 * Who a run is for, as the session named them — without the session: what a step, a function and a job see of the
 * person, and what a job keeps of whoever started it, for every slice it runs after their session is gone.
 */
export type RunUser = Pick<SSRUser, 'id' | 'username' | 'email' | 'verified' | 'permissions' | 'roles'>;

export type SSRTemplateFn = (params: SSRTemplateProps & { html: string; offlineData: string }) => string;

/** Which surfaces a page server mounts. Only what the page pipeline itself owns: the MCP endpoint and
 *  draft-preview are stages a companion package hands in, so they are not flags here. */
export type ServerServices = {
  ssr?: boolean;
  rsc?: boolean;
};

export type PluginRegistry = {
  register: (name: string, source: PluginSource) => void;
  invalidate: (name?: string, version?: string) => Promise<void>;
};

export type CacheFilter = {
  spaceId?: number;
  environment?: string;
  hostname?: string;
};

export type CacheManager = {
  invalidate: (filter?: CacheFilter) => number;
  clear: () => void;
  readonly size: number;
};

export type SSRMiddlewareNext = () => Promise<void> | void;

export type SSRMiddleware = (req: SSRRequest, res: SSRResponseHelpers, next: SSRMiddlewareNext) => Promise<void> | void;

export type SSRContext = {
  spaceDeployment?: SSRSpaceDeployment;
  user?: SSRUser;
  /** What {@link SSRAdapters.meter} answered for this request, so the render reads the decision instead of
   *  asking for it a second time. */
  meter?: SSRMeterDecision;
  /**
   * The runs this request's server elements started, as the action resolver ran them. Read once the render or the
   * refresh is done, and handed on only to a page whose debugging is authorized.
   */
  actionRuns?: ActionRunSummary[];
  /**
   * This server previews a run of agents and answers its snapshot at `RUN_STATUS_PATH` (`plitzi run preview`): said to a
   * page that may debug, so its dev tools ask for the run — and no other page's ask a server that has none.
   */
  runStatus?: true;
  /**
   * What a refresh of server data asked for beside the page's own address (`/_rsc?location=…&q=…`): a provider's
   * `input`, a page window. What the provider asks for this time, so it wins over the `input` the element was saved
   * with — the query string of the page does not.
   */
  rscParams?: Record<string, string>;
};

export type SSRServer = {
  /**
   * Binds the port. Resolves once it takes connections — in a fleet, once the first worker does — so what says "ready"
   * (a log line, a file a tool reads, a test's first request) says it after, never before. A port it could not take
   * ends the process, or goes to `onListenError`: the promise is then never resolved.
   */
  listen: (port: number, host?: string) => Promise<void>;
  close: () => Promise<void>;
  readonly cache: CacheManager | null;
  readonly plugins: PluginRegistry;
  /**
   * With `livePages` on, every page open on this server loads again — what a change the pages cannot be handed as
   * documents calls (the server's own code, its plugins' declarations). Nothing otherwise.
   */
  reloadPages: () => void;
  /**
   * With `livePages` on, every page open on this server showing its own space — or, with `draft`, that draft — swaps it
   * for `documents` where it stands, its state, scroll and focus kept; a page that cannot (one with elements the server
   * draws) loads again. What a project that authors its space in code calls once it serves the new documents
   * (`serveProject`), instead of restarting the server. How many pages were told; none without `livePages`.
   */
  updatePages: (documents: OfflineDataRaw, options?: { draft?: string }) => number;
  /**
   * The server halves of the plugins this server ships (`functions.plugins`), replaced while it runs: what a development
   * server does when a plugin's `functions/` change. `definition` is what `loadFunctions` loads; none takes it away.
   */
  readonly functions: { setPlugin: (plugin: string, definition: unknown) => void };
};
