import { gql } from '@apollo/client/core';

const SpaceAddPluginMutation = gql`
  mutation SpaceAddPluginMutation($environment: String!, $pluginType: String!, $resource: String!) {
    SpaceAddPlugin(environment: $environment, pluginType: $pluginType, resource: $resource) {
      plugins {
        type
        resource
        settings
      }
    }
  }
`;

export default SpaceAddPluginMutation;
