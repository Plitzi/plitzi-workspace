import omit from 'lodash-es/omit';

import type { ComponentDefinition } from '@plitzi/sdk-shared';

export type PluginsReducerActions =
  | { type: 'init'; plugins: Record<string, ComponentDefinition> }
  | { type: 'add'; plugin: ComponentDefinition }
  | { type: 'addMany'; plugins: Record<string, ComponentDefinition> }
  | { type: 'update'; plugin: ComponentDefinition }
  | { type: 'updateMany'; plugins: Record<string, ComponentDefinition> }
  | { type: 'remove'; pluginType: string }
  | { type: 'removeMany'; pluginTypes: string[] };

const PluginsReducer = (
  state: Record<string, ComponentDefinition>,
  action: PluginsReducerActions
): Record<string, ComponentDefinition> => {
  switch (action.type) {
    case 'init':
    case 'addMany':
    case 'updateMany':
      return { ...state, ...action.plugins };

    case 'add':
    case 'update': {
      const { plugin } = action;
      if (!(plugin as ComponentDefinition | undefined)) {
        return state;
      }

      return { ...state, [plugin.type]: plugin };
    }

    case 'remove': {
      const { pluginType } = action;

      return omit(state, [pluginType]);
    }

    case 'removeMany': {
      const { pluginTypes } = action;

      return omit(state, pluginTypes);
    }

    default:
      return state;
  }
};

export default PluginsReducer;
