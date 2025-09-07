import { gql } from '@apollo/client/core';

const SpaceCloneElementSubscription = gql`
  subscription ($environment: String!) {
    SpaceCloneElement(environment: $environment) {
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

export default SpaceCloneElementSubscription;
