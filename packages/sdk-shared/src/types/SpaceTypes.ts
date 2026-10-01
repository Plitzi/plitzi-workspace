import type { ActionDocument } from './ActionTypes';
import type { Environment } from './CommonTypes';
import type { ConnectorManifestDraft } from './ConnectorTypes';

export type SpaceCredentialProvider = 's3' | 'r2' | 'ssr' | 'custom' | 'smtp';

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

/** A size a runtime may run at: what its pod may spend, and whether the space's plan includes it. */
export type SpaceRuntimeSizeOption = {
  name: string;
  label: string;
  /** As Kubernetes reads it: `250m` is a quarter of a core. */
  cpu: string;
  /** As Kubernetes reads it: `256Mi`. */
  memory: string;
  included: boolean;
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
  credential: SpaceCredential | null;
  createdAt: number;
  updatedAt: number;
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
