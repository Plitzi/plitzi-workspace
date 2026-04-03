import { gql } from '@apollo/client/core';

import type { StyleVariableCategory, StyleVariableValue } from '../../../../../../../types';

export type TSegmentStyleAddVariableSubscription = {
  contextId: string;
  category: StyleVariableCategory;
  name: string;
  value: StyleVariableValue;
};

const SegmentStyleAddVariableSubscription = gql`
  subscription ($environment: String!) {
    SegmentStyleAddVariable(environment: $environment) {
      contextId
      category
      name
      value
    }
  }
`;

export default SegmentStyleAddVariableSubscription;
