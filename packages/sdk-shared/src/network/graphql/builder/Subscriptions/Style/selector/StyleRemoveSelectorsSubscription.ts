import { gql } from '@apollo/client/core';

import type { DisplayMode } from '../../../../../../types';

export type TStyleRemoveSelectorsSubscription = {
  displayMode: DisplayMode;
  selectors: string[];
};

const StyleRemoveSelectorsSubscription = gql`
  subscription ($environment: String!) {
    StyleRemoveSelectors(environment: $environment) {
      displayMode
      selectors
    }
  }
`;

export default StyleRemoveSelectorsSubscription;
