import { gql } from '@apollo/client/core';

import type { SchemaVariable } from '@plitzi/sdk-shared';

export type TSegmentSchemaUpdateVariableSubscription = {
  contextId: string;
  variable: SchemaVariable;
};

const SegmentSchemaUpdateVariableSubscription = gql`
  subscription ($environment: String!) {
    SegmentSchemaUpdateVariable(environment: $environment) {
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

export default SegmentSchemaUpdateVariableSubscription;
