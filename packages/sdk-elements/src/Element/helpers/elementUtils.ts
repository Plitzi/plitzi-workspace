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

export type PlitziModule = {
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
