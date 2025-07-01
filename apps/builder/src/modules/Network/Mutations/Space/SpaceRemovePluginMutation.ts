// Packages
import { gql } from '@apollo/client/core';

const SpaceRemovePluginMutation = gql`
  mutation SpaceRemovePluginMutation($environment: String!, $pluginType: String!) {
    SpaceRemovePlugin(environment: $environment, pluginType: $pluginType) {
      plugins {
        type
        resource
        settings
      }
    }
  }
`;

export default SpaceRemovePluginMutation;
