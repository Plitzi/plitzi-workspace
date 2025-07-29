import { gql } from '@apollo/client/core';

const SpaceUpdatePageSubscription = gql`
  subscription ($environment: String!) {
    SpaceUpdatePage(environment: $environment) {
      page {
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

export default SpaceUpdatePageSubscription;
