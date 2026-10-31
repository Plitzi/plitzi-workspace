import type { SpaceTests } from '../../../../../types';

/** How one unit test went against the saved document. */
export type TSpaceUnitTestResult = { id: string; title: string; ok: boolean; misses: string[]; problem: string | null };

/**
 * Journeys played on the server this month (UTC), of the plan's allowance — `used` null when the count could not be
 * read, `limit` null with no limit — and the day it starts again.
 */
export type TSpaceServerPlays = { used: number | null; limit: number | null; resetsOn: string };

/** The fields of {@link TSpaceServerPlays}, for every answer that carries them. */
export const SPACE_SERVER_PLAYS_FIELDS = /* GraphQL */ `
  serverPlays {
    used
    limit
    resetsOn
  }
`;

/**
 * The space's own tests and how they stand against the saved document — what a snapshot would meet:
 * `problems` refuse it, a failed unit test refuses it, and the e2e tests this server runs no browser for are named.
 */
export type TSpaceTests = {
  tests: SpaceTests;
  problems: string[];
  unitPassed: number;
  unitFailed: number;
  unit: TSpaceUnitTestResult[];
  e2eNotRun: string[];
  /** Said by a server that counts them. */
  serverPlays?: TSpaceServerPlays;
};

export type TSpaceTestsQuery = { SpaceTests: TSpaceTests | null };

export const SPACE_TESTS_FIELDS = /* GraphQL */ `
  tests
  problems
  unitPassed
  unitFailed
  unit {
    id
    title
    ok
    misses
    problem
  }
  e2eNotRun
  ${SPACE_SERVER_PLAYS_FIELDS}
`;

const SpaceTestsQuery = /* GraphQL */ `
  query SpaceTestsQuery($environment: String!) {
    SpaceTests(environment: $environment) {
      ${SPACE_TESTS_FIELDS}
    }
  }
`;

export default SpaceTestsQuery;
