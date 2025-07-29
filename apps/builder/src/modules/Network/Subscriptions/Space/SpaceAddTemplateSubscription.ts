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
    }
  }
`;

export default SpaceAddTemplateSubscription;
