import { gql } from '@apollo/client/core';

import type { StyleVariableCategory } from '../../../../../../../types';

export type TSegmentStyleRemoveVariableSubscription = {
  contextId: string;
  category: StyleVariableCategory;
  name: string;
};

const SegmentStyleRemoveVariableSubscription = gql`
  subscription ($environment: String!) {
    SegmentStyleRemoveVariable(environment: $environment) {
      contextId
      category
      name
    }
  }
`;

export default SegmentStyleRemoveVariableSubscription;
