/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { use, useEffect, useMemo } from 'react';

import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import PluginRemote from '../../../Element/PluginRemote';
import RootElement from '../../../Element/RootElement';

import type { Asset, ComponentPluginWithHOC, Element } from '@plitzi/sdk-shared';
import type { RefObject } from 'react';

export type CustomProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  renderType?: string;
  settings?: string;
  isPlugin?: boolean;
  pluginScope?: string;
  assets?: string;
  scriptUrl?: string;
};

const Custom = ({
  ref,
  className = '',
  renderType = '',
  settings = '{}',
  isPlugin = false,
  pluginScope = '',
  assets = '',
  scriptUrl = ''
}: CustomProps) => {
  const { id, rootId } = useElement();
  const {
    contexts: { PluginsContext }
  } = usePlitziServiceContext();
  const { registerCustomAssets, unregisterCustomAssets } = use(PluginsContext);
  const { components } = use(ComponentContext);
  const settingsParsed = useMemo<Element['attributes'] | false>(() => {
    if (!settings) {
      return {};
    }

    try {
      return JSON.parse(settings) as Element['attributes'];
    } catch {
      // Nothing here
    }

    return false;
  }, [settings]);
  const settingsMalformed = settingsParsed === false;
  const internalPropsMemo = useMemo(
    () => ({ id, rootId, ...(settingsMalformed ? {} : settingsParsed) }),
    [id, rootId, settingsMalformed, settingsParsed]
  );
  const assetsParsed = useMemo<Asset[]>(() => {
    if (!assets) {
      return [];
    }

    return assets
      .split('\n')
      .filter(asset => !!asset && asset.trim() !== '')
      .map(url => {
        if (url.endsWith('.js')) {
          const asset: Asset = { id: url, type: 'script', params: { src: url, type: 'text/javascript' } };

          return asset;
        }

        const asset: Asset = { id: url, type: 'link', params: { href: url, rel: 'stylesheet', type: 'text/css' } };

        return asset;
      });
  }, [assets]);

  useEffect(() => {
    if (assetsParsed.length === 0) {
      return;
    }

    registerCustomAssets(assetsParsed);

    return () => {
      unregisterCustomAssets(
        assetsParsed.map(asset => (asset.type === 'script' ? asset.params.url : asset.params.href))
      );
    };
  }, [assetsParsed, registerCustomAssets, unregisterCustomAssets]);

  if (isPlugin && scriptUrl && pluginScope && !settingsMalformed) {
    return <PluginRemote url={scriptUrl} scope={pluginScope} internalProps={internalPropsMemo} autoRegister={false} />;
  }

  const Plugin = components.current[renderType] as ComponentPluginWithHOC | undefined;
  if (Plugin && !settingsMalformed) {
    return <Plugin internalProps={internalPropsMemo} extraProps={Plugin.extraProps} />;
  }

  return (
    <RootElement ref={ref} className={clsx('plitzi-component__custom', className)}>
      {renderType && !settingsMalformed && (
        <span>
          Custom Component <b>{renderType}</b> Not Found
        </span>
      )}
      {settingsMalformed && <span>Settings Malformed</span>}
      {!renderType && <span>Custom Component</span>}
    </RootElement>
  );
};

export default withElement(Custom);

export { Custom };
