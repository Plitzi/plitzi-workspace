// Packages
import { gql } from '@apollo/client/core';

const SpaceAddTemplateSubscription = gql`
  subscription ($environment: String!) {
    SpaceAddTemplate(environment: $environment) {
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
      styles
      dropPosition
      to
      initialItems
    }
  }
`;

export default SpaceAddTemplateSubscription;
