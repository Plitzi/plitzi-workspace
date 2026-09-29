const SpaceSetRuntimeVariableMutation = /* GraphQL */ `
  mutation SpaceSetRuntimeVariableMutation($name: String!, $value: String!) {
    SpaceSetRuntimeVariable(name: $name, value: $value)
  }
`;

export default SpaceSetRuntimeVariableMutation;
