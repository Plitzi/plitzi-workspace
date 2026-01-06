import { gql } from '@apollo/client/core';

const SegmentStyleAddSelectorSubscription = gql`
  subscription ($environment: String!) {
    SegmentStyleAddSelector(environment: $environment) {
      displayMode
      selector
      path
      style
      contextId
    }
  }
`;

export default SegmentStyleAddSelectorSubscription;
