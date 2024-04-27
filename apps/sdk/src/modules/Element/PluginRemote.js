// Packages
import React, { lazy, Suspense, useContext, useMemo } from 'react';
import get from 'lodash/get';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import ComponentContext from '@modules/Component/ComponentContext';
import { nestedInject, ORIGIN_REMOTE } from '@modules/Component/ComponentHelper';

// Relatives
import withElement from './hocs/withElement'; // eslint-disable-line import/no-cycle
import { generatePluginModule } from './helpers/elementUtils';
import useDynamicScript from './useDynamicScript';

function loadComponent(
  url,
  pluginScope,
  registerCallback,
  NotFoundNode,
  autoRegister = true,
  plitziJsxSkipHOC = false
) {
  return async () => {
    // Based on ES6 Module
    const Module = await generatePluginModule(url, false, pluginScope);
    if (!Module) {
      return { default: NotFoundNode };
    }

    // Register module into Components context cache
    const { type, pluginSettings } = get(Module, 'default', {});
    const { version, initialItems, plugins } = Module;
    if (!type) {
      return { default: NotFoundNode };
    }

    let plitziComponent = Module.default;
    if (!plitziJsxSkipHOC) {
      plitziComponent = withElement(Module.default);
    }

    plitziComponent.version = version;
    plitziComponent.origin = ORIGIN_REMOTE;
    plitziComponent.type = type;
    plitziComponent.initialItems = initialItems;
    plitziComponent.pluginSettings = pluginSettings;
    plitziComponent.plugins = nestedInject(plugins, ORIGIN_REMOTE);
    if (autoRegister) {
      registerCallback(plitziComponent);
    }

    return { default: plitziComponent };
  };
}

export const shared = () => __webpack_require__.S; // eslint-disable-line

export const init = () => {
  const modules = {};
  // eslint-disable-next-line
  if (!__webpack_require__.S || !__webpack_require__.S.default) {
    return modules;
  }

  // const webpackModules = __webpack_require__.S.default; // eslint-disable-line
  // Object.keys(webpackModules)
  //   .filter(mKey => mKey.includes('plitziSdkFederation') && webpackModules[mKey][0] && webpackModules[mKey][0].get)
  //   .forEach(mKey => {
  //     const versions = Object.keys(webpackModules[mKey]);
  //     if (versions.length === 0) {
  //       return;
  //     }

  //     const mVersion = Object.keys(webpackModules[mKey])[0];
  //     if (!webpackModules[mKey][mVersion].get) {
  //       return;
  //     }

  //     const mIdentifier = mKey.includes('plitziSdkFederation') ? `webpack/container/remote/${mKey}` : mKey;
  //     modules[mIdentifier] = module => {
  //       const factory = webpackModules[mKey][mVersion].get();
  //       module.exports = factory();
  //     };
  //   });

  return modules;
};

/**
 * @param {{
 *   url: string;
 *   scope: string;
 *   internalProps: object;
 *   autoRegister: boolean;
 *   plitziJsxSkipHOC: boolean;
 *   plitziCustomComponent: boolean;
 *   plitziJsxProps: object;
 * }} props
 * @returns {React.ReactElement}
 */
const PluginRemote = props => {
  const {
    url = '',
    scope = '',
    internalProps = emptyObject,
    autoRegister = true,
    // Props from JSX
    plitziJsxSkipHOC = false,
    plitziCustomComponent = false,
    plitziJsxProps = emptyObject
  } = props;
  const { register, components } = useContext(ComponentContext);
  const NotFoundNode = useMemo(() => components.notFound, [components]);
  const { ready, failed } = useDynamicScript({ url, shared, init });
  const Component = useMemo(
    () => lazy(loadComponent(url, scope, register, NotFoundNode, autoRegister, plitziJsxSkipHOC)),
    [url, scope]
  );

  if (!ready) {
    return null;
  }

  if ((ready && failed) || !Component) {
    return <NotFoundNode internalProps={internalProps} />;
  }

  if (plitziJsxSkipHOC) {
    return (
      <Suspense>
        <Component
          /* internalProps={internalProps} */
          plitziJsxSkipHOC={plitziJsxSkipHOC}
          {...plitziJsxProps}
          plitziCustomComponent={plitziCustomComponent}
        />
      </Suspense>
    );
  }

  return (
    <Suspense>
      <Component internalProps={internalProps} plitziCustomComponent={plitziCustomComponent} />
    </Suspense>
  );
};

export default PluginRemote;
