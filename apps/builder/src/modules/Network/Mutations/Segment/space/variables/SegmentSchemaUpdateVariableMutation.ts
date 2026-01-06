import { gql } from '@apollo/client/core';

const SegmentSchemaUpdateVariableMutation = gql`
  mutation SegmentSchemaUpdateVariableMutation(
    $environment: String!
    $contextId: String!
    $name: String!
    $category: String
    $type: String!
    $value: String
    $subValues: [SpaceVariableSubValueInput]
  ) {
    SegmentSchemaUpdateVariable(
      environment: $environment
      contextId: $contextId
      name: $name
      category: $category
      type: $type
      value: $value
      subValues: $subValues
    ) {
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

export default SegmentSchemaUpdateVariableMutation;
