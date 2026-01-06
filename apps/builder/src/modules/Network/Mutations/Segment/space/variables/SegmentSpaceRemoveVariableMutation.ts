import { gql } from '@apollo/client/core';

const SegmentSpaceRemoveVariableMutation = gql`
  mutation SegmentSpaceRemoveVariableMutation($environment: String!, $contextId: String!, $name: String!) {
    SegmentSpaceRemoveVariable(environment: $environment, contextId: $contextId, name: $name) {
      name
      category
      type
      value
      subValues {
        when
        value
      }
    }
  }
`;

export default SegmentSpaceRemoveVariableMutation;
