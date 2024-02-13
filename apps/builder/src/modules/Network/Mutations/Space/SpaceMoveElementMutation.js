// Packages
import { gql } from '@apollo/client/core';

const SpaceMoveElementMutation = gql`
  mutation SpaceMoveElementMutation(
    $environment: String!
    $elementId: String!
    $from: String!
    $to: String!
    $dropPosition: String!
  ) {
    SpaceMoveElement(
      environment: $environment
      elementId: $elementId
      from: $from
      to: $to
      dropPosition: $dropPosition
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

export default SpaceMoveElementMutation;
