import { gql } from '@apollo/client/core';

import type { DisplayMode, StyleVariableCategory } from '../../../../../../../types';

export type TSegmentStyleRemoveSelectorVariableSubscription = {
  contextId: string;
  displayMode: DisplayMode;
  selector: string;
  category: StyleVariableCategory;
  name: string;
};

const SegmentStyleRemoveSelectorVariableSubscription = gql`
  subscription ($environment: String!) {
    SegmentStyleRemoveSelectorVariable(environment: $environment) {
      contextId
      displayMode
      selector
      category
      name
    }
  }
`;

export default SegmentStyleRemoveSelectorVariableSubscription;
