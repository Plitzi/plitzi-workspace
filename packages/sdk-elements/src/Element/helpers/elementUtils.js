// Packages
import get from 'lodash/get.js';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

// Monorepo
import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';

// Relatives
import ComponentContext from '../../Component/ComponentContext.js';
import ComponentProvider from '../../Component/ComponentProvider.js';
import RootElement from '../RootElement.js';

export const generatePluginModule = async (url, asES6 = true, pluginScope = '') => {
  let Module;
  try {
    const plitziModules = {
      default: undefined, // we dont need default export, normally should be PlitziSdk
      ComponentProvider,
      ComponentContext,
      usePlitziServiceContext,
      RootElement
    };

    const externals = {
      __WEBPACK_EXTERNAL_MODULE_react__: React,
      __WEBPACK_EXTERNAL_MODULE_react_dom__: ReactDOM,
      __WEBPACK_EXTERNAL_MODULE__plitzi_plitzi_sdk__: plitziModules
    };

    if (asES6) {
      const response = await fetch(url, { 'no-cors': true });
      const moduleBlob = new Blob([await response.text()], { type: 'text/javascript' });
      const blobUrl = URL.createObjectURL(moduleBlob);
      const ModuleWrapper = await import(/* webpackIgnore:true */ `${blobUrl}`);
      if (!ModuleWrapper || typeof ModuleWrapper === 'function') {
        return undefined;
      }

      // Pass down SDK webpack context
      Module = await ModuleWrapper.default(plitziModules, undefined, externals);
    } else {
      const ModuleWrapper = get(window, `plitziPlugins.${pluginScope}`);
      if (!ModuleWrapper || typeof ModuleWrapper !== 'function') {
        return undefined;
      }

      // Pass down SDK webpack context
      Module = await ModuleWrapper(plitziModules, undefined, externals);
    }
  } catch (e) {
    console.log(e);
    return undefined;
  }

  return Module;
};

export const generatePluginPromises = async (pluginScripts = {}) => {
  const promises = [];
  Object.keys(pluginScripts).forEach(pluginScope => {
    pluginScripts[pluginScope].forEach(url => {
      promises.push(
        new Promise(async (resolve, reject) => {
          const script = window.document.createElement('script');
          script.src = url;
          script.type = 'text/javascript';
          script.async = true;

          script.onload = async () => {
            window.document.head.removeChild(script);
            const Module = await generatePluginModule(url, false, pluginScope);
            if (!Module) {
              reject(new Error('Module not found'));

              return;
            }

            const Component = get(Module, 'default');
            const { version, initialItems, plugins } = Module;
            if (!Component) {
              reject(new Error('Component not found'));

              return;
            }

            Component.plugins = plugins;
            Component.initialItems = initialItems;
            Component.version = version;
            Component.origin = 'remote';
            resolve({ type: Component.type, Component });
          };

          script.onerror = err => {
            console.log(err);
            reject(err);
          };

          window.document.head.appendChild(script);
        })
      );
    });
  });

  if (promises.length === 0) {
    return promises;
  }

  const pluginsProcessed = await (
    await (await Promise.allSettled(promises)).filter(promise => promise.status === 'fulfilled')
  ).map(promise => promise.value);

  return pluginsProcessed;
};

export const nativeEventsList = ['onClick', 'onFocus', 'onBlur', 'onMouseEnter', 'onMouseLeave'];
