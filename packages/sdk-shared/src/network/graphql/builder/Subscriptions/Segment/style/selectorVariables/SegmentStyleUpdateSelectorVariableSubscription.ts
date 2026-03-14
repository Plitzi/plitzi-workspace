import { gql } from '@apollo/client/core';

import type { DisplayMode, StyleVariableCategory, StyleVariableValue } from '../../../../../../../types';

export type TSegmentStyleUpdateSelectorVariableSubscription = {
  contextId: string;
  displayMode: DisplayMode;
  selector: string;
  category: StyleVariableCategory;
  name: string;
  value: StyleVariableValue;
};

const SegmentStyleUpdateSelectorVariableSubscription = gql`
  subscription ($environment: String!) {
    SegmentStyleUpdateSelectorVariable(environment: $environment) {
      contextId
      displayMode
      selector
      category
      name
      value
    }
  }
`;

export default SegmentStyleUpdateSelectorVariableSubscription;
