// Packages
import React, { useEffect, useRef } from 'react';
import noop from 'lodash/noop';
import get from 'lodash/get';
import set from 'lodash/set';

const PluginLoader = props => {
  const {
    type = 'script',
    pluginType = '',
    url = '',
    entryPoint = '',
    onLoad = noop,
    onError = noop,
    onUnload = noop
  } = props;
  const pluginDOM = useRef(null);

  const handleLoad = () => {
    const component = get(window, entryPoint);
    if (!component) {
      return;
    }

    onLoad(component, pluginType, type);
  };

  const handleError = () => {
    onError(pluginType);
  };

  const paramsBuilder = (element, url) => {
    const params = {
      src: url,
      crossOrigin: 'anonymous',
      onload: handleLoad,
      onerror: handleError
    };

    Object.keys(params).forEach(key => {
      element[key] = params[key];
    });
  };

  const datasetBuilder = (dataset, params) => {
    Object.keys(params).forEach(key => {
      dataset[key] = params[key];
    });
  };

  const isPluginLoaded = () => {
    return !!get(window, entryPoint);
  };

  const initPlugin = () => {
    pluginDOM.current = document.head.querySelector(`${type}[data-plitzi-plugin-type="${pluginType}"]`);
    if (pluginDOM.current) {
      if (isPluginLoaded()) {
        handleLoad();
      } else {
        pluginDOM.current.addEventListener('load', handleLoad);
        pluginDOM.current.addEventListener('error', handleError);
      }

      return;
    }

    const newPlugin = document.createElement(type);
    paramsBuilder(newPlugin, url);
    datasetBuilder(newPlugin.dataset, {
      plitziPlugin: true,
      plitziPluginType: pluginType,
      plitziPluginEntryPoint: entryPoint
    });

    pluginDOM.current = newPlugin;
    document.head.appendChild(newPlugin);
  };

  useEffect(() => {
    initPlugin();

    return () => {
      if (!pluginDOM.current) {
        return;
      }

      if (!isPluginLoaded()) {
        pluginDOM.current.removeEventListener('load', handleLoad);
        pluginDOM.current.removeEventListener('error', handleError);
      }

      pluginDOM.current.remove();
      onUnload(pluginType);
      set(window, entryPoint, null);
    };
  }, []);

  return null;
};

export default React.memo(PluginLoader);
