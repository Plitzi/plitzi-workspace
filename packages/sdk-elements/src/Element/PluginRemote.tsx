import get from 'lodash/get';
import { lazy, Suspense, use, useMemo } from 'react';

import { emptyObject } from '@plitzi/sdk-shared/utils';

import ComponentContext from '../Component/ComponentContext';
import { nestedInject, ORIGIN_REMOTE } from '../Component/ComponentHelper';
import { generatePluginModule } from './helpers/elementUtils';
import withElement from './hocs/withElement';
import useDynamicScript from './hooks/useDynamicScript';

import type { ComponentContextValue, ComponentPlugin } from '../Component/ComponentContext';
import type { BaseInternalProps } from '@plitzi/sdk-shared';

function loadComponent(
  url: string,
  pluginScope: string,
  registerCallback: ComponentContextValue['register'],
  NotFoundNode: ComponentPlugin,
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

export type PluginRemoteProps = {
  url: string;
  scope: string;
  internalProps?: BaseInternalProps;
  autoRegister?: boolean;
  plitziJsxSkipHOC?: boolean;
  plitziCustomComponent?: boolean;
  plitziJsxProps?: Record<string, unknown>;
};

const PluginRemote = ({
  url = '',
  scope = '',
  internalProps = emptyObject as BaseInternalProps,
  autoRegister = true,
  // Props from JSX
  plitziJsxSkipHOC = false,
  plitziCustomComponent = false,
  plitziJsxProps = emptyObject
}: PluginRemoteProps) => {
  const { register, components } = use(ComponentContext);
  const NotFoundNode = useMemo(() => components.notFound, [components]);
  const { ready, failed } = useDynamicScript({ url });
  const Component = useMemo(
    () => lazy(loadComponent(url, scope, register, NotFoundNode, autoRegister, plitziJsxSkipHOC)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [url, scope]
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
