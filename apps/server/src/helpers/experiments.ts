import { requestAuthority } from '@plitzi/sdk-kernel/http';
import {
  assignExperiments,
  declaredExperiments,
  experimentsCookie,
  keptExperiments
} from '@plitzi/sdk-shared/experiments';

import type { SSRRequest } from '@plitzi/sdk-kernel/types';
import type { Schema } from '@plitzi/sdk-shared';
import type { DeclaredExperiment, ExperimentAssignments } from '@plitzi/sdk-shared/experiments';

/** Read once per space as it was read: the object is shared by every render of a revision (the offline-data cache). */
const declaredOf = new WeakMap<SpaceTrees, Record<string, DeclaredExperiment>>();

/** What the experiments are read off: the pages' tree and the components'. */
type SpaceTrees = Pick<Schema, 'flat'> & Partial<Pick<Schema, 'components'>>;

const experimentsOf = (schema: SpaceTrees): Record<string, DeclaredExperiment> => {
  const known = declaredOf.get(schema);
  if (known) {
    return known;
  }

  const declared = declaredExperiments(schema);
  declaredOf.set(schema, declared);

  return declared;
};

export type RequestExperiments = {
  /** Every A/B test's variant for this visitor: what the page is drawn with and hydrates with. */
  assignments: ExperimentAssignments;
  /**
   * The `Set-Cookie` that keeps the variants drawn for this visitor just now. Its page is theirs alone: never kept for
   * anybody else, who would be shown a side they were never drawn.
   */
  setCookie?: string;
};

/**
 * The variant of each of the space's A/B tests for this request — every one in the space, not this page's alone, so a
 * visitor who goes on to the next page in the browser finds theirs already kept: what their cookie holds, and a draw
 * for what it does not.
 *
 * A render nobody visits — a preview for a picture, a draft's unsaved edits — draws nothing and keeps nothing: what
 * the visitor has not kept is shown as A, the control, the same in every picture.
 */
export const requestExperiments = (
  req: Pick<SSRRequest, 'headers' | 'protocol'>,
  schema: SpaceTrees | undefined,
  draws: boolean
): RequestExperiments => {
  const declared = schema ? experimentsOf(schema) : {};
  if (Object.keys(declared).length === 0) {
    return { assignments: {} };
  }

  const host = requestAuthority(req);
  const { assignments, kept, drawn } = assignExperiments(
    declared,
    keptExperiments(req.headers.cookie, host),
    // Never below a split: every experiment not kept is A.
    draws ? Math.random : () => 1
  );
  if (!draws || drawn.length === 0) {
    return { assignments };
  }

  return { assignments, setCookie: experimentsCookie(host, kept, { secure: req.protocol === 'https' }) };
};
