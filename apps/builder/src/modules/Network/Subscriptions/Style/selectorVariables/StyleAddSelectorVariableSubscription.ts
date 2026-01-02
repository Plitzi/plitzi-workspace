import { gql } from '@apollo/client/core';

import type { DisplayMode, StyleVariableCategory, StyleVariableValue } from '@plitzi/sdk-shared';

export type TStyleAddSelectorVariableSubscription = {
  displayMode: DisplayMode;
  selector: string;
  category: StyleVariableCategory;
  name: string;
  value: StyleVariableValue;
};

const StyleAddSelectorVariableSubscription = gql`
  subscription ($environment: String!) {
    StyleAddSelectorVariable(environment: $environment) {
      displayMode
      selector
      category
      name
      value
    }
  }
`;

export default StyleAddSelectorVariableSubscription;
