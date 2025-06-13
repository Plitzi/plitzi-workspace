// Packages
import { gql } from '@apollo/client/core';

const SegmentCloneElementSubscription = gql`
  subscription ($environment: String!) {
    SegmentCloneElement(environment: $environment) {
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
      dropPosition
      to
      initialItems
      contextId
    }
  }
`;

export default SegmentCloneElementSubscription;
