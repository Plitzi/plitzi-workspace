// Packages
import omit from 'lodash/omit';

export const PluginsActions = {
  PLUGINS_INIT: 'PLUGINS_INIT',
  PLUGINS_ADD: 'PLUGINS_ADD',
  PLUGINS_ADD_MANY: 'PLUGINS_ADD_MANY',
  PLUGINS_UPDATE: 'PLUGINS_UPDATE',
  PLUGINS_UPDATE_MANY: 'PLUGINS_UPDATE_MANY',
  PLUGINS_REMOVE: 'PLUGINS_REMOVE',
  PLUGINS_REMOVE_MANY: 'PLUGINS_REMOVE_MANY'
};

const PluginsReducer = (state, action = {}) => {
  switch (action.type) {
    case PluginsActions.PLUGINS_INIT:
    case PluginsActions.PLUGINS_ADD_MANY:
    case PluginsActions.PLUGINS_UPDATE_MANY:
      return { ...state, ...action.plugins };

    case PluginsActions.PLUGINS_ADD:
    case PluginsActions.PLUGINS_UPDATE: {
      const { plugin } = action;
      if (!plugin) {
        return state;
      }

      return { ...state, [plugin.type]: plugin };
    }

    case PluginsActions.PLUGINS_REMOVE: {
      const { pluginType } = action;

      return omit(state, [pluginType]);
    }

    case PluginsActions.PLUGINS_REMOVE_MANY: {
      const { pluginTypes } = action;

      return omit(state, pluginTypes);
    }

    default:
      return state;
  }
};

export default PluginsReducer;
