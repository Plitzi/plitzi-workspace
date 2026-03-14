import { gql } from '@apollo/client/core';

const SegmentStyleAddSelectorVariableMutation = gql`
  mutation SegmentStyleAddSelectorVariableMutation(
    $environment: String!
    $contextId: String!
    $displayMode: String!
    $selector: String!
    $category: String!
    $name: String!
    $value: Json!
  ) {
    SegmentStyleAddSelectorVariable(
      environment: $environment
      contextId: $contextId
      displayMode: $displayMode
      selector: $selector
      category: $category
      name: $name
      value: $value
    ) {
      contextId
      displayMode
      selector
      category
      name
      value
    }
  }
`;

export default SegmentStyleAddSelectorVariableMutation;
