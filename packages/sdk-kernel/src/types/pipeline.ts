import type { SSRMeterDecision, SSRSpaceDeployment } from './adapters';
import type { ActionRunSummary, FontHead, PluginEntry, SSRUser, SpaceScope } from '@plitzi/sdk-shared';
import type { SpaceChange } from '@plitzi/sdk-shared/history';
import type { PageHeadTags } from '@plitzi/sdk-shared/schema';
import type { IncomingHttpHeaders } from 'node:http';

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
  /**
   * A `103 Early Hints` with these `Link` values, before the response itself: what the page will ask for, fetched while
   * it is still being rendered. Nothing on a transport that cannot send one, or once the response has begun.
   */
  earlyHints?: (links: string[]) => void;
};

export type SSRCredential = {
  provider: string;
  data: unknown;
};

export type SSRTemplateProps = {
  /** The render's script nonce, written on each of the template's own scripts (`SSRServerConfig.scriptPolicy`). */
  nonce?: string;
  /**
   * The page's script policy, said on `<html data-plitzi-script-policy>`: what every copy of the SDK's shared code a page
   * loads — the builder's, a plugin's own — reads to hold itself to it (`startMarkupPolicies`).
   */
  scriptPolicy?: 'report-only' | 'enforce';
  title?: string;
  /** Meta description for the document, and the share-preview text derived from it. */
  description?: string;
  /** The page's JSON-LD, each object as the text of its `<script type="application/ld+json">`, escaped for the tag. */
  structuredData?: string[];
  /**
   * The head's tags besides the title and the JSON-LD — description, robots, Open Graph and card, the canonical
   * address, the icon, the browser's colour, the language — as `pageHeadTags` decides them. The server's own.
   */
  head?: PageHeadTags;
  jsPath?: string;
  cssPath?: string;
  /** Font Awesome's rules, after `cssPath`; its fonts are files beside it, fetched only for a style the page uses. */
  iconsCssPath?: string;
  /**
   * The space's own icon faces — the glyphs it names, cut from the whole font (`/_plitzi/icons/`) — declared after
   * `iconsCssPath`'s, so a glyph in their range is fetched from them and any other from the whole font.
   */
  iconFaces?: string;
  /** What the page's writes to the deployment's own APIs echo the CSRF token with (`@plitzi/sdk-shared/csrf`), as JSON. */
  csrfHint?: string;
  /**
   * Where the page fetches the space from, when it travels beside the document rather than in its payload: the
   * page preloads it, and the bootstrap reads it before hydrating.
   */
  spaceDocumentPath?: string;
  /**
   * The space's compiled stylesheet, when the page links it rather than carrying it (`style.cacheHref`): a template
   * puts it in the head, where it is applied from the page's first frame.
   */
  styleSheetPath?: string;
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

/** A resolved space token: which space, what the bearer may do, and (for `agent`) the member who consented.
 *  `canWrite` is computed by the consumer from its own authorization model — the MCP never derives it. */
export type SSRGrant = {
  spaceId: number;
  scope: SpaceScope;
  userId?: number;
  /** For an `agent` grant, the application the member connected (`Claude`): what its writes are recorded and shown as. */
  client?: string;
  canWrite: boolean;
  /**
   * Whether it may write and play the space's tests — every role that writes may, and a tester's role (`Can test`) may
   * with nothing else: the MCP saves the tests alone through it, never another change.
   */
  canTest?: boolean;
  /** Why `canWrite` is false, in the consumer's words, said to the agent in place of the MCP's own: a role that views
   *  or edits only the content never had the right to change the design — it did not lose it. */
  readOnlyReason?: string;
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
   * This request renders a draft session minted for a test runner (`DraftEntry.inspected`): the page carries the
   * space's state bridge, `window.__plitzi`, with no panel or badge.
   */
  inspectedDraft?: true;
  /**
   * What a refresh of server data asked for beside the page's own address (`/_rsc?location=…&q=…`): a provider's
   * `input`, a page window. What the provider asks for this time, so it wins over the `input` the element was saved
   * with — the query string of the page does not.
   */
  rscParams?: Record<string, string>;
  /**
   * What this request spent before the page was rendered — each middleware, the metering — in ms, kept only by a
   * development server: it goes out in the page's `Server-Timing` beside the render's own phases.
   */
  timings?: { name: string; dur: number }[];
  /**
   * A server provider read this response's data with the visitor's own cookies (`rsc.visitorCredentials`): it is kept
   * for nobody, the page nor its refresh — a later visit would show what a write since made untrue.
   */
  readAsVisitor?: boolean;
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
