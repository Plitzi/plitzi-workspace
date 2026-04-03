import { gql } from '@apollo/client/core';

const SegmentStyleUpdateVariableMutation = gql`
  mutation SegmentStyleUpdateVariableMutation(
    $environment: String!
    $contextId: String!
    $category: String!
    $name: String!
    $value: Json!
  ) {
    SegmentStyleUpdateVariable(
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

export default SegmentStyleUpdateVariableMutation;
