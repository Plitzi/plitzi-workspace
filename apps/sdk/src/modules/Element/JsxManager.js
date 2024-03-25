// Packages
import React, { memo, useCallback, useContext } from 'react';
import PropTypes from 'prop-types';
import get from 'lodash/get';
import camelCase from 'lodash/camelCase';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import ComponentContext from '@modules/Component/ComponentContext';

// Relatives
import PluginRemote from './PluginRemote';
import usePlitziServiceContext from '../../services/hooks/usePlitziServiceContext';

const JsxManager = props => {
  const { plitziJsxSkipHOC = false, plitziJsxType = '', plitziJsxProps = emptyObject, children } = props;
  const {
    contexts: { PluginsContext }
  } = usePlitziServiceContext();
  const type = camelCase(plitziJsxType);
  const { components } = useContext(ComponentContext);
  const { plugins } = useContext(PluginsContext);
  if (!type) {
    return null;
  }

  const getParentPlugin = useCallback(
    subPlugin => Object.values(plugins).find(plugin => plugin.subPlugins.find(type => type === subPlugin)),
    [plugins]
  );

  let Plugin = components[type];
  const pluginDefinition = plugins[type] ?? getParentPlugin(type);
  if (!Plugin && pluginDefinition) {
    const pluginAssets = get(pluginDefinition, 'assets', []).filter(asset => asset.type === 'script');
    const url = get(pluginAssets, '0.url');
    if (!url) {
      return null;
    }

    const { scope, module } = pluginDefinition;

    return (
      <PluginRemote
        url={url}
        scope={scope}
        module={module}
        failedFallback={components.notFound}
        plitziJsxSkipHOC={plitziJsxSkipHOC}
        plitziJsxProps={plitziJsxProps}
      />
    );
  }

  if (!Plugin) {
    Plugin = components.notFound;
  }

  if (!Plugin) {
    return null;
  }

  return (
    <Plugin plitziJsxSkipHOC={plitziJsxSkipHOC} {...plitziJsxProps}>
      {children}
    </Plugin>
  );
};

JsxManager.propTypes = {
  children: PropTypes.node,
  // Props from JSX
  plitziJsxSkipHOC: PropTypes.bool,
  plitziJsxType: PropTypes.string,
  plitziJsxProps: PropTypes.object
};

export default memo(JsxManager);
