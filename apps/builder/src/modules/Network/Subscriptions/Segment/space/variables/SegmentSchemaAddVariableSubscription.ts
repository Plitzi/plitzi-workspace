import { gql } from '@apollo/client/core';

import type { SchemaVariable } from '@plitzi/sdk-shared';

export type TSegmentSchemaAddVariableSubscription = {
  contextId: string;
  variable: SchemaVariable;
};

const SegmentSchemaAddVariableSubscription = gql`
  subscription ($environment: String!) {
    SegmentSchemaAddVariable(environment: $environment) {
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

export default SegmentSchemaAddVariableSubscription;
