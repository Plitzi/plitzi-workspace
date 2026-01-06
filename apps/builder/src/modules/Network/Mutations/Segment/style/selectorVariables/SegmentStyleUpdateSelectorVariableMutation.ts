import { gql } from '@apollo/client/core';

const SegmentStyleUpdateSelectorVariableMutation = gql`
  mutation SegmentStyleUpdateSelectorVariableMutation(
    $environment: String!
    $contextId: String!
    $displayMode: String!
    $selector: String!
    $category: String!
    $name: String!
    $value: Json!
  ) {
    SegmentStyleUpdateSelectorVariable(
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

export default SegmentStyleUpdateSelectorVariableMutation;
