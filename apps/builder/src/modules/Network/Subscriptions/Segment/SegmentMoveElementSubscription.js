// Packages
import { gql } from '@apollo/client/core';

const SegmentMoveElementSubscription = gql`
  subscription ($environment: String!) {
    SegmentMoveElement(environment: $environment) {
      elementId
      from
      to
      dropPosition
      contextId
    }
  }
`;

export default SegmentMoveElementSubscription;
