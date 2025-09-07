import get from 'lodash/get';
import { memo, useCallback, use, useMemo } from 'react';

import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import PluginRemote from './PluginRemote';

import type { InternalPropsSTG0, InternalPropsSTG1, ComponentPlugin } from '@plitzi/sdk-shared';

export type PluginManagerProps = {
  plitziElementLayout?: InternalPropsSTG1['plitziElementLayout'];
  type: string;
  internalProps: InternalPropsSTG0;
};

const PluginManager = ({ plitziElementLayout = undefined, type = '', internalProps }: PluginManagerProps) => {
  const { components } = use(ComponentContext);
  const internalPropsMemo = useMemo<InternalPropsSTG1>(
    () => ({ ...internalProps, plitziElementLayout }),
    [plitziElementLayout, internalProps]
  );
  const {
    contexts: { PluginsContext }
  } = usePlitziServiceContext();
  const { plugins } = use(PluginsContext);
  const PluginNotFound = useMemo(() => {
    const PluginInternal = components.notFound;

    return <PluginInternal internalProps={internalPropsMemo} />;
  }, [components.notFound, internalPropsMemo]);

  const getParentPlugin = useCallback(
    (subPlugin: string) => Object.values(plugins).find(plugin => plugin.subPlugins.find(type => type === subPlugin)),
    [plugins]
  );

  const Plugin = useMemo(() => {
    if (!type) {
      return undefined;
    }

    const PluginInternal = components[type] as ComponentPlugin | undefined;
    if (!PluginInternal) {
      return undefined;
    }

    return <PluginInternal internalProps={internalPropsMemo} className={internalPropsMemo.className} />;
  }, [components, internalPropsMemo, type]);

  const remoteSettings = useMemo(() => {
    const pluginDefinition = (type ? plugins[type] : undefined) ?? getParentPlugin(type);
    if (Plugin || !pluginDefinition) {
      return undefined;
    }

    const pluginAssets = get(pluginDefinition, 'assets', []).filter(asset => asset.type === 'script');
    const { scope } = pluginDefinition;

    return {
      url: pluginAssets.find(asset => asset.isMain)?.params.src ?? get(pluginAssets, '0.params.src', ''),
      scope
    };
  }, [Plugin, getParentPlugin, plugins, type]);

  if (!type) {
    return PluginNotFound;
  }

  if (!Plugin && remoteSettings) {
    return <PluginRemote url={remoteSettings.url} scope={remoteSettings.scope} internalProps={internalPropsMemo} />;
  }

  if (!Plugin) {
    return PluginNotFound;
  }

  return Plugin;
};

export default memo(PluginManager);
