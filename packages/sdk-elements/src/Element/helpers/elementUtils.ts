import get from 'lodash-es/get';
import * as React from 'react';
import * as ReactJSX from 'react/jsx-runtime';
import * as ReactDOM from 'react-dom';

import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import ComponentProvider from '../../Component/ComponentProvider';
import RootElement from '../RootElement';

import type { ComponentPlugin } from '@plitzi/sdk-shared';

type PlitziModuleLegacy = {
  default?: (
    plitziModule: PlitziModuleLegacy,
    args: { window: Window; document: Document; Navigator: Navigator; navigator: Window['navigator'] } | undefined,
    externals: Record<string, object>
  ) => Promise<{ default: ComponentPlugin } & ComponentPlugin>;
  ComponentProvider: typeof ComponentProvider;
  ComponentContext: typeof ComponentContext;
  usePlitziServiceContext: typeof usePlitziServiceContext;
  RootElement: typeof RootElement;
};

type PlitziModule = {
  default: ComponentPlugin;
  version?: string;
  initialItems?: string[];
  plugins?: Record<string, ComponentPlugin>;
};

export const generatePluginModule = async (url: string, asESM = true, pluginScope = '') => {
  let Module: PlitziModule;
  try {
    if (asESM) {
      const response = await fetch(url);
      const moduleBlob = new Blob([await response.text()], { type: 'text/javascript' });
      Module = (await import(
        /* @vite-ignore */ /* webpackIgnore: true */ URL.createObjectURL(moduleBlob)
      )) as PlitziModule;
    } else {
      const plitziModules: PlitziModuleLegacy = {
        default: undefined, // we dont need default export, normally should be PlitziSdk
        ComponentProvider,
        ComponentContext,
        usePlitziServiceContext,
        RootElement
      };

      const externals = {
        __WEBPACK_EXTERNAL_MODULE_react__: React,
        __WEBPACK_EXTERNAL_MODULE_react_dom__: ReactDOM,
        __WEBPACK_EXTERNAL_MODULE_react_jsx_runtime__: ReactJSX,
        __WEBPACK_EXTERNAL_MODULE__plitzi_plitzi_sdk__: plitziModules
      };

      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
      const ModuleWrapper = get(window, `plitziPlugins.${pluginScope}`) as PlitziModuleLegacy['default'] | undefined;
      if (!ModuleWrapper || typeof ModuleWrapper !== 'function') {
        return undefined;
      }

      // Pass down SDK webpack context
      Module = (await ModuleWrapper(plitziModules, undefined, externals)) as PlitziModule;
    }
  } catch (e) {
    console.log(e);
    return undefined;
  }

  return Module;
};

// export const generatePluginPromises = async (pluginScripts: Record<string, unknown> = {}) => {
//   const promises: Promise<unknown>[] = [];
//   Object.keys(pluginScripts).forEach(pluginScope => {
//     pluginScripts[pluginScope].forEach((url: string) => {
//       promises.push(
//         new Promise(async (resolve, reject) => {
//           const script = window.document.createElement('script');
//           script.src = url;
//           script.type = 'text/javascript';
//           script.async = true;

//           script.onload = async () => {
//             window.document.head.removeChild(script);
//             const Module = await generatePluginModule(url, false, pluginScope);
//             if (!Module) {
//               reject(new Error('Module not found'));

//               return;
//             }

//             const Component = get(Module, 'default');
//             const { version, initialItems, plugins } = Module;
//             if (!Component) {
//               reject(new Error('Component not found'));

//               return;
//             }

//             Component.plugins = plugins;
//             Component.initialItems = initialItems;
//             Component.version = version;
//             Component.origin = 'remote';
//             resolve({ type: Component.type, Component });
//           };

//           script.onerror = err => {
//             console.log(err);
//             reject(err);
//           };

//           window.document.head.appendChild(script);
//         })
//       );
//     });
//   });

//   if (promises.length === 0) {
//     return promises;
//   }

//   const pluginsProcessed = await (
//     await (await Promise.allSettled(promises)).filter(promise => promise.status === 'fulfilled')
//   ).map(promise => promise.value);

//   return pluginsProcessed;
// };
