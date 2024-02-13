// Packages
import { gql } from '@apollo/client/core';

const SpaceAddPluginMutation = gql`
  mutation SpaceAddPluginMutation($environment: String!, $pluginType: String!, $pluginVersion: String!) {
    SpaceAddPlugin(environment: $environment, pluginType: $pluginType, pluginVersion: $pluginVersion) {
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

export default SpaceAddPluginMutation;
