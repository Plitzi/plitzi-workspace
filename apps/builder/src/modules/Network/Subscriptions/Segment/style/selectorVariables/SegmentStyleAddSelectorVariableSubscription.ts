import { gql } from '@apollo/client/core';

import type { DisplayMode, StyleVariableCategory, StyleVariableValue } from '@plitzi/sdk-shared';

export type TSegmentStyleAddSelectorVariableSubscription = {
  contextId: string;
  displayMode: DisplayMode;
  selector: string;
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
