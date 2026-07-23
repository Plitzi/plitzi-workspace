import { gql } from '@apollo/client/core';

import type { DisplayMode } from '../../../../../../../types';

export type TSegmentStyleRemoveSelectorsSubscription = {
  contextId: string;
  displayMode: DisplayMode;
  selectors: string[];
};

const SegmentStyleRemoveSelectorsSubscription = gql`
  subscription ($environment: String!) {
    SegmentStyleRemoveSelectors(environment: $environment) {
      selectors
      displayMode
      contextId
    }
  }
`;

export default SegmentStyleRemoveSelectorsSubscription;
