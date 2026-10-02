/** Declares a feature flag, or changes one: a flag is keyed by its name, so the two are the same write. */
const SpaceSetFlagMutation = /* GraphQL */ `
  mutation SpaceSetFlagMutation($environment: String!, $name: String!, $flag: JSON!) {
    SpaceSetFlag(environment: $environment, name: $name, flag: $flag) {
      name
      flag
    }
  }
`;

export default SpaceSetFlagMutation;
