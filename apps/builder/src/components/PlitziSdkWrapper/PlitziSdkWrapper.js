// Packages
import React, { useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import PlitziSdk from '@plitzi/plitzi-sdk';

// Monorepo
import SchemaContext from '@repo/schema-shared/SchemaContext';

// Alias
import NetworkContext from '@pmodules/Network/NetworkContext';
import StyleContext from '@pmodules/Style/StyleContext';
import PluginsContext from '@pmodules/Plugins/PluginsContext';

const PlitziSdkWrapper = props => {
  const { currentPageId, className = '', renderMode = 'iframe', previewMode = true } = props;
  const { schema } = useContext(SchemaContext);
  const { style } = useContext(StyleContext);
  const { plugins } = useContext(PluginsContext);
  const { webKey, server } = useContext(NetworkContext);

  const offlineDataMemo = useMemo(() => {
    if (renderMode === 'iframe') {
      return null;
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

PlitziSdkWrapper.propTypes = {
  className: PropTypes.string,
  renderMode: PropTypes.oneOf(['iframe', 'sdk']),
  currentPageId: PropTypes.string,
  previewMode: PropTypes.bool
};

export default PlitziSdkWrapper;
