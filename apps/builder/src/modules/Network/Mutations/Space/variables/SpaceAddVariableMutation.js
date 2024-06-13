// Packages
import { gql } from '@apollo/client/core';

const SpaceAddVariableMutation = gql`
  mutation SpaceAddVariableMutation(
    $environment: String!
    $name: String!
    $category: String
    $type: String!
    $value: String
  ) {
    SpaceAddVariable(environment: $environment, name: $name, category: $category, type: $type, value: $value) {
      name
      category
      type
      value
    }
  }
`;

export default SpaceAddVariableMutation;
