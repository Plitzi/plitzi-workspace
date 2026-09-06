import { gql } from '@apollo/client/core';

const SegmentAddTemplateMutation = gql`
  mutation SegmentAddTemplateMutation(
    $environment: String!
    $element: Json!
    $style: Json
    $dropPosition: String!
    $to: String!
    $initialItems: [Json]!
    $variables: [SpaceVariableInput]
    $contextId: String!
  ) {
    SegmentAddTemplate(
      environment: $environment
      element: $element
      style: $style
      dropPosition: $dropPosition
      to: $to
      initialItems: $initialItems
      variables: $variables
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
        variables
        platform
        cache
      }
    }
  }
`;

export default SegmentAddTemplateMutation;
