import { gql } from '@apollo/client/core';

import type { DisplayMode, StyleVariableCategory, StyleVariableValue } from '@plitzi/sdk-shared';

export type TSegmentStyleAddSelectorVariableSubscription = {
  displayMode: DisplayMode;
  selector: string;
  contextId: string;
  category: StyleVariableCategory;
  name: string;
  value: StyleVariableValue;
};

const SegmentStyleAddSelectorVariableSubscription = gql`
  subscription ($environment: String!) {
    SegmentStyleAddSelectorVariable(environment: $environment) {
      contextId
      displayMode
      selector
      category
      name
      value
    }
  }
`;

export default SegmentStyleAddSelectorVariableSubscription;
