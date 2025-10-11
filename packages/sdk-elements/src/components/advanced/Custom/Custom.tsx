/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames';
import { use, useEffect, useMemo } from 'react';

import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import withElement from '../../../Element/hocs/withElement';
import PluginRemote from '../../../Element/PluginRemote';
import RootElement from '../../../Element/RootElement';

import type { Asset, ComponentPlugin, InternalPropsSTG2 } from '@plitzi/sdk-shared';
import type { RefObject } from 'react';

export type CustomProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  internalProps: InternalPropsSTG2;
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
  internalProps,
  renderType = '',
  settings = '{}',
  isPlugin = false,
  pluginScope = '',
  assets = '',
  scriptUrl = ''
}: CustomProps) => {
  const {
    contexts: { PluginsContext }
  } = usePlitziServiceContext();
  const { registerCustomAssets, unregisterCustomAssets } = use(PluginsContext);
  const { components } = use(ComponentContext);
  const settingsParsed = useMemo(() => {
    if (!settings) {
      return {};
    }

    try {
      return JSON.parse(settings) as Record<string, unknown>;
    } catch {
      // Nothing here
    }

    return {};
  }, [settings]);
  const internalPropsMemo = useMemo<InternalPropsSTG2>(
    () => ({ ...internalProps, attributes: settingsParsed }),
    [internalProps, settingsParsed]
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
          return { id: url, type: 'script', params: { src: url, type: 'text/javascript' } } as Asset;
        }

        return { id: url, type: 'link', params: { href: url, rel: 'stylesheet', type: 'text/css' } } as Asset;
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

  if (isPlugin && scriptUrl && pluginScope) {
    return (
      <PluginRemote
        url={scriptUrl}
        scope={pluginScope}
        internalProps={internalPropsMemo}
        autoRegister={false}
        plitziCustomComponent
      />
    );
  }

  const Plugin = components[renderType] as ComponentPlugin | undefined;
  if (Plugin) {
    return <Plugin internalProps={internalPropsMemo} plitziCustomComponent extraProps={Plugin.extraProps} />;
  }

  return (
    <RootElement
      ref={ref}
      internalProps={internalPropsMemo}
      className={classNames('plitzi-component__custom', className)}
    >
      {renderType && (
        <span>
          Custom Component <b>{renderType}</b> Not Found
        </span>
      )}
      {!renderType && <span>Custom Component</span>}
    </RootElement>
  );
};

export default withElement(Custom);

export { Custom };
