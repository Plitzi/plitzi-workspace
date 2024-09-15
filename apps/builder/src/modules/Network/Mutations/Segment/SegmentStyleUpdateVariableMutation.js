// Packages
import { gql } from '@apollo/client/core';

const SegmentStyleUpdateVariableMutation = gql`
  mutation SegmentStyleUpdateVariableMutation(
    $environment: String!
    $variable: String!
    $value: String!
    $contextId: String!
  ) {
    SegmentStyleUpdateVariable(environment: $environment, variable: $variable, value: $value, contextId: $contextId) {
      variables
      platform
      cache
    }
  }
`;

export default SegmentStyleUpdateVariableMutation;
