import { gql } from '@apollo/client/core';

import type { PluginRaw } from '../../../../../types';

export type TSpaceUpdatePluginMutation = { plugins: PluginRaw[] };

/**
 * A plugin's address, its settings, or both — whichever is sent. What is left out is kept: saving the settings does not
 * move the plugin, and a new version does not forget how the space configured it.
 */
const SpaceUpdatePluginMutation = gql`
  mutation SpaceUpdatePluginMutation($environment: String!, $pluginType: String!, $resource: String, $settings: Json) {
    SpaceUpdatePlugin(environment: $environment, pluginType: $pluginType, resource: $resource, settings: $settings) {
      plugins {
        type
        resource
        settings
      }
    }
  }
`;

export default SpaceUpdatePluginMutation;
