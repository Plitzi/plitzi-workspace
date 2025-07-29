import { gql } from '@apollo/client/core';

const SegmentStyleRemoveVariableMutation = gql`
  mutation SegmentStyleRemoveVariableMutation($environment: String!, $variable: String!, $contextId: String!) {
    SegmentStyleRemoveVariable(environment: $environment, variable: $variable, contextId: $contextId) {
      variables
      platform
      cache
    }
  }
`;

export default SegmentStyleRemoveVariableMutation;
