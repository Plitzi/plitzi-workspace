const StyleAddVariableMutation = /* GraphQL */ `
  mutation StyleAddVariableMutation($environment: String!, $category: String!, $name: String!, $value: Json!) {
    StyleAddVariable(environment: $environment, category: $category, name: $name, value: $value) {
      category
      name
      value
    }
  }
`;

export default StyleAddVariableMutation;
