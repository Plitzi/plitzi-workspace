import { gql } from '@apollo/client/core';

import type { SchemaRaw } from '../../../../../types';

/** One change the fix made, keyed by the issue it settles. */
export type TSpaceFix = { code: string; elementId: string | null; message: string };

/** What was changed, and the schema as it is now stored — `flat` as a list, the shape the live channel carries. */
export type TSpaceFixIssuesMutation = { applied: TSpaceFix[]; schema: SchemaRaw };

const SpaceFixIssuesMutation = gql`
  mutation SpaceFixIssues($environment: String!) {
    SpaceFixIssues(environment: $environment) {
      applied {
        code
        elementId
        message
      }
      schema
    }
  }
`;

export default SpaceFixIssuesMutation;
