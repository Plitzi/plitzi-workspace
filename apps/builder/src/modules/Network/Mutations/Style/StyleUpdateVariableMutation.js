// Packages
import { gql } from '@apollo/client/core';

const StyleUpdateVariableMutation = gql`
  mutation StyleUpdateVariableMutation($environment: String!, $variable: String!, $value: String!) {
    StyleUpdateVariable(environment: $environment, variable: $variable, value: $value) {
      id
      variables
      platform
      cache
    }
  }
`;

export default StyleUpdateVariableMutation;
