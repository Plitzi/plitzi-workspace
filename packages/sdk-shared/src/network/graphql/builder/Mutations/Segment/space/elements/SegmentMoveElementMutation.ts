import { gql } from '@apollo/client/core';

const SegmentMoveElementMutation = gql`
  mutation SegmentMoveElementMutation(
    $environment: String!
    $elementId: String!
    $from: String!
    $to: String!
    $dropPosition: String!
    $contextId: String!
  ) {
    SegmentMoveElement(
      environment: $environment
      elementId: $elementId
      from: $from
      to: $to
      dropPosition: $dropPosition
      contextId: $contextId
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

export default SegmentMoveElementMutation;
