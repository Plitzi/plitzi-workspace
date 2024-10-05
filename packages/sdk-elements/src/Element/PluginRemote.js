// Packages
import React, { lazy, Suspense, use, useMemo } from 'react';
import get from 'lodash/get';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import ComponentContext from '../Component/ComponentContext';
import { nestedInject, ORIGIN_REMOTE } from '../Component/ComponentHelper';
import withElement from './hocs/withElement'; // eslint-disable-line import/no-cycle
import { generatePluginModule } from './helpers/elementUtils';
import useDynamicScript from './hooks/useDynamicScript';

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
  const { register, components } = use(ComponentContext);
  const NotFoundNode = useMemo(() => components.notFound, [components]);
  const { ready, failed } = useDynamicScript({ url });
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
