import { gql } from 'graphql-tag';

const StyleAddVariableMutation = gql`
  mutation StyleAddVariableMutation($environment: String!, $category: String!, $name: String!, $value: Json!) {
    StyleAddVariable(environment: $environment, category: $category, name: $name, value: $value) {
      category
      name
      value
    }
  }
`;

export default StyleAddVariableMutation;
