import { gql } from '@apollo/client/core';

import type { SchemaVariable } from '../../../../../../../types';

export type TSegmentSpaceUpdateVariableSubscription = {
  contextId: string;
  variable: SchemaVariable;
};

const SegmentSpaceUpdateVariableSubscription = gql`
  subscription ($environment: String!) {
    SegmentSpaceUpdateVariable(environment: $environment) {
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

export default SegmentSpaceUpdateVariableSubscription;
