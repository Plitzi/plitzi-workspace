import { gql } from '@apollo/client/core';

const SpaceUpdateSettingsMutation = gql`
  mutation SpaceUpdateSettingsMutation($environment: String!, $value: Json!, $path: String) {
    SpaceUpdateSettings(environment: $environment, value: $value, path: $path) {
      settings
    }
  }
`;

export default SpaceUpdateSettingsMutation;
