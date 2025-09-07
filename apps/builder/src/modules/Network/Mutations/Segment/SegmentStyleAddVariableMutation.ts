import { gql } from '@apollo/client/core';

const SegmentStyleAddVariableMutation = gql`
  mutation SegmentStyleAddVariableMutation(
    $environment: String!
    $variable: String!
    $value: String!
    $contextId: String!
  ) {
    SegmentStyleAddVariable(environment: $environment, variable: $variable, value: $value, contextId: $contextId) {
      variables
      platform
      cache
    }
  }
`;

export default SegmentStyleAddVariableMutation;
