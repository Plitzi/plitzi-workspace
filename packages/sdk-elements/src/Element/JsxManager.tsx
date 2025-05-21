/* eslint-disable react-hooks/rules-of-hooks */

import camelCase from 'lodash/camelCase';
import get from 'lodash/get';
import { memo, useCallback, use } from 'react';

import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import PluginRemote from './PluginRemote';

import type { ComponentPlugin, InternalPropsSTG1, Plugin } from '@plitzi/sdk-shared';
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
  if (!type) {
    return null;
  }

  const getParentPlugin = useCallback(
    (subPlugin: string) => Object.values(plugins).find(plugin => plugin.subPlugins?.find(type => type === subPlugin)),
    [plugins]
  );

  let Plugin = components[type] as ComponentPlugin | undefined;
  const pluginDefinition = (plugins[type] as Plugin | undefined) ?? getParentPlugin(type);
  if (!Plugin && pluginDefinition) {
    const pluginAssets = get(pluginDefinition, 'assets', []).filter(asset => asset.type === 'script');
    const url = get(pluginAssets, '0.url');
    if (!url) {
      return null;
    }

    const { scope } = pluginDefinition;

    return (
      <PluginRemote
        internalProps={internalProps}
        url={url}
        scope={scope}
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
