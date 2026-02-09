import get from 'lodash-es/get.js';
import { lazy, Suspense, use, useMemo } from 'react';

import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';

import { nestedInject } from '../Component/ComponentHelper';
import { generatePluginModule } from './helpers/elementUtils';
import withElement from './hocs/withElement';
import useDynamicScript from './hooks/useDynamicScript';

import type { ComponentContextValue, ComponentPlugin, InternalPropsSTG1 } from '@plitzi/sdk-shared';

function loadComponent(
  url: string,
  isESM: boolean,
  pluginScope: string,
  registerCallback: ComponentContextValue['register'],
  NotFoundNode: ComponentPlugin,
  autoRegister = true,
  plitziJsxSkipHOC = false
) {
  return async () => {
    // Based on ES6 Module
    const Module = await generatePluginModule(url, isESM, pluginScope);
    if (!Module) {
      return { default: NotFoundNode };
    }

    // Register module into Components context cache
    const { type, pluginSettings } = get(Module, 'default', {} as ComponentPlugin);
    const { version, initialItems, plugins } = Module;
    if (!type) {
      return { default: NotFoundNode };
    }

    let plitziComponent = Module.default;
    if (!plitziJsxSkipHOC) {
      plitziComponent = withElement(Module.default) as ComponentPlugin;
    }

    plitziComponent.version = version;
    plitziComponent.origin = 'remote';
    plitziComponent.type = type;
    plitziComponent.initialItems = initialItems;
    plitziComponent.pluginSettings = pluginSettings;
    plitziComponent.plugins = nestedInject(plugins, 'remote');
    if (autoRegister) {
      registerCallback(plitziComponent);
    }

    return { default: plitziComponent };
  };
}

export type PluginRemoteProps = {
  url: string;
  scope: string;
  internalProps: InternalPropsSTG1;
  autoRegister?: boolean;
  plitziJsxSkipHOC?: boolean;
  plitziJsxProps?: Record<string, unknown>;
};

const PluginRemote = ({
  url = '',
  scope = '',
  internalProps,
  autoRegister = true,
  // Props from JSX
  plitziJsxSkipHOC = false,
  plitziJsxProps = emptyObject
}: PluginRemoteProps) => {
  const { register, components } = use(ComponentContext);
  const NotFoundNode = useMemo(() => components.notFound, [components]);
  const isESM = url.endsWith('.mjs') || url.includes('.esm.') || url.includes('.module.');
  const { ready, failed } = useDynamicScript({ url, type: isESM ? 'module' : 'text/javascript' });
  const Component = useMemo(
    () => lazy(loadComponent(url, isESM, scope, register, NotFoundNode, autoRegister, plitziJsxSkipHOC)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [url, scope, isESM]
  );

  if (!ready) {
    return null;
  }

  if (failed) {
    return <NotFoundNode internalProps={internalProps} />;
  }

  if (plitziJsxSkipHOC) {
    return (
      <Suspense>
        <Component internalProps={internalProps} plitziJsxSkipHOC={plitziJsxSkipHOC} {...plitziJsxProps} />
      </Suspense>
    );
  }

  return (
    <Suspense>
      <Component internalProps={internalProps} />
    </Suspense>
  );
};

export default PluginRemote;
