// Packages
import { gql } from '@apollo/client/core';

const SpaceRemoveVariableMutation = gql`
  mutation SpaceRemoveVariableMutation($environment: String!, $name: String!) {
    SpaceRemoveVariable(environment: $environment, name: $name) {
      name
    }
  }
`;

export default SpaceRemoveVariableMutation;
