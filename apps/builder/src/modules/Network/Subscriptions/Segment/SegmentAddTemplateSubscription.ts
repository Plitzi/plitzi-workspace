import { gql } from '@apollo/client/core';

const SegmentAddTemplateSubscription = gql`
  subscription ($environment: String!) {
    SegmentAddTemplate(environment: $environment) {
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
      contextId
    }
  }
`;

export default SegmentAddTemplateSubscription;
