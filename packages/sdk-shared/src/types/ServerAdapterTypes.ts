import type { Environment } from './CommonTypes';

export type SSRRscData = {
  /** Per-element server data keyed by schema element ID. Each element reads its own slice via its id prop. */
  serverData?: Record<string, unknown>;
};

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
