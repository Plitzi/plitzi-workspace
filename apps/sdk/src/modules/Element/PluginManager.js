// Packages
import React, { memo, useCallback, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import get from 'lodash/get';

// Alias
import ComponentContext from '@modules/Component/ComponentContext';

// Relatives
import PluginRemote from './PluginRemote';
import usePlitziServiceContext from '../../services/hooks/usePlitziServiceContext';
import { emptyObject } from '../../helpers/utils';

const PluginManager = props => {
  const { id = '', rootId = '', plitziElementLayout = undefined, type = '', internalProps = emptyObject } = props;
  const { components } = useContext(ComponentContext);
  const internalPropsMemo = useMemo(
    () => ({ id, rootId, plitziElementLayout, ...internalProps }),
    [id, rootId, plitziElementLayout, internalProps]
  );
  const {
    contexts: { PluginsContext }
  } = usePlitziServiceContext();
  const { plugins } = useContext(PluginsContext);
  const PluginNotFound = useMemo(() => {
    const PluginInternal = components.notFound;

    return <PluginInternal internalProps={internalPropsMemo} />;
  }, [components.notFound]);

  if (!type) {
    return PluginNotFound;
  }

  const getParentPlugin = useCallback(
    subPlugin => Object.values(plugins).find(plugin => plugin.subPlugins.find(type => type === subPlugin)),
    [plugins]
  );

  const Plugin = useMemo(() => {
    if (!components[type]) {
      return undefined;
    }

    const PluginInternal = components[type];

    return <PluginInternal internalProps={internalPropsMemo} className={internalPropsMemo?.className} />;
  }, [components[type], internalPropsMemo]);

  const pluginDefinition = plugins[type] ?? getParentPlugin(type);
  if (!Plugin && pluginDefinition) {
    const pluginAssets = get(pluginDefinition, 'assets', []).filter(asset => asset.type === 'script');
    const url = get(pluginAssets, '0.url');
    if (!url) {
      return undefined;
    }

    const { scope, module } = pluginDefinition;

    return (
      <PluginRemote
        url={url}
        scope={scope}
        module={module}
        internalProps={internalPropsMemo}
        className={internalPropsMemo?.className}
        failedFallback={components.notFound}
      />
    );
  }

  if (!Plugin) {
    return PluginNotFound;
  }

  return Plugin;
};

PluginManager.propTypes = {
  id: PropTypes.string,
  rootId: PropTypes.string,
  plitziElementLayout: PropTypes.object,
  type: PropTypes.string,
  internalProps: PropTypes.object
};

export default memo(PluginManager);
