const StyleRemoveVariableMutation = /* GraphQL */ `
  mutation StyleRemoveVariableMutation($environment: String!, $category: String!, $name: String!) {
    StyleRemoveVariable(environment: $environment, category: $category, name: $name) {
      category
      name
    }
  }
`;

export default StyleRemoveVariableMutation;
