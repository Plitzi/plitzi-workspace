/* eslint-disable react-hooks/rules-of-hooks */

import camelCase from 'lodash/camelCase';
import get from 'lodash/get';
import { memo, useCallback, use } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';
import { emptyObject } from '@plitzi/sdk-shared/utils';

import PluginRemote from './PluginRemote';
import ComponentContext from '../Component/ComponentContext';

import type { ComponentPlugin } from '../Component/ComponentContext';
import type { Plugin } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type JsxManagerProps = {
  plitziJsxSkipHOC?: boolean;
  plitziJsxType: string;
  plitziJsxProps: Record<string, unknown>;
  children: ReactNode;
};

const JsxManager = ({
  plitziJsxSkipHOC = false,
  plitziJsxType = '',
  plitziJsxProps = emptyObject,
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

    return <PluginRemote url={url} scope={scope} plitziJsxSkipHOC={plitziJsxSkipHOC} plitziJsxProps={plitziJsxProps} />;
  }

  if (!Plugin) {
    Plugin = components.notFound;
  }

  return (
    <Plugin plitziJsxSkipHOC={plitziJsxSkipHOC} {...plitziJsxProps}>
      {children}
    </Plugin>
  );
};

export default memo(JsxManager);
