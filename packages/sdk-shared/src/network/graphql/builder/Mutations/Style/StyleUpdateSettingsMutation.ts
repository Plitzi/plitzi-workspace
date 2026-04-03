import { gql } from '@apollo/client/core';

const StyleUpdateSettingsMutation = gql`
  mutation StyleUpdateSettingsMutation($environment: String!, $path: String!, $value: String!) {
    StyleUpdateSettings(environment: $environment, path: $path, value: $value) {
      id
      variables
      platform
      mode
      cache
    }
  }
`;

export default StyleUpdateSettingsMutation;
