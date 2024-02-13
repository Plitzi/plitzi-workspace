// Packages
import { gql } from '@apollo/client/core';

const SegmentStyleRemoveSelectorSubscription = gql`
  subscription ($environment: String!) {
    SegmentStyleRemoveSelector(environment: $environment) {
      selector
      contextId
    }
  }
`;

export default SegmentStyleRemoveSelectorSubscription;
