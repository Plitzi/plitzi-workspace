import { gql } from '@apollo/client/core';

import type { SchemaVariable } from '@plitzi/sdk-shared';

export type TSegmentSpaceRemoveVariableSubscription = {
  contextId: string;
  variable: SchemaVariable;
};

const SegmentSpaceRemoveVariableSubscription = gql`
  subscription ($environment: String!) {
    SegmentSpaceRemoveVariable(environment: $environment) {
      contextId
      variable {
        name
      }
    }
  }
`;

export default SegmentSpaceRemoveVariableSubscription;
