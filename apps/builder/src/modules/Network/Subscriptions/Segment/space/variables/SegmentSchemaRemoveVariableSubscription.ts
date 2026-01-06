import { gql } from '@apollo/client/core';

import type { SchemaVariable } from '@plitzi/sdk-shared';

export type TSegmentSchemaRemoveVariableSubscription = {
  contextId: string;
  variable: SchemaVariable;
};

const SegmentSchemaRemoveVariableSubscription = gql`
  subscription ($environment: String!) {
    SegmentSchemaRemoveVariable(environment: $environment) {
      contextId
      variable {
        name
      }
    }
  }
`;

export default SegmentSchemaRemoveVariableSubscription;
