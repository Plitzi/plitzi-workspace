/**
 * What a space's plan includes, as a server tells the builder, the console and the CLI: each
 * capability by name, included or not, and — when not — the plan that includes it and where to get it. The names are
 * the deployment's; a surface locks the ones it knows and shows the rest as they are.
 *
 * A server that answers none — a self-hosted deployment, a development server — means everything is included, so no
 * surface carries plan logic of its own: {@link isIncluded} answers "yes" for a contract that is absent.
 */
export type TCapability = {
  included: boolean;
  /** The capability in the words a refusal says it with: "A custom domain". */
  label: string;
  /** The cheapest plan that includes it, when this one does not: "Site". */
  requires?: string;
  /** Where to get it, when this plan does not include it. */
  upgradeUrl?: string;
};

/** The cheapest plan above this one that allows more of a count, what it allows (`null`, no limit) and where to get it. */
export type TMoreOf = { requires: string; allows: number | null; upgradeUrl: string };

export type TSpaceEntitlements = {
  /** The plan as a person reads it: "Free", "App+". */
  tierLabel: string;
  /** Unpublished snapshots kept; a revision a domain serves is kept whatever its age. */
  snapshotsKept: number;
  /** Days of the space's analytics read back; 0 reads all the server keeps. */
  analyticsDays: number;
  /** Journeys (e2e tests) the space may keep; `null` has no limit. Played on the builder's canvas without one. */
  journeysPerSpace: number | null;
  /** Journeys played on the server a month (UTC), "Run on the server"; `null` has no limit. A publish's are not counted. */
  serverRunsPerMonth: number | null;
  /** The plan that keeps more journeys, when this one has a limit and one above keeps more. */
  moreJourneys?: TMoreOf;
  /** The plan that plays more journeys on the server, when this one has a limit and one above plays more. */
  moreServerRuns?: TMoreOf;
  capabilities: Record<string, TCapability>;
};

/**
 * What a workspace's plan includes: its seats and how many are taken, its ceilings, and each capability
 * — teams, custom roles, SSO, the audit log — as {@link TCapability}. A count of 0 is not enforced.
 */
export type TWorkspaceEntitlements = {
  /** The plan as a person reads it: "Free", "Team". */
  planName: string;
  /**
   * The seats the plan includes (0: unlimited), those bought beyond them, and those taken — members and pending
   * invitations. `purchasable`: the plan sells more.
   */
  seats: { included: number; extra: number; taken: number; purchasable: boolean };
  maxTeams: number;
  /** Days of a space's change history kept; 0 keeps it for the life of the space. */
  historyDays: number;
  /** Days of a space's analytics read back on this plan alone; 0 reads all the server keeps. */
  analyticsDays: number;
  /** The hosted MCP's tool calls a day. */
  mcpCallsPerDay: number;
  capabilities: Record<string, TCapability>;
};

/** A plan refusal, as a REST route answers one (HTTP 402) and a GraphQL error carries it in `extensions`. */
export type TPlanRefusal = {
  error: string;
  code: 'plan-required';
  capability: string;
  requires: string;
  upgradeUrl: string;
};

/** Whether the plan includes `capability` — everything does when the server answered no entitlements. */
export const isIncluded = (
  entitlements: TSpaceEntitlements | TWorkspaceEntitlements | undefined,
  capability: string
): boolean => entitlements?.capabilities[capability]?.included ?? true;

/** Whether an answer is a plan refusal — what the CLI and the builder print as its error and its link. */
export const isPlanRefusal = (value: unknown): value is TPlanRefusal =>
  typeof value === 'object' &&
  value !== null &&
  'code' in value &&
  value.code === 'plan-required' &&
  'upgradeUrl' in value &&
  typeof value.upgradeUrl === 'string';

/**
 * What the caller may do on a space: the role it holds there — the strongest of its grants — and the space
 * permissions that role allows (`spaceView`, `spaceContent`, `spaceUpdate`, `spaceCode`, `spacePublish`, `spaceManage`,
 * `spaceDelete`). The builder offers what these allow and nothing the server would refuse; the server's gates are what
 * make it true.
 */
export type TSpaceAccess = {
  /** What a grant names: `spaceDesigner`, `admin`, a workspace's own. */
  role: string;
  /** The role as a person reads it: "Can design". */
  label: string;
  permissions: string[];
};

/**
 * Whether the caller may do `permission` — everything, when the server answered no access: a self-hosted server or a
 * development one with no roles of its own puts no lock on the builder.
 */
export const mayDo = (access: TSpaceAccess | undefined, permission: string): boolean =>
  access === undefined || access.permissions.includes(permission);
