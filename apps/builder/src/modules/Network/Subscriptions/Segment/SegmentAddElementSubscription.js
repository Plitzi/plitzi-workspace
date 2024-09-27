// Packages
import { gql } from '@apollo/client/core';

const SegmentAddElementSubscription = gql`
  subscription ($environment: String!) {
    SegmentAddElement(environment: $environment) {
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
      variables {
        name
        category
        type
        value
        subValues {
          value
          when
        }
      }
      contextId
    }
  }
`;

export default SegmentAddElementSubscription;
