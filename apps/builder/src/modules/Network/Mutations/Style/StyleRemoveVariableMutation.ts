import { gql } from '@apollo/client/core';

const StyleRemoveVariableMutation = gql`
  mutation StyleRemoveVariableMutation($environment: String!, $variable: String!) {
    StyleRemoveVariable(environment: $environment, variable: $variable) {
      id
      variables
      platform
      mode
      cache
    }
  }
`;

export default StyleRemoveVariableMutation;
