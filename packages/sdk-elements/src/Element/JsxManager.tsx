import camelCase from 'lodash/camelCase';
import get from 'lodash/get';
import { memo, useCallback, use, useMemo } from 'react';

import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import PluginRemote from './PluginRemote';

import type { InternalPropsSTG1 } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type JsxManagerProps = {
  plitziJsxSkipHOC?: boolean;
  plitziJsxType: string;
  plitziJsxProps: Record<string, unknown>;
  internalProps: InternalPropsSTG1;
  children: ReactNode;
};

const JsxManager = ({
  plitziJsxSkipHOC = false,
  plitziJsxType = '',
  plitziJsxProps,
  internalProps,
  children
}: JsxManagerProps) => {
  const {
    contexts: { PluginsContext }
  } = usePlitziServiceContext();
  const type = camelCase(plitziJsxType);
  const { components } = use(ComponentContext);
  const { plugins } = use(PluginsContext);

  const getParentPlugin = useCallback(
    (subPlugin: string) => Object.values(plugins).find(plugin => plugin.subPlugins.find(type => type === subPlugin)),
    [plugins]
  );

  let Plugin = type ? components[type] : undefined;
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
    return null;
  }

  if (!Plugin && remoteSettings) {
    return (
      <PluginRemote
        internalProps={internalProps}
        url={remoteSettings.url}
        scope={remoteSettings.scope}
        plitziJsxSkipHOC={plitziJsxSkipHOC}
        plitziJsxProps={plitziJsxProps}
      />
    );
  }

  if (!Plugin) {
    Plugin = components.notFound;
  }

  return (
    <Plugin plitziJsxSkipHOC={plitziJsxSkipHOC} {...plitziJsxProps} internalProps={internalProps}>
      {children}
    </Plugin>
  );
};

export default memo(JsxManager);
