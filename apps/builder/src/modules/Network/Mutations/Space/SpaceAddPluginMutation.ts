import { gql } from '@apollo/client/core';

import type { PluginRaw } from '@plitzi/sdk-shared';

export type TSpaceAddPluginMutation = { plugins: PluginRaw[] };

const SpaceAddPluginMutation = gql`
  mutation SpaceAddPluginMutation($environment: String!, $pluginType: String!, $resource: String!, $override: Boolean) {
    SpaceAddPlugin(environment: $environment, pluginType: $pluginType, resource: $resource, override: $override) {
      plugins {
        type
        resource
        settings
      }
    }
  }
`;

export default SpaceAddPluginMutation;
