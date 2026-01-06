import { gql } from '@apollo/client/core';

import type { SchemaVariable } from '@plitzi/sdk-shared';

export type TSegmentSpaceAddVariableSubscription = {
  contextId: string;
  variable: SchemaVariable;
};

const SegmentSpaceAddVariableSubscription = gql`
  subscription ($environment: String!) {
    SegmentSpaceAddVariable(environment: $environment) {
      contextId
      variable {
        name
        category
        type
        value
        subValues {
          when
          value
        }
      }
    }
  }
`;

export default SegmentSpaceAddVariableSubscription;
