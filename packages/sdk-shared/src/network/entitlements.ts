/**
 * What a space's plan includes, as a server tells the builder, the console and the CLI (RFC 0029 §7.4): each
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

export type TSpaceEntitlements = {
  /** The plan as a person reads it: "Free", "App+". */
  tierLabel: string;
  /** Unpublished snapshots kept; a revision a domain serves is kept whatever its age. */
  snapshotsKept: number;
  /** Days of the space's analytics read back; 0 reads all the server keeps. */
  analyticsDays: number;
  capabilities: Record<string, TCapability>;
};

/**
 * What a workspace's plan includes (RFC 0029 §4.1): its seats and how many are taken, its ceilings, and each capability
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
