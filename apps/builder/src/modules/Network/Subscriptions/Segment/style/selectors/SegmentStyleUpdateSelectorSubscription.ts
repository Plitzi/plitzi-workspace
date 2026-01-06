import { gql } from '@apollo/client/core';

const SegmentStyleUpdateSelectorSubscription = gql`
  subscription ($environment: String!) {
    SegmentStyleUpdateSelector(environment: $environment) {
      displayMode
      selector
      path
      style
      contextId
    }
  }
`;

export default SegmentStyleUpdateSelectorSubscription;
