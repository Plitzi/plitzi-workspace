import { gql } from '@apollo/client/core';

import type { DisplayMode } from '../../../../../../../types';

export type TSegmentStyleRemoveSelectorSubscription = {
  contextId: string;
  displayMode: DisplayMode;
  selector: string;
};

const SegmentStyleRemoveSelectorSubscription = gql`
  subscription ($environment: String!) {
    SegmentStyleRemoveSelector(environment: $environment) {
      selector
      displayMode
      contextId
    }
  }
`;

export default SegmentStyleRemoveSelectorSubscription;
