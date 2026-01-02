import { gql } from '@apollo/client/core';

const StyleUpdateVariableMutation = gql`
  mutation StyleUpdateVariableMutation($environment: String!, $category: String!, $name: String!, $value: String!) {
    StyleUpdateVariable(environment: $environment, category: $category, name: $name, value: $value) {
      id
      variables
      platform
      mode
      cache
    }
  }
`;

export default StyleUpdateVariableMutation;
