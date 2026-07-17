import { gql } from '@apollo/client/core';

const SpaceAddElementMutation = gql`
  mutation SpaceAddElementMutation(
    $environment: String!
    $element: Json!
    $to: String!
    $dropPosition: String!
    $initialItems: [Json]!
    $variables: [SpaceVariableInput]
  ) {
    SpaceAddElement(
      environment: $environment
      element: $element
      to: $to
      dropPosition: $dropPosition
      initialItems: $initialItems
      variables: $variables
    ) {
      id
      idRef
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

export default SpaceAddElementMutation;
