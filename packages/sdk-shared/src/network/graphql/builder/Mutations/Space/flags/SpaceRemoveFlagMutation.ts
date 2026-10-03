const SpaceRemoveFlagMutation = /* GraphQL */ `
  mutation SpaceRemoveFlagMutation($environment: String!, $name: String!) {
    SpaceRemoveFlag(environment: $environment, name: $name) {
      name
    }
  }
`;

export default SpaceRemoveFlagMutation;
