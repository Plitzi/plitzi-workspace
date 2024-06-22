// Packages
import { gql } from '@apollo/client/core';

const SpaceAddVariableMutation = gql`
  mutation SpaceAddVariableMutation(
    $environment: String!
    $name: String!
    $category: String
    $type: String!
    $value: String
    $subValues: [SpaceVariableSubValueInput]
  ) {
    SpaceAddVariable(
      environment: $environment
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

export default SpaceAddVariableMutation;
