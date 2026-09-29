const SpaceUpdateSettingsMutation = /* GraphQL */ `
  mutation SpaceUpdateSettingsMutation($environment: String!, $value: Json!, $path: String) {
    SpaceUpdateSettings(environment: $environment, value: $value, path: $path) {
      settings
    }
  }
`;

export default SpaceUpdateSettingsMutation;
