import { gql } from 'graphql-tag';

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
