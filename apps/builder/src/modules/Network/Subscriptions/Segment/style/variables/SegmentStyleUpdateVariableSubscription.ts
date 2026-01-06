import { gql } from '@apollo/client/core';

import type { StyleVariableCategory, StyleVariableValue } from '@plitzi/sdk-shared';

export type TSegmentStyleUpdateVariableSubscription = {
  contextId: string;
  category: StyleVariableCategory;
  name: string;
  value: StyleVariableValue;
};

const SegmentStyleUpdateVariableSubscription = gql`
  subscription ($environment: String!) {
    SegmentStyleUpdateVariable(environment: $environment) {
      contextId
      category
      name
      value
    }
  }
`;

export default SegmentStyleUpdateVariableSubscription;
