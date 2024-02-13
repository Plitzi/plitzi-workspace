// Packages
import { gql } from '@apollo/client/core';

const SegmentAddTemplateMutation = gql`
  mutation SegmentAddTemplateMutation(
    $environment: String!
    $element: Json!
    $styles: Json!
    $dropPosition: String!
    $to: String!
    $initialItems: [Json]!
    $contextId: String!
  ) {
    SegmentAddTemplate(
      environment: $environment
      element: $element
      styles: $styles
      dropPosition: $dropPosition
      to: $to
      initialItems: $initialItems
      contextId: $contextId
    ) {
      id
      identifier
      definition
      schema {
        flat {
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
      style {
        platform
        cache
      }
    }
  }
`;

export default SegmentAddTemplateMutation;
