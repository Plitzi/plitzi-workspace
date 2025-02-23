/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames';
import { use, useEffect, useMemo } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';
import { emptyObject } from '@plitzi/sdk-shared/utils';

import ComponentContext from '../../../Component/ComponentContext';
import withElement from '../../../Element/hocs/withElement';
import PluginRemote from '../../../Element/PluginRemote';
import RootElement from '../../../Element/RootElement';

import type { ComponentPlugin } from '../../../Component/ComponentContext';
import type { InternalProps } from '@plitzi/sdk-shared';
import type { RefObject } from 'react';

export type CustomProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  internalProps?: InternalProps;
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
  internalProps = emptyObject as InternalProps,
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
  const internalPropsMemo = useMemo<InternalProps>(
    () => ({ ...internalProps, attributes: settingsParsed }),
    [internalProps, settingsParsed]
  );
  const assetsArray = useMemo(() => {
    if (!assets) {
      return [];
    }

    return assets
      .split('\n')
      .filter(asset => !!asset)
      .map(asset => ({
        url: asset
      }));
  }, [assets]);

  useEffect(() => {
    if (Array.isArray(assetsArray) && assetsArray.length === 0) {
      return () => {};
    }

    registerCustomAssets?.(assetsArray);

    return () => {
      unregisterCustomAssets?.(assetsArray.map(asset => asset.url));
    };
  }, [assetsArray, registerCustomAssets, unregisterCustomAssets]);

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
    return <Plugin internalProps={internalPropsMemo} plitziCustomComponent />;
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
