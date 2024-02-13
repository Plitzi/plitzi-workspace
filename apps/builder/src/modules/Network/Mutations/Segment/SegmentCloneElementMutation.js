// Packages
import { gql } from '@apollo/client/core';

const SegmentCloneElementMutation = gql`
  mutation SegmentCloneElementMutation(
    $environment: String!
    $element: Json!
    $to: String!
    $dropPosition: String!
    $initialItems: [Json]!
    $contextId: String!
  ) {
    SegmentCloneElement(
      environment: $environment
      element: $element
      to: $to
      dropPosition: $dropPosition
      initialItems: $initialItems
      contextId: $contextId
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

export default SegmentCloneElementMutation;
