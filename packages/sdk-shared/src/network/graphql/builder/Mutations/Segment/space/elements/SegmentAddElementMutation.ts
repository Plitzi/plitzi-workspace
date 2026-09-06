import { gql } from '@apollo/client/core';

const SegmentAddElementMutation = gql`
  mutation SegmentAddElementMutation(
    $environment: String!
    $element: Json!
    $to: String!
    $dropPosition: String!
    $initialItems: [Json]!
    $variables: [SpaceVariableInput]
    $contextId: String!
  ) {
    SegmentAddElement(
      environment: $environment
      element: $element
      to: $to
      dropPosition: $dropPosition
      initialItems: $initialItems
      contextId: $contextId
      variables: $variables
    ) {
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
`;

export default SegmentAddElementMutation;
