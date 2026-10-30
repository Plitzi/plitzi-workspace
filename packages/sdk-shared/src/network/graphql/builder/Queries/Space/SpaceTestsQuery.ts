import type { SpaceTests } from '../../../../../types';

/** How one unit test went against the saved document. */
export type TSpaceUnitTestResult = { id: string; title: string; ok: boolean; misses: string[]; problem: string | null };

/**
 * The space's own tests (RFC 0031) and how they stand against the saved document — what a snapshot would meet:
 * `problems` refuse it, a failed unit test refuses it, and the e2e tests this server runs no browser for are named.
 */
export type TSpaceTests = {
  tests: SpaceTests;
  problems: string[];
  unitPassed: number;
  unitFailed: number;
  unit: TSpaceUnitTestResult[];
  e2eNotRun: string[];
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
`;

const SpaceTestsQuery = /* GraphQL */ `
  query SpaceTestsQuery($environment: String!) {
    SpaceTests(environment: $environment) {
      ${SPACE_TESTS_FIELDS}
    }
  }
`;

export default SpaceTestsQuery;
