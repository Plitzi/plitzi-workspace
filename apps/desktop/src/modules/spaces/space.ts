export type Space = {
  id: number;
  name: string;
  permanentUrl: string;
  type?: string;
  category?: string;
  workspaceId?: number;
  workspaceName?: string;
  createdAt?: string;
};

/**
 * One row of `GET /spaces`, as Prisma answers it.
 *
 * Only the fields this app reads are described. The endpoint returns the whole record with its relations, and
 * typing all of it here would be a second copy of the schema that goes stale the first time a column is added.
 */
export type SpaceRow = {
  id: number;
  name: string;
  permanentUrl: string;
  type?: string | null;
  createdAt?: string | null;
  category?: { name?: string | null } | null;
  workspace?: { id: number; name: string } | null;
};

/**
 * The two lists the sidebar shows, in the endpoint's own words.
 *
 * The 2023 build split them by comparing `owner.id` to the signed-in user, which stopped being the question the
 * moment a space could be reached through a workspace role or a team. `GET /spaces?scope=` answers that question
 * itself — `owned` is the estate you administer, `guest` is what somebody shared with you — so the split is asked
 * for rather than computed from a field that no longer decides it.
 */
export type SpaceScope = 'owned' | 'guest';

export const toSpace = (row: SpaceRow): Space => ({
  id: row.id,
  name: row.name,
  permanentUrl: row.permanentUrl,
  type: row.type ?? undefined,
  category: row.category?.name ?? undefined,
  workspaceId: row.workspace?.id,
  workspaceName: row.workspace?.name,
  createdAt: row.createdAt ?? undefined
});

/** Alphabetical, and stable: two spaces with the same name are ordered by the id, which never ties. */
export const byName = (a: Space, b: Space): number => a.name.localeCompare(b.name) || a.id - b.id;
