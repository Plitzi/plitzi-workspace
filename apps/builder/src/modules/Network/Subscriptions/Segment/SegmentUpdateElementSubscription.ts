// Packages
import { gql } from '@apollo/client/core';

const SegmentUpdateElementSubscription = gql`
  subscription ($environment: String!) {
    SegmentUpdateElement(environment: $environment) {
      element {
        id
        definition {
          label
          type
          initialState
          styleSelectors
          bindings
          interactions
          parentId
          rootId
          items
        }
        attributes
      }
      contextId
    }
  }
`;

export default SegmentUpdateElementSubscription;
