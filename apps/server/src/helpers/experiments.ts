import { requestAuthority } from '@plitzi/sdk-kernel/http';
import {
  assignExperiments,
  declaredExperiments,
  experimentsCookie,
  FORCED_EXPERIMENTS_PARAM,
  forcedExperimentsFor,
  forcedExperimentsOf,
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
  /**
   * Every A/B test's variant for this visitor — theirs, never a tester's: the page hydrates with them as the variants it
   * keeps, and shows what a tester forced over them (`forced`).
   */
  assignments: ExperimentAssignments;
  /**
   * The `Set-Cookie` that keeps the variants drawn for this visitor just now. Its page is theirs alone: never kept for
   * anybody else, who would be shown a variant they were never drawn.
   */
  setCookie?: string;
  /** The variants a tester forced that this space can show: shown over `assignments`, never kept as the visitor's. */
  forced?: ExperimentAssignments;
  /** The experiments drawn for this visitor just now — what the page reports to the space's analytics, once. */
  drawn?: string[];
};

/**
 * The variant of each of the space's A/B tests for this request — every one in the space, not this page's alone, so a
 * visitor who goes on to the next page in the browser finds theirs already kept: what their cookie holds, and a draw
 * for what it does not. Over them, what a tester forced (`plitzi_ab_qa`, `?ab=`) — read only where `debugAuthorized`,
 * shown and never kept as the visitor's.
 *
 * A render nobody visits — a preview for a picture, a draft's unsaved edits — draws nothing and keeps nothing: what
 * the visitor has not kept is shown as its first variant still shown (A, the control), the same in every picture.
 */
export const requestExperiments = (
  req: Pick<SSRRequest, 'headers' | 'protocol' | 'query'>,
  schema: SpaceTrees | undefined,
  { draws, debugAuthorized }: { draws: boolean; debugAuthorized: boolean }
): RequestExperiments => {
  const declared = schema ? experimentsOf(schema) : {};
  if (Object.keys(declared).length === 0) {
    return { assignments: {} };
  }

  const host = requestAuthority(req);
  const { assignments, kept, drawn } = assignExperiments(
    declared,
    keptExperiments(req.headers.cookie, host),
    // The start of the range: every experiment not kept shows its first variant still shown — A, unless taken out.
    draws ? Math.random : () => 0
  );
  const forced = debugAuthorized
    ? forcedExperimentsFor(declared, forcedExperimentsOf(req.headers.cookie, host, req.query[FORCED_EXPERIMENTS_PARAM]))
        .applied
    : {};
  const tested = Object.keys(forced).length > 0 ? { forced } : {};
  if (!draws || drawn.length === 0) {
    return { assignments, ...tested };
  }

  return {
    assignments,
    setCookie: experimentsCookie(host, kept, { secure: req.protocol === 'https' }),
    drawn,
    ...tested
  };
};
