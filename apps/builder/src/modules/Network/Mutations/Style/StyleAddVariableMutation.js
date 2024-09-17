// Packages
import { gql } from '@apollo/client/core';

const StyleAddVariableMutation = gql`
  mutation StyleAddVariableMutation($environment: String!, $variable: String!, $value: String!) {
    StyleAddVariable(environment: $environment, variable: $variable, value: $value) {
      id
      variables
      platform
      cache
    }
  }
`;

export default StyleAddVariableMutation;
