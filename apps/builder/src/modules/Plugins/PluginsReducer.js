// Packages
import omit from 'lodash/omit';

export const PluginsActions = {
  PLUGINS_INIT: 'PLUGINS_INIT',
  PLUGINS_ADD: 'PLUGINS_ADD',
  PLUGINS_UPDATE: 'PLUGINS_UPDATE',
  PLUGINS_REMOVE: 'PLUGINS_REMOVE'
};

const PluginsReducer = (state, action = {}) => {
  switch (action.type) {
    case PluginsActions.PLUGINS_INIT:
      return { ...state, ...action.plugins };

    case PluginsActions.PLUGINS_ADD:
    case PluginsActions.PLUGINS_UPDATE: {
      const { plugin } = action;

      return { ...state, [plugin.type]: plugin };
    }

    case PluginsActions.PLUGINS_REMOVE: {
      const { pluginType } = action;

      return omit(state, [pluginType]);
    }

    default:
      return state;
  }
};

export default PluginsReducer;
