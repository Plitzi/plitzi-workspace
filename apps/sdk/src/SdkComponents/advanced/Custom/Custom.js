// Packages
import React, { useContext, useEffect, useMemo } from 'react';
import classNames from 'classnames';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import PluginRemote from '@modules/Element/PluginRemote';
import RootElement from '@modules/Element/RootElement';

// Relatives
import ComponentContext from '../../../modules/Component/ComponentContext';
import usePlitziServiceContext from '../../../services/hooks/usePlitziServiceContext';

const Custom = props => {
  const {
    ref,
    className = '',
    internalProps = emptyObject,
    renderType = '',
    settings = '{}',
    isPlugin = false,
    pluginScope = '',
    assets = '',
    scriptUrl = ''
  } = props;
  const {
    contexts: { PluginsContext }
  } = usePlitziServiceContext();
  const { registerCustomAssets, unregisterCustomAssets } = useContext(PluginsContext);
  const { components } = useContext(ComponentContext);
  const settingsParsed = useMemo(() => {
    if (!settings) {
      return {};
    }

    try {
      return JSON.parse(settings);
    } catch (err) {
      console.log(err);
    }

    return {};
  }, [settings]);
  const internalPropsMemo = useMemo(
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

    registerCustomAssets(assetsArray);

    return () => {
      unregisterCustomAssets(assetsArray);
    };
  }, [assetsArray, registerCustomAssets, unregisterCustomAssets]);

  if (isPlugin) {
    return (
      <PluginRemote
        url={scriptUrl}
        scope={pluginScope}
        module="Plugin"
        internalProps={internalPropsMemo}
        failedFallback={components.notFound}
        autoRegister={false}
        plitziCustomComponent
      />
    );
  }

  const Plugin = components[renderType];
  if (Plugin) {
    return <Plugin internalProps={internalPropsMemo} plitziCustomComponent />;
  }

  return (
    <RootElement
      ref={ref}
      internalProps={internalPropsMemo}
      className={classNames('plitzi-component__custom', className)}
    >
      <span>
        Custom Component <b>{renderType}</b> Not Found
      </span>
    </RootElement>
  );
};

export default withElement(Custom);

export { Custom };
