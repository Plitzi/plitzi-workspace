import { gql } from '@apollo/client/core';

const SegmentStyleAddVariableMutation = gql`
  mutation SegmentStyleAddVariableMutation(
    $environment: String!
    $contextId: String!
    $category: String!
    $name: String!
    $value: Json!
  ) {
    SegmentStyleAddVariable(
      environment: $environment
      contextId: $contextId
      category: $category
      name: $name
      value: $value
    ) {
      contextId
      category
      name
      value
    }
  }
`;

export default SegmentStyleAddVariableMutation;
