const SpaceSetRuntimeSizeMutation = /* GraphQL */ `
  mutation SpaceSetRuntimeSizeMutation($environment: String!, $size: String!) {
    SpaceSetRuntimeSize(environment: $environment, size: $size)
  }
`;

export default SpaceSetRuntimeSizeMutation;
