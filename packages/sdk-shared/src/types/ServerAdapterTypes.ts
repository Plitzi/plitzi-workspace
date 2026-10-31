import type { ActionEntry, ActionRunReport, ActionTaskDescriptor } from './ActionTypes';
import type { SessionScope } from './AuthTypes';
import type { Environment } from './CommonTypes';
import type { ConnectorEntry } from './ConnectorTypes';
import type { DataDraft, DataSaveResult } from './DataTypes';
import type { FunctionsDraft, FunctionsSaveResult } from './FunctionTypes';
import type { Schema } from './SchemaTypes';
import type { AnalyticsConfig, OfflineDataRaw } from './SdkTypes';
import type {
  PluginSource,
  SSRChangePage,
  SSRChangeQuery,
  SSRCredential,
  SSRGrant,
  SSRRequest,
  SSRSession,
  SSRTemplateProps,
  SSRUser,
  SSRWriteContext
} from './ServerTypes';
import type { Style } from './StyleTypes';
import type { ActivityReader, SpaceActivityPage, SpaceActivityQuery } from '../activity/types';
import type { FlagOverrides } from '../flags/resolveFlags';
import type { TSpaceEntitlements } from '../network/entitlements';

export type SSRSpaceDeployment = {
  /** Who may put this space in an iframe, as CSP `frame-ancestors` sources (e.g. `'self'`, `https://acme.com`,
   *  or `*`). Resolved per space by the consumer, because only it knows the domains that space declares — a
   *  published space must not be framable from a site its owner never allowed. Omitted → the server's own
   *  `frameOptions` default stands. */
  frameAncestors?: string[];
  environment?: Environment;
  credential?: SSRCredential;
  spaceId?: number | null;
  revision?: number;
  /**
   * What this space's feature flags are at, for a deployment that keeps them apart from its revisions — a hash that
   * changes exactly when they do. Part of every cache key a render is kept under (the page, its server data, the space
   * read for it), so a flag turned in production reaches the next request while the revision stays the same. Absent,
   * the flags change only with the revision, and the revision alone keys the caches.
   */
  flagsVersion?: string;
  /**
   * This render is an author looking at their own work — the builder's preview — rather than a visitor being
   * served. Metering skips it: nobody should be billed for editing.
   *
   * It is a property of HOW the request resolved, not of the environment it renders. Those two look the same
   * from the render's side and are not: a space's free preview sub-domain serves the live editing environment
   * to the public, so "which environment" cannot tell an author apart from a visitor. Only the resolver knows,
   * which is why it says so here.
   */
  authoring?: boolean;
  templateProps?: SSRTemplateProps;
  pluginNames?: string[];
  pluginSources?: Record<string, PluginSource>;
  error?: {
    code: number;
    message: string;
  };
};

export type SSRRscData = {
  /** Per-element server data keyed by schema element ID. Each element reads its own slice via its id prop. */
  serverData?: Record<string, unknown>;
};

/** Semantic + machine-readable metadata for one element type, so the MCP can tell an agent what the type DOES
 *  (not just that it exists) AND validate against it. `category` groups it (e.g. provider, structure, media);
 *  `custom` marks a plugin-provided type. The MCP keys strict-vs-lenient validation off `custom`: a `custom:false`
 *  (default sdk-elements) type is authoritative — an unknown attribute/setState key on it is an error — while a
 *  `custom:true` (plugin) type is best-effort (warnings only), since its metadata is a manifest snapshot. */
export type ComponentCatalogEntry = {
  label?: string;
  description?: string;
  category?: string;
  custom?: boolean;
  /** The type's attribute/prop keys — the authoritative set for a default type (setState `key` when
   *  category="attribute", and type-prop validation). Absent when unknown (e.g. a plugin with no manifest). */
  attributes?: string[];
  /** The type's `definition.styleSelectors` keys (slots) — setState `key` when category="state" is
   *  `visibility` or `styleSelectors.<selector>`. */
  styleSelectors?: string[];
  /** The type's intrinsic base default CSS (its `defaultStyle.style.base.default`) — the declarations the element
   *  renders with before any class is attached, e.g. `text` defaults to `{ display: 'inline' }`. The MCP surfaces
   *  it so an agent styles against the real starting point instead of assuming `display: block`. */
  defaultStyle?: Record<string, string>;
  /** Binding targets the type exposes, from the plugin manifest's `defaultStyle.bindingsAllowed`. */
  bindingsAllowed?: { attributes?: string[]; initialState?: string[] };
  /** The attributes a role that edits the content and not the design may change: its words, a link, a
   *  picture. Absent, none — an element of the type is the design's alone. */
  contentAttributes?: string[];
};

/** Element type → its semantic metadata, keyed by the `type` string used in the schema. Covers BOTH the default
 *  sdk-elements types (custom:false, authoritative) and the plugin (custom:true) element types installed on a
 *  space, so the MCP can validate types/attributes dynamically per space instead of against a hand-mirror. */
export type ComponentCatalog = Record<string, ComponentCatalogEntry>;

export type SSRAdapters = {
  /** The space's render payload. Optional HERE and required by a page server (see {@link SSRPageAdapters}): a
   *  dedicated MCP server renders nothing, reads schema and style through its own adapters, and had to hand this
   *  one over anyway for the type to be satisfied — an adapter it never called. */
  getOfflineData?: (spaceId: number, environment: string, revision?: number) => Promise<OfflineDataRaw | undefined>;
  /**
   * Which space, environment and revision a request resolves to. Optional here for the same reason as
   * `getOfflineData`: MCP resolves its space from the request token (`getGrant`), never from the host.
   *
   * Asked on EVERY request, not only a page's: what the page fetches after it — `/_plitzi/space/<hash>.json`, `/_action`,
   * `/fn/…`, `/_realtime` — is resolved again, and carries nothing of the page's address but its host (and the
   * visitor's credentials). So a space is chosen by the host — a domain, a sub-domain (`wildcardSubdomain`) — or by a
   * credential (`authoringPreview`): one chosen by the page's path or query is lost on the requests that follow it.
   */
  getSpaceDeployment?: (req: SSRRequest) => Promise<SSRSpaceDeployment>;
  /** Resolve the grant the MCP request operates under, from the verified `Authorization` bearer. The consumer
   *  owns the JWT secret and the authorization model, so it decides here; the MCP service stays stateless.
   *  Returns undefined when the token is missing or invalid. Required for the `mcp` service to serve any
   *  request. `canWrite` is what separates a read-only bearer from one that may change the space — the MCP
   *  refuses every write tool without it, and never infers the answer from the token itself. */
  getGrant?: (req: SSRRequest) => Promise<SSRGrant | undefined>;
  /**
   * Whether the tool calls a request carries may run — asked once per request that makes any, with how many it makes.
   * A refusal's `error` is what the agent reads as each call's result, so it says why and the way past it (a plan's
   * daily ceiling, say). Omitted, every call runs.
   */
  admitToolCalls?: (req: SSRRequest, calls: number) => Promise<{ error: string } | undefined>;
  /** Read the element schema for the MCP tools. Separate from `getOfflineData` (which is SSR/RSC shaped and
   *  strips `style.platform`); the MCP style resource needs the full documents, so schema and style split. */
  getSchema?: (spaceId: number, environment: Environment) => Promise<Schema | undefined>;
  /** Read the full style document (with `platform`/`mode`, which the MCP definitions resource requires). */
  getStyle?: (spaceId: number, environment: Environment) => Promise<Style | undefined>;
  /** Read the semantic catalog of the space's PLUGIN (custom) element types — label/description/category from
   *  each installed plugin's manifest — so the MCP `plitzi://types` resource can explain what custom elements do.
   *  The MCP already knows the built-in types. When omitted, custom types surface with their observed label only. */
  getComponentCatalog?: (spaceId: number, environment: Environment) => Promise<ComponentCatalog | undefined>;
  /** Read every connector configured for the space, so the MCP can list them and author provider elements against
   *  them. Connectors are space-level (not per environment) server-side state: the manifests name endpoints and an
   *  auth scheme, so this must never feed a browser payload. When omitted, the MCP's connector resource is empty
   *  and a provider element cannot be checked against the connector it names. */
  getConnectors?: (spaceId: number) => Promise<ConnectorEntry[] | undefined>;
  /** Create or replace one connector, keyed by `entry.id`. When omitted, connector ops apply in memory only and
   *  `apply` reports `persisted: false`. */
  saveConnector?: (spaceId: number, entry: ConnectorEntry) => Promise<void>;
  /** Remove one connector by its identifier. Omitted alongside `saveConnector` for a read-only deployment. */
  deleteConnector?: (spaceId: number, connectorId: string) => Promise<void>;
  /** Read every server action configured for the space, so the MCP can list them and author flows against them.
   *  Space-level server-side state like connectors: the documents name credentials, connectors and steps, so this
   *  must never feed a browser payload. When omitted, the MCP's action resource is empty. */
  getActions?: (spaceId: number) => Promise<ActionEntry[] | undefined>;
  /** The server tasks a flow can be built from — what THIS deployment can run, which is the SDK's built-ins plus
   *  whatever tasks it registered. Shaped as `ActionTaskDescriptor` in `@plitzi/sdk-server/actions`. Without it an
   *  agent authoring an action is guessing at the step vocabulary. */
  getActionTasks?: (spaceId: number) => Promise<ActionTaskDescriptor[] | undefined>;
  /** What the space's plan includes (`TSpaceEntitlements`), for the primer to say before an agent plans work the space
   *  cannot ship. Omitted — a self-hosted deployment — everything is included and the primer says nothing of a plan. */
  getEntitlements?: (spaceId: number) => Promise<TSpaceEntitlements | undefined>;
  /** Create or replace one action, keyed by `entry.id`. When omitted, action ops apply in memory only and `apply`
   *  reports `persisted: false`. */
  saveAction?: (spaceId: number, entry: ActionEntry) => Promise<void>;
  /** Remove one action by its identifier. Omitted alongside `saveAction` for a read-only deployment. */
  deleteAction?: (spaceId: number, actionId: string) => Promise<void>;
  /** The space's own functions: the draft's source files, which copy of them it is and what they declare.
   *  Server-side code like the actions it serves — never a browser payload. When omitted, the MCP offers no functions
   *  resource and refuses the function ops. */
  getFunctions?: (spaceId: number) => Promise<FunctionsDraft | undefined>;
  /** Save the draft's functions, whole. The deployment builds and checks them and answers what is wrong where it is;
   *  `base` is the version the agent read, and a draft that moved on since is refused rather than overwritten. */
  saveFunctions?: (
    spaceId: number,
    files: Record<string, string>,
    base: string,
    write: SSRWriteContext
  ) => Promise<FunctionsSaveResult>;
  /** Run one task of the draft's functions in the sandbox for the person behind the agent — the builder's Try. */
  tryFunction?: (
    spaceId: number,
    task: string,
    params: Record<string, unknown>,
    write: SSRWriteContext
  ) => Promise<ActionRunReport>;
  /**
   * Play the space's e2e tests on its draft, in a browser of the deployment's — those named, or all: each
   * test's result, or why none was run there. When omitted, an agent's e2e tests are said as not run.
   */
  runE2eTests?: (spaceId: number, ids: readonly string[]) => Promise<{ results: unknown[] } | { notRun: string }>;
  /** The space's own data: the draft's JSON files its server providers read (`/data/<file>`), and which copy they are.
   *  When omitted, the MCP offers no data resource and refuses the data ops. */
  getData?: (spaceId: number) => Promise<DataDraft | undefined>;
  /** Save the draft's data, whole: every file JSON at a plain path. `base` is the version the agent read, and data that
   *  moved on since is refused rather than overwritten. */
  saveData?: (
    spaceId: number,
    files: Record<string, string>,
    base: string,
    write: SSRWriteContext
  ) => Promise<DataSaveResult>;
  /** Persist the element schema mutated by the MCP `apply` tool. When omitted, `apply` reports `persisted: false`. */
  saveSchema?: (spaceId: number, environment: Environment, schema: Schema, write: SSRWriteContext) => Promise<void>;
  /** Persist the style document mutated by the MCP `apply` tool — store it as given. `style.cache` arrives already
   *  compiled: the renderer serves that string and nothing else, so recomputing it is not a detail to delegate, and
   *  asking every deployment to remember it was one bug each of them could write alone. When omitted, `apply`
   *  reports `persisted: false`. */
  saveStyle?: (spaceId: number, environment: Environment, style: Style, write: SSRWriteContext) => Promise<void>;
  /** The space's change history, read-only: what every writer saved, and for whom. When omitted, the MCP offers no
   *  history resource. */
  getChanges?: (spaceId: number, environment: Environment, query: SSRChangeQuery) => Promise<SSRChangePage>;
  /** What happened on the space after a cursor — the draft changed, a version went out, an action failed — waiting up
   *  to `query.wait` seconds when nothing has yet. `reader` is who asks, so their own writes can be left out; `signal`
   *  ends the wait when the client goes. When omitted, the MCP offers no `plitzi_activity`. */
  getActivity?: (
    spaceId: number,
    query: SpaceActivityQuery,
    reader: ActivityReader,
    signal?: AbortSignal
  ) => Promise<SpaceActivityPage>;
  /** Who this request carries, if anyone. The adapter reads the credential and resolves it; the cookie it arrived
   *  in was written by the server, from {@link SSRAuthCookie}. */
  getUser?: (req: SSRRequest) => Promise<SSRUser | undefined>;
  /**
   * Verify credentials and mint a session — identity, and nothing else. The server writes the cookies, clears them,
   * and keeps the readable hint in step, because those are properties of how sessions travel rather than of who
   * anyone is. A deployment bringing its own user database implements this and gets the rest for free.
   *
   * Return undefined to refuse. Never throw for a wrong password.
   */
  authenticate?: (credentials: Record<string, string>, req: SSRRequest) => Promise<SSRSession | undefined>;
  /** Revoke whatever session this request carries, at the source. The cookies are the server's to clear. */
  endSession?: (req: SSRRequest) => Promise<void>;
  /**
   * Sign the person this request carries out on every device: `site`, of the sessions signed in on this request's host
   * (a space's own — its visitors' sign-out everywhere); `all`, of every session of the account. Answers whether one was
   * carried: nobody signed in has nothing to end. The cookies are the server's to clear.
   */
  endSessions?: (req: SSRRequest, scope: SessionScope) => Promise<boolean>;
  /**
   * Turn a credential the browser obtained from an identity provider into a session here — see the exchange stage.
   * Everything that decides whether it is any good lives in this adapter, because only the deployment knows:
   *
   * - which providers it trusts, and which one the space in question actually signs people in with;
   * - that the token was minted for **this** application. Anyone who has signed into any other site with the same
   *   provider holds a valid token for that user, so accepting one merely because the provider recognises it lets
   *   that site sign in here as them. A provider that cannot prove it must be refused outright.
   */
  exchangeCredential?: (
    provider: string,
    token: string,
    req: SSRRequest
  ) => Promise<
    { ok: true; session: SSRSession; user?: SSRUser } | { ok: false; error: string; status?: number; reason?: string }
  >;
  /** Called by the RSC endpoint, and once per page render, to fetch server-side data for server components.
   *  See {@link SSRRscContext} for what it is given. */
  getRscData?: (context: SSRRscContext) => Promise<SSRRscData>;
  /**
   * One billable server request. This is where a deployment meters usage, because these are the moments it
   * actually spends bandwidth on a visitor and the ones a visitor cannot reach around: the browser is told
   * what happened, never asked. Each runs before its cache is consulted, so a cached response still counts.
   *
   * What comes back shapes the response — degrade the free tier, hand the browser its reporting channel — and
   * a deployment that meters nothing simply omits the adapter. Never throw from here: a metering outage must
   * not take a site down, so failures should degrade to "served, uncounted".
   */
  meter?: (event: SSRMeterEvent) => Promise<SSRMeterDecision | undefined>;
};

/**
 * Which area of server work is being metered. One name per area, because that is the unit a deployment prices
 * — a full page render does not cost what a partial data refresh costs, and both are cheaper when a cache
 * answered them than when the origin did.
 */
export type MeteredKind =
  | 'page_view'
  | 'rsc_query'
  /** Reserved: nothing emits this yet. Server actions are not implemented — the area exists so wiring them
   *  later is a call site, not a schema change. */
  | 'server_action';

/** The request being metered, for {@link SSRAdapters.meter}. */
export interface SSRMeterEvent {
  kind: MeteredKind;
  /**
   * Whether a cache answered this instead of the origin. Reported rather than inferred: only the handler knows,
   * it is the same fact the response puts on the wire as `X-Cache: HIT`, and what it is worth is the
   * deployment's to decide — an area may price a hit lower, or not distinguish one at all.
   */
  cached: boolean;
  req: SSRRequest;
  spaceId: number;
  environment: Environment;
  revision: number;
}

/** What the deployment decided about this request. */
export type SSRMeterDecision = {
  /** This space is over the quota its plan allows and the render should say so — the "Made with Plitzi" badge
   *  on the free tier. Paid plans accrue overage instead and never set this. */
  degrade?: boolean;
  /** The deployment's "Made with Plitzi" badge on this render — its attribution, on a plan that does not remove it. */
  badge?: boolean;
  /**
   * This space has nearly spent its plan's allowance and the render should say so, calmly — before `degrade` would. The
   * deployment decides where: Plitzi says it on the shared domain, where the visitor is the one who might tell the owner.
   */
  quotaNear?: boolean;
  /**
   * This page is sent `X-Robots-Tag: noindex`: an address the deployment does not mean to host a site on — a free
   * sub-domain — kept out of search results, where an abused one would do the most harm.
   */
  noindex?: boolean;
  /**
   * The deployment does not serve this page right now, and these are the words its visitor reads instead: the page is
   * answered 503, never rendered, cached or indexed — an address the deployment holds back, as a free site whose
   * owner has not confirmed their email.
   */
  unavailable?: string;
  /** Client reporting channel, injected into the page bootstrap. Omitted → the page reports nothing. Only a
   *  page render has anywhere to put it; the other kinds answer data, not a document. */
  analytics?: AnalyticsConfig;
};

/** What a server that RENDERS PAGES must answer: the two adapters every page request goes through, on top of the
 *  optional rest. Stated as its own type rather than by making them required for everyone, because "required" is
 *  a property of the surface being served and not of the adapter set — a dedicated MCP server has no page request
 *  to resolve, and the old shape made it hand over two adapters nothing would ever call. */
export type SSRPageAdapters = SSRAdapters & Required<Pick<SSRAdapters, 'getOfflineData' | 'getSpaceDeployment'>>;

/**
 * Everything an RSC read is given: which space and revision, who is asking, and which elements want data.
 *
 * One object rather than six positional parameters, because the reason to add to it is exactly the reason the
 * positional form failed — `loadOfflineData` is a seventh thing to know, and nobody should have to count commas to
 * reach it, nor rewrite their adapter when an eighth arrives.
 */
export interface SSRRscContext {
  req: SSRRequest;
  spaceId: number;
  environment: Environment;
  revision: number;
  /** Whoever the request carries, already resolved. */
  user?: SSRUser;
  /** On a partial refresh, the only element ids that want data. Absent means every one — the initial render. */
  ids?: string[];
  /**
   * The space itself, read at most once per request however many times this is called.
   *
   * It is here because an adapter almost always needs the schema (to know which elements are server-rendered, or
   * whether RSC is on at all) and the server is already loading it for the page — in parallel with this very call.
   * Without a shared handle every deployment fetched it a second time, or wrote its own in-flight dedup to avoid
   * doing so. Awaiting this joins the read already under way; it never starts a second one.
   */
  loadOfflineData: () => Promise<OfflineDataRaw | undefined>;
  /**
   * What the layers above the space decide about its flags for this request: the server's own and, on a page allowed
   * to debug, a tester's. An element gated off by a flag is not resolved — `resolveRscData` resolves the flags
   * against the page it matched and skips it — so a feature that is off puts nothing in the payload.
   */
  flagOverrides?: FlagOverrides;
  /**
   * Aborted when whoever asked stops waiting — a browser that hung up, a refresh superseded by a newer one, a STOP — so
   * what it asked for stops being worked on, here and in the runs it started.
   */
  signal?: AbortSignal;
}

/**
 * Which published version of a space is asking.
 *
 * Absent means the live one — the document the builder edits. Present means a page PUBLISHED at that revision,
 * which must read the private documents it was published against: a page shipped yesterday running whatever the
 * action says today, or reading through a manifest since pointed at a different API, is the discrepancy
 * versioning exists to remove.
 *
 * One type for actions and connectors, because it is one concept: a version of a space.
 */
export type SpaceRevision = { environment: Environment; revision: number };
