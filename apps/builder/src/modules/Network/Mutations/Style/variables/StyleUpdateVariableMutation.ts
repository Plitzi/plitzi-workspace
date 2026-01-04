import { gql } from '@apollo/client/core';

const StyleUpdateVariableMutation = gql`
  mutation StyleUpdateVariableMutation($environment: String!, $category: String!, $name: String!, $value: Json!) {
    StyleUpdateVariable(environment: $environment, category: $category, name: $name, value: $value) {
      category
      name
      value
    }
  }
`;

export default StyleUpdateVariableMutation;
