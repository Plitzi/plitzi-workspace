import { get } from '@plitzi/plitzi-ui/helpers';

import PluginRemote from '../PluginRemote';

import type { ComponentDefinition, ComponentPluginWithHOC, InternalPropsSTG1 } from '@plitzi/sdk-shared';

export type pluginSelectorProps = {
  // Component Props
  key?: string;
  type: string;
  /**
   * What the element is handed, as it is: kept by whoever draws it (`useInternalItems` keeps one per element), so an
   * element whose parent draws again is handed the same object and has nothing new to draw.
   */
  internalProps: InternalPropsSTG1;
  // Extra Props
  components: Partial<Record<string, ComponentPluginWithHOC>>;
  plugins: Record<string, ComponentDefinition>;
};

export const getParentPlugin = (plugins: Record<string, ComponentDefinition>, subPlugin: string) =>
  Object.values(plugins).find(plugin => plugin.subPlugins.find(type => type === subPlugin));

export const getRemoteSettings = ({
  type,
  plugins
}: {
  type: string;
  plugins: Record<string, ComponentDefinition>;
}) => {
  const pluginDefinition = (type ? plugins[type] : undefined) ?? getParentPlugin(plugins, type);
  if (!pluginDefinition) {
    return undefined;
  }

  const pluginAssets = get(pluginDefinition, 'assets', []).filter(asset => asset.type === 'script');

  return {
    url: pluginAssets.find(asset => asset.isMain)?.params.src ?? get(pluginAssets, '0.params.src', '')
  };
};

const pluginSelector = ({ key, type, internalProps, components, plugins }: pluginSelectorProps) => {
  const PluginNotFound = components.notFound ? (
    <components.notFound key={key} internalProps={internalProps} />
  ) : undefined;
  if (!type) {
    return PluginNotFound;
  }

  const PluginInternal = components[type];
  if (PluginInternal) {
    return <PluginInternal key={key} internalProps={internalProps} extraProps={PluginInternal.extraProps} />;
  }

  const remoteSettings = getRemoteSettings({ type, plugins });
  if (remoteSettings) {
    return <PluginRemote key={key} url={remoteSettings.url} type={type} internalProps={internalProps} />;
  }

  return PluginNotFound;
};

export default pluginSelector;
