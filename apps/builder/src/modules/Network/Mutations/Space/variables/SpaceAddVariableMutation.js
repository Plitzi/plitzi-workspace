// Packages
import { gql } from '@apollo/client/core';

const SpaceAddVariableMutation = gql`
  mutation SpaceAddVariableMutation($environment: String!, $name: String!, $description: String, $category: String, $type: String!, $value: String, $when: String) {
    SpaceAddVariable(environment: $environment, name: $name, description: $description, category: $category, type: $type, value: $value, when: $when) {
      name
      description
      category
      type
      value
      when
    }
  }
`;

export default SpaceAddVariableMutation;
