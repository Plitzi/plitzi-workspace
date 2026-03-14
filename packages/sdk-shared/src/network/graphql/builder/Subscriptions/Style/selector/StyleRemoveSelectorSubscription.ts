import { gql } from '@apollo/client/core';

import type { DisplayMode } from '../../../../../../types';

export type TStyleRemoveSelectorSubscription = {
  displayMode: DisplayMode;
  selector: string;
};

const StyleRemoveSelectorSubscription = gql`
  subscription ($environment: String!) {
    StyleRemoveSelector(environment: $environment) {
      displayMode
      selector
    }
  }
`;

export default StyleRemoveSelectorSubscription;
