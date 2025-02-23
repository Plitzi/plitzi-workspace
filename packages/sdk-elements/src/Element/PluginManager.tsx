/* eslint-disable react-hooks/rules-of-hooks */

import get from 'lodash/get';
import { memo, useCallback, use, useMemo } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';
import { emptyObject } from '@plitzi/sdk-shared/utils';

import PluginRemote from './PluginRemote';
import ComponentContext from '../Component/ComponentContext';

import type { ComponentPlugin } from '../Component/ComponentContext';
import type { Plugin, BaseInternalProps } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type ElementLayoutType = 'layout' | 'segment' | 'element' | 'reference';

export type PluginManagerProps = {
  id: string;
  rootId: string;
  plitziElementLayout?: {
    bodyChildren: ReactNode;
    containerId: string;
    referenceId: string;
    rootId: string;
    type: ElementLayoutType;
  };
  type: string;
  internalProps?: BaseInternalProps;
};

const PluginManager = ({
  id = '',
  rootId = '',
  plitziElementLayout = undefined,
  type = '',
  internalProps = emptyObject as BaseInternalProps
}: PluginManagerProps) => {
  const { components } = use(ComponentContext);
  const internalPropsMemo = useMemo<BaseInternalProps>(
    () => ({ id, rootId, plitziElementLayout, ...(internalProps as Omit<BaseInternalProps, 'id'>) }),
    [id, rootId, plitziElementLayout, internalProps]
  );
  const {
    contexts: { PluginsContext }
  } = usePlitziServiceContext();
  const { plugins } = use(PluginsContext);
  const PluginNotFound = useMemo(() => {
    const PluginInternal = components.notFound;

    return <PluginInternal internalProps={internalPropsMemo} />;
  }, [components.notFound, internalPropsMemo]);

  if (!type) {
    return PluginNotFound;
  }

  const getParentPlugin = useCallback(
    (subPlugin: string) => Object.values(plugins).find(plugin => plugin.subPlugins?.find(type => type === subPlugin)),
    [plugins]
  );

  const Plugin = useMemo(() => {
    const PluginInternal = components[type] as ComponentPlugin | undefined;
    if (!PluginInternal) {
      return undefined;
    }

    return <PluginInternal internalProps={internalPropsMemo} className={internalPropsMemo.className} />;
  }, [components, internalPropsMemo, type]);

  const pluginDefinition = (plugins[type] as Plugin | undefined) ?? getParentPlugin(type);
  if (!Plugin && pluginDefinition) {
    const pluginAssets = get(pluginDefinition, 'assets', []).filter(asset => asset.type === 'script');
    const url = get(pluginAssets, '0.url');
    if (!url) {
      return undefined;
    }

    const { scope } = pluginDefinition;

    return <PluginRemote url={url} scope={scope} internalProps={internalPropsMemo} />;
  }

  if (!Plugin) {
    return PluginNotFound;
  }

  return Plugin;
};

export default memo(PluginManager);
