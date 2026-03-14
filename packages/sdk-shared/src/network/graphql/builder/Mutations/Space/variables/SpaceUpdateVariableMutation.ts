import { gql } from '@apollo/client/core';

const SpaceUpdateVariableMutation = gql`
  mutation SpaceUpdateVariableMutation($environment: String!, $variable: Json!) {
    SpaceUpdateVariable(environment: $environment, variable: $variable) {
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

export default SpaceUpdateVariableMutation;
