import { gql } from '@apollo/client/core';

import type { DisplayMode, StyleVariableCategory, StyleVariableValue } from '../../../../../../types';

export type TStyleUpdateSelectorVariableSubscription = {
  displayMode: DisplayMode;
  selector: string;
  category: StyleVariableCategory;
  name: string;
  value: StyleVariableValue;
};

const StyleUpdateSelectorVariableSubscription = gql`
  subscription ($environment: String!) {
    StyleUpdateSelectorVariable(environment: $environment) {
      displayMode
      selector
      category
      name
      value
    }
  }
`;

export default StyleUpdateSelectorVariableSubscription;
