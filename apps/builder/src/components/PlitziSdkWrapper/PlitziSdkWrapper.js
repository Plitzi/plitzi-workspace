// Packages
import React, { useContext, useMemo } from 'react';
import classNames from 'classnames';
import PlitziSdk from '@plitzi/plitzi-sdk';

// Monorepo
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';
import StyleContext from '@plitzi/sdk-style/StyleContext';
import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';

// Alias
import NetworkContext from '@pmodules/Network/NetworkContext';

/**
 * @param {{
 *   currentPageId: string;
 *   className?: string;
 *   renderMode?: 'iframe' | 'sdk';
 *   previewMode?: boolean;
 * }} props
 * @returns {React.ReactElement}
 */
const PlitziSdkWrapper = props => {
  const { currentPageId, className = '', renderMode = 'iframe', previewMode = true } = props;
  const { schema } = useContext(SchemaContext);
  const { style } = useContext(StyleContext);
  const { plugins } = useContext(PluginsContext);
  const { webKey, server } = useContext(NetworkContext);

  const offlineDataMemo = useMemo(() => {
    if (renderMode === 'iframe') {
      return undefined;
    }

    return {
      style,
      plugins: Object.keys(plugins).map(pluginKey => {
        const { type, module, assets, scope, settings, subPlugins } = plugins[pluginKey];

        return {
          plugin: { type },
          revisionInstalled: { assets, scope, module },
          settings,
          subPlugins
        };
      }),
      schema: { ...schema, flat: Object.values(schema.flat) }
    };
  }, [style, plugins, schema, renderMode]);

  if (renderMode === 'iframe') {
    return (
      <iframe
        title={currentPageId}
        src={`${server.ssrServer}/${currentPageId}?access-token=${webKey}&preview-mode=${previewMode ? '1' : '0'}`}
        className={classNames('overflow-hidden pointer-events-none select-none', className)}
      />
    );
  }

  return (
    <PlitziSdk
      className={className}
      offlineMode
      currentPageId={currentPageId}
      webKey={webKey}
      previewMode={false}
      server={server}
      externalStyle="body{overflow:hidden; pointer-events: none; user-select: none}"
      offlineData={offlineDataMemo}
    />
  );
};

export default PlitziSdkWrapper;
