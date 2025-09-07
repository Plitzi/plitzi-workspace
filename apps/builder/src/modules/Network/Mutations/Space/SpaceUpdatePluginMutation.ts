import { gql } from '@apollo/client/core';

const SpaceUpdatePluginMutation = gql`
  mutation SpaceUpdatePluginMutation($environment: String!, $pluginType: String!, $resource: String!) {
    SpaceUpdatePlugin(environment: $environment, pluginType: $pluginType, resource: $resource) {
      plugins {
        type
        resource
        settings
      }
    }
  }
`;

export default SpaceUpdatePluginMutation;
