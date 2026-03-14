import { gql } from '@apollo/client/core';

import type { DisplayMode, StyleVariableCategory } from '../../../../../../types';

export type TStyleRemoveSelectorVariableSubscription = {
  displayMode: DisplayMode;
  selector: string;
  category: StyleVariableCategory;
  name: string;
};

const StyleRemoveSelectorVariableSubscription = gql`
  subscription ($environment: String!) {
    StyleRemoveSelectorVariable(environment: $environment) {
      displayMode
      selector
      category
      name
    }
  }
`;

export default StyleRemoveSelectorVariableSubscription;
