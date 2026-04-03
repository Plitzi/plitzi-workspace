import { gql } from '@apollo/client/core';

const SegmentStyleRemoveSelectorVariableMutation = gql`
  mutation SegmentStyleRemoveSelectorVariableMutation(
    $environment: String!
    $contextId: String!
    $displayMode: String!
    $selector: String!
    $category: String!
    $name: String!
  ) {
    SegmentStyleRemoveSelectorVariable(
      environment: $environment
      contextId: $contextId
      displayMode: $displayMode
      selector: $selector
      category: $category
      name: $name
    ) {
      contextId
      displayMode
      selector
      category
      name
    }
  }
`;

export default SegmentStyleRemoveSelectorVariableMutation;
