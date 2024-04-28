// Packages
import React, { memo, useCallback, use } from 'react';
import get from 'lodash/get';
import camelCase from 'lodash/camelCase';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import ComponentContext from '@modules/Component/ComponentContext';

// Relatives
import PluginRemote from './PluginRemote';
import usePlitziServiceContext from '../../services/hooks/usePlitziServiceContext';

/**
 * @param {{
 *   plitziJsxSkipHOC?: boolean;
 *   plitziJsxType: string;
 *   plitziJsxProps: object;
 *   children: React.ReactNode;
 * }} props
 * @returns {React.ReactElement}
 */
const JsxManager = props => {
  const { plitziJsxSkipHOC = false, plitziJsxType = '', plitziJsxProps = emptyObject, children } = props;
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

export default memo(JsxManager);
