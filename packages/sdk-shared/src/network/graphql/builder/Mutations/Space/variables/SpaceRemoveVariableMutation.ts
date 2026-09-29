const SpaceRemoveVariableMutation = /* GraphQL */ `
  mutation SpaceRemoveVariableMutation($environment: String!, $name: String!) {
    SpaceRemoveVariable(environment: $environment, name: $name) {
      name
    }
  }
`;

export default SpaceRemoveVariableMutation;
