// Packages
import { gql } from '@apollo/client/core';

const SpaceAddElementSubscription = gql`
  subscription ($environment: String!) {
    SpaceAddElement(environment: $environment) {
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
    }
  }
`;

export default SpaceAddElementSubscription;
