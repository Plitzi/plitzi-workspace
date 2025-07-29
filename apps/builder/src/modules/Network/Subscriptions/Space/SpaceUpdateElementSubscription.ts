import { gql } from '@apollo/client/core';

const SpaceUpdateElementSubscription = gql`
  subscription ($environment: String!) {
    SpaceUpdateElement(environment: $environment) {
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
    }
  }
`;

export default SpaceUpdateElementSubscription;
