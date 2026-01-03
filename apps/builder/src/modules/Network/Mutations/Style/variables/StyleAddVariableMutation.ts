import { gql } from '@apollo/client/core';

const StyleAddVariableMutation = gql`
  mutation StyleAddVariableMutation($environment: String!, $category: String!, $name: String!, $value: Json!) {
    StyleAddVariable(environment: $environment, category: $category, name: $name, value: $value) {
      id
      variables
      platform
      mode
      cache
    }
  }
`;

export default StyleAddVariableMutation;
