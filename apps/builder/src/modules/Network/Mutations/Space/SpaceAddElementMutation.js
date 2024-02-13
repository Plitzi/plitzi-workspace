// Packages
import { gql } from '@apollo/client/core';

const SpaceAddElementMutation = gql`
  mutation SpaceAddElementMutation(
    $environment: String!
    $element: Json!
    $to: String!
    $dropPosition: String!
    $initialItems: [Json]!
  ) {
    SpaceAddElement(
      environment: $environment
      element: $element
      to: $to
      dropPosition: $dropPosition
      initialItems: $initialItems
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

export default SpaceAddElementMutation;
