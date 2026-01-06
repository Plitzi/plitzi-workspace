import { gql } from '@apollo/client/core';

const SegmentSchemaRemoveVariableMutation = gql`
  mutation SegmentSchemaRemoveVariableMutation($environment: String!, $contextId: String!, $name: String!) {
    SegmentSchemaRemoveVariable(environment: $environment, contextId: $contextId, name: $name) {
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

export default SegmentSchemaRemoveVariableMutation;
