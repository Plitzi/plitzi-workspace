import { get } from '@plitzi/plitzi-ui/helpers';

import PluginRemote from '../PluginRemote';

import type {
  ComponentDefinition,
  ComponentPluginWithHOC,
  ElementLayout,
  InternalPropsSTG0,
  InternalPropsSTG1
} from '@plitzi/sdk-shared';
import type { JSX } from 'react';

export type pluginSelectorProps = {
  // Component Props
  key?: string;
  plitziElementLayout?: ElementLayout;
  type: string;
  internalProps: InternalPropsSTG0;
  // Extra Props
  components: Partial<Record<string, ComponentPluginWithHOC>>;
  plugins: Record<string, ComponentDefinition>;
};

const getParentPlugin = (plugins: Record<string, ComponentDefinition>, subPlugin: string) =>
  Object.values(plugins).find(plugin => plugin.subPlugins.find(type => type === subPlugin));

const getRemoteSettings = ({ type, plugins }: { type: string; plugins: Record<string, ComponentDefinition> }) => {
  const pluginDefinition = (type ? plugins[type] : undefined) ?? getParentPlugin(plugins, type);
  if (!pluginDefinition) {
    return undefined;
  }

  const pluginAssets = get(pluginDefinition, 'assets', []).filter(asset => asset.type === 'script');
  const { scope } = pluginDefinition;

  return {
    url: pluginAssets.find(asset => asset.isMain)?.params.src ?? get(pluginAssets, '0.params.src', ''),
    scope
  };
};

const pluginSelector = ({
  key,
  plitziElementLayout,
  type,
  internalProps: internalPropsProp,
  components,
  plugins
}: pluginSelectorProps) => {
  const internalProps = { ...internalPropsProp, plitziElementLayout } satisfies InternalPropsSTG1;
  const PluginNotFound = components.notFound ? (
    <components.notFound key={key} internalProps={internalProps} />
  ) : undefined;
  if (!type) {
    return PluginNotFound as JSX.Element;
  }

  const PluginInternal = components[type];
  if (PluginInternal) {
    return <PluginInternal key={key} internalProps={internalProps} extraProps={PluginInternal.extraProps} />;
  }

  const remoteSettings = getRemoteSettings({ type, plugins });
  if (remoteSettings) {
    return (
      <PluginRemote key={key} url={remoteSettings.url} scope={remoteSettings.scope} internalProps={internalProps} />
    );
  }

  return PluginNotFound as JSX.Element;
};

export default pluginSelector;
