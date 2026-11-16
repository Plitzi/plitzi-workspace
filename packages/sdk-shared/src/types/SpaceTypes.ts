import type { ActionDocument } from './ActionTypes';
import type { Environment } from './CommonTypes';
import type { ConnectorManifestDraft } from './ConnectorTypes';

export type SpaceCredentialProvider =
  's3' | 'r2' | 'ssr' | 'custom' | 'smtp' | 'github' | 'cloudflare' | 'netlify' | 'vercel' | 'ftp';

/**
 * A connector manifest as the builder sees it.
 *
 * The manifest is server-side state — it names endpoints and an auth scheme — so this shape exists for the editor
 * and for the API that maintains it, never for a published page. What reaches a visitor is the connector's
 * identifier and nothing else.
 */
export type SpaceConnector = {
  id: number;
  identifier: string;
  name: string;
  manifest: ConnectorManifestDraft;
  createdAt: number;
  updatedAt: number;
};

/**
 * A server action as the builder sees it.
 *
 * The document is server-side state — it names credentials, connectors and steps — so this shape exists for the
 * editor and the API that maintains it, never for a published page. What reaches a visitor is the action's
 * identifier and its input/output fields, derived server-side.
 */
export type SpaceAction = {
  id: number;
  identifier: string;
  name: string;
  document: ActionDocument;
  createdAt: number;
  updatedAt: number;
};

export type SpaceCredential = {
  identifier: string;
  name: string;
  provider: SpaceCredentialProvider;
  inUse: boolean;
  usedIn: {
    usedFrom: string;
    name: string;
  }[];
  createdAt: number;
  updatedAt: number;
};

/**
 * A person given one of the space's visitor roles (`settings.visitorRoles`), by email. `claimed` says whether an
 * account has taken it yet: a role given to an address waits for somebody to sign in with it, verified.
 */
export type SpaceVisitor = {
  id: number;
  email: string;
  role: string;
  claimed: boolean;
  createdAt: number;
  updatedAt: number;
};

/** One environment's runtime — the space's own server code run beside the platform — and how it last was. */
export type SpaceRuntimeEnvironment = {
  environment: string;
  /** 0 for the draft. */
  revision: number;
  /** The packed code it runs, by what its bytes are. */
  digest: string;
  status: 'waiting' | 'starting' | 'ready' | 'failed' | 'stopping' | 'stopped';
  /** Why it is not running, for whoever manages the space. */
  error: string | null;
  /** Why it is kept stopped: `idle` (unused for too long) or `manual`. */
  stoppedReason: 'idle' | 'manual' | null;
  /** When a running one stops for being unused, unless something uses it before — unix seconds. */
  idleStopsAt: number | null;
  /** The paths of the space it answers itself (`/mcp`). */
  endpoints: string[];
  /** Its tasks, as flows name them (`board.create`). */
  tasks: string[];
  startedAt: number | null;
  /** The size it runs at — or will start at — by name (`SpaceRuntimeSizeOption['name']`). */
  size: string;
};

/** A size a runtime may run at: what its pod may spend, how many of it the space bought, and its price a month. */
export type SpaceRuntimeSizeOption = {
  name: string;
  label: string;
  /** As Kubernetes reads it: `250m` is a quarter of a core. */
  cpu: string;
  /** As Kubernetes reads it: `256Mi`. */
  memory: string;
  /** How many of it the space bought, each running one environment; `null` where it is not bounded. */
  bought: number | null;
  /** Its price a month, in euro cents, VAT included. */
  displayAmount: number;
};

/** A space's runtime: every environment's, and the names of the variables it starts with — never their values. */
export type SpaceRuntime = {
  environments: SpaceRuntimeEnvironment[];
  variables: string[];
  /** Every size there is, smallest first. */
  sizes: SpaceRuntimeSizeOption[];
  /** How long a runtime may go unused before it is stopped; 0 when the platform never stops one. */
  idleMinutes: number;
};

export type SpaceDeployment = {
  id: number;
  environment: Environment;
  revision: number | null;
  domain: string;
  isVerified: boolean;
  default: boolean;
  /** What serves it: Plitzi's page servers (`ssr`), or the provider holding a copy of the site (RFC 0034 §6). */
  provider: 'ssr' | DeployProviderId;
  /** How it serves the space (RFC 0034 §5). */
  mode: DeployMode;
  credential: SpaceCredential | null;
  /** The deploy a publish or rollback queued, on a target holding a copy of the site. */
  deployId?: number | null;
  createdAt: number;
  updatedAt: number;
};

/** How a domain serves its space (RFC 0034 §5): Plitzi's page servers, an SPA, every page prerendered, or a server of
 *  the owner's own. */
export type DeployMode = 'ssr' | 'spa' | 'static' | 'selfHosted';

/** The providers a copy of the site may be deployed to (RFC 0034 §6) — the server's `deploys/providers`. */
export type DeployProviderId =
  'github' | 's3' | 'amplify' | 'r2' | 'cloudflarePages' | 'netlify' | 'vercel' | 'ftp' | 'download' | 'selfHosted';

export type DeployStatus = 'queued' | 'building' | 'uploading' | 'succeeded' | 'failed' | 'canceled';

/** One deploy as a list says it. */
export type SpaceDeploySummary = {
  id: number;
  domain: string;
  kind: 'deploy' | 'redeploy' | 'rollback';
  status: DeployStatus;
  environment: Environment;
  revision: number;
  mode: DeployMode;
  provider: DeployProviderId;
  error: string | null;
  url: string | null;
  reference: string | null;
  files: number | null;
  bytes: number | null;
  /** Kept: downloadable, and shipped again by a rollback without rebuilding. */
  kept: boolean;
  by: { id: number; username: string } | null;
  /** UTC seconds. */
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
};

/** The SDK, React and `@plitzi/sdk-server` a build runs (RFC 0034 §5.2). */
export type DeployVersions = { sdk: string; react: string; sdkServer: string };

/** One deploy with what it said as it ran. */
export type SpaceDeployDetail = SpaceDeploySummary & {
  log: { at: number; level: 'info' | 'warn' | 'error'; line: string }[];
  versions: DeployVersions | null;
};

/** A setting of a provider, or of every target holding a copy (`targetFields`). */
export type DeployProviderField = { key: string; label: string; required: boolean; hint?: string; example?: string };

/** A provider as the console and the builder offer it. */
export type DeployProviderInfo = {
  id: DeployProviderId;
  label: string;
  description: string;
  modes: DeployMode[];
  signIn:
    | { kind: 'credential'; credential: string; fields: string[] }
    | { kind: 'bucket'; cdn: 's3' | 'r2' }
    | { kind: 'none' };
  atomic: boolean;
  fields: DeployProviderField[];
};

/** One domain of a space as a target (RFC 0034 §11.3): how it serves the space and where it stands. */
export type SpaceTarget = {
  id: number;
  domain: string;
  verified: boolean;
  /** Plitzi's own address for the space (`<space>.plitzi.app`): always served by its page servers. */
  plitziOwned: boolean;
  mode: DeployMode;
  provider: 'ssr' | DeployProviderId;
  providerLabel: string;
  atomic: boolean;
  environment: Environment;
  /** Pinned; none follows its environment's latest. */
  revision: number | null;
  /** What it serves, and what rolling it back would put back. */
  serves: SpaceServedVersion | null;
  rollback: SpaceServedVersion | null;
  /** Its provider's settings and every target's (`basePath`, `staticPaths`), as kept. */
  config: Record<string, unknown> | null;
  credential: { identifier: string; name: string } | null;
  bucket: { identifier: string; name: string; cdn: { identifier: string; name: string } } | null;
  protected: boolean;
  hook: boolean;
  lastDeploy: SpaceDeploySummary | null;
  running: SpaceDeploySummary | null;
  /** Newer versions than it runs, said (RFC 0034 §5.2). */
  update: { words: string; runs: DeployVersions; newest: DeployVersions } | null;
  /** Its plan no longer includes its kind of deploy. */
  locked: { error: string; requires: string; upgradeUrl: string } | null;
  /** A server of the owner's own past the oldest version Plitzi answers: rebuilt before it is served again. */
  required: string | null;
};

export type SpaceTargets = {
  targets: SpaceTarget[];
  providers: DeployProviderInfo[];
  targetFields: (DeployProviderField & { modes: DeployMode[] })[];
  limits: { deployTargets: number; keptArtifacts: number; deployMinutesPerMonth: number | null };
  deployMinutes: { used: number; limit: number | null };
};

/** A publish set for later (RFC 0034 §8): published when due, as whoever set it — or why it was not. */
export type SpaceScheduledPublish = {
  id: number;
  domain: string;
  environment: Environment;
  revision: number;
  /** UTC seconds. */
  at: number;
  status: 'pending' | 'published' | 'failed' | 'canceled';
  error: string | null;
  by: { id: number; username: string } | null;
};

/** What publishing a revision on a domain would do, before it does (RFC 0034 §11.3). */
export type SpacePublishCheck = {
  domain: string;
  mode: DeployMode;
  revision: number;
  deploy: { needed: boolean; reasons: string[] };
  /** What of the revision runs on a server: on Plitzi for an SPA, impossible for a prerendered site. */
  serverFeatures: string[];
  locked: { error: string; requires: string; upgradeUrl: string } | null;
};

/**
 * What one version of a space is made of: the draft (`main`) a snapshot would freeze, or a snapshot as it was frozen.
 * Counts and names, never contents — what the builder shows before a snapshot is made, and what `plitzi create --from`
 * says it is taking out.
 */
export type SpaceVersionContents = {
  environment: Environment;
  /** 0 for the draft. */
  revision: number;
  /** A snapshot's own words and moment; none for the draft. */
  snapshot: { description: string; publishedAt: string } | null;
  pages: number;
  layouts: number;
  /** The space's components, each its own tree — frozen with the version like the pages. */
  components: number;
  elements: number;
  /** Every plugin installed, and whether the source it was built from is kept with this version. */
  plugins: { type: string; source: boolean }[];
  actions: number;
  connectors: number;
  /** What the space's functions declare, or none when it has none. */
  functions: { tasks: number; routes: number } | null;
  /** Its runtime, and whether the source it was packed from is kept with this version — none when it has none. */
  runtime: { source: boolean } | null;
};

/** One snapshot as the publish sheet lists it: its words, its moment, who made it and the domains serving it now. */
export type SpaceSnapshot = {
  environment: Environment;
  revision: number;
  description: string;
  /** ISO 8601, UTC. */
  publishedAt: string;
  /** None for a snapshot made before its author was kept. */
  by: { id: number; username: string } | null;
  domains: string[];
  /** Where a member looks at it before any domain serves it: its own address, never for search. */
  previewUrl: string;
};

/** A version as a domain serves it: an environment and a revision of it, 0 for the draft. */
export type SpaceServedVersion = { environment: Environment; revision: number };

/** One move of a domain (RFC 0034): what it serves from then on, what it served before, who and why. */
export type SpaceRelease = {
  id: number;
  domain: string;
  environment: Environment;
  revision: number;
  followsLatest: boolean;
  previous: SpaceServedVersion | null;
  kind: 'publish' | 'rollback';
  /** The deploy that shipped it, on a target holding a copy of the site. */
  deployId: number | null;
  by: { id: number; username: string } | null;
  /** Unix seconds. */
  at: number;
};

/** A domain's releases, newest first, and what rolling it back would serve — none when there is nothing before. */
export type SpaceReleases = { releases: SpaceRelease[]; rollback: SpaceServedVersion | null };

/** A space's domain as its releases read it: what it serves now, and what a rollback would put back. */
export type SpaceDomainRelease = {
  domain: string;
  verified: boolean;
  serves: SpaceServedVersion | null;
  followsLatest: boolean;
  rollback: SpaceServedVersion | null;
};

/** How a publish or a rollback went: the release it recorded, or the platform's refusal in its own words. */
export type SpaceReleaseOutcome =
  { done: true; release: SpaceRelease } | { done: false; reason: string; code?: string };

/**
 * What changes going from one version of a space to another — the draft against a snapshot (what a snapshot would
 * freeze), a snapshot against what a domain serves (what a publish would change): pages by name, the rest counted.
 */
export type SpaceVersionChanges = {
  pages: { added: string[]; removed: string[]; changed: string[] };
  layouts: number;
  components: number;
  styles: boolean;
  fonts: boolean;
  settings: boolean;
  plugins: { added: string[]; removed: string[]; changed: string[] };
  actions: number;
  connectors: number;
  functions: boolean;
  runtime: boolean;
  /** How many of these differ: 0 is the same version twice. */
  total: number;
};
