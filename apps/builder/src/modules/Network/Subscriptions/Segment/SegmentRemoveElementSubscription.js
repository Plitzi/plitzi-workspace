// Packages
import { gql } from '@apollo/client/core';

const SegmentRemoveElementSubscription = gql`
  subscription ($environment: String!) {
    SegmentRemoveElement(environment: $environment) {
      elementId
      contextId
    }
  }
`;

export default SegmentRemoveElementSubscription;
