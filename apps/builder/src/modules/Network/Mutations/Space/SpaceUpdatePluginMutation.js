// Packages
import { gql } from '@apollo/client/core';

const SpaceUpdatePluginMutation = gql`
  mutation SpaceUpdatePluginMutation($environment: String!, $pluginType: String!, $pluginVersion: String!) {
    SpaceUpdatePlugin(environment: $environment, pluginType: $pluginType, pluginVersion: $pluginVersion) {
      plugins {
        plugin {
          type
          pluginChildren {
            type
          }
          latestVersion {
            version
          }
          market {
            owner
            verified
            license
            website
            backgroundColor
            icon
            category {
              name
            }
          }
        }
        revisionInstalled {
          scope
          module
          manifestUrl
          version
          assets {
            type
            url
            sizeNormal
            sizeGzip
          }
        }
        settings
        subPlugins
      }
    }
  }
`;

export default SpaceUpdatePluginMutation;
