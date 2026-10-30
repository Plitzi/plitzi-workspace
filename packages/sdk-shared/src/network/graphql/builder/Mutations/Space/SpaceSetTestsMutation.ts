import { SPACE_TESTS_FIELDS } from '../../Queries/Space/SpaceTestsQuery';

import type { TSpaceTests } from '../../Queries/Space/SpaceTestsQuery';

/** The space's tests saved whole; answers how they stand now, as `SpaceTests` does. */
export type TSpaceSetTestsMutation = TSpaceTests;

const SpaceSetTestsMutation = /* GraphQL */ `
  mutation SpaceSetTestsMutation($environment: String!, $tests: JsonObject!) {
    SpaceSetTests(environment: $environment, tests: $tests) {
      ${SPACE_TESTS_FIELDS}
    }
  }
`;

export default SpaceSetTestsMutation;
