// Packages
import React, { useCallback, useContext, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Helmet } from 'react-helmet-async';
import get from 'lodash/get';
import isEmpty from 'lodash/isEmpty';
import omit from 'lodash/omit';

// Monorepo
import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';

// Alias
import ComponentContext from '@modules/Component/ComponentContext';
import NetworkInternalContext from '@modules/Network/contexts/NetworkInternalContext';
import {
  RENDER_MODE_IFRAME,
  RENDER_MODE_RAW,
  RENDER_MODE_SHADOW,
  RENDER_MODE_SSR,
  RENDER_MODE_WIDGET
} from '@modules/Sdk/Sdk';

const PluginsContextProvider = props => {
  const { children, renderMode = RENDER_MODE_IFRAME, plugins: pluginsProp, sdkStylePath = './plitzi-sdk.css' } = props;
  const [temporalCustomStyles, setTemporalCustomStyles] = useState({});
  const internalData = useContext(NetworkInternalContext);
  const plugins = useMemo(() => {
    if (pluginsProp) {
      return pluginsProp;
    }

    return internalData.plugins ?? {};
  }, [pluginsProp, internalData]);
  const { components } = useContext(ComponentContext);

  // plugins

  const getPluginSettings = useCallback(
    (pluginType, attribute = null, defaultValue = '') => {
      if (!attribute) {
        return get(plugins, `${pluginType}.settings`, {});
      }

      return get(plugins, `${pluginType}.settings.${attribute}`, defaultValue);
    },
    [plugins]
  );

  const registerCustomAssets = useCallback((assets = []) => {
    const assetsProcessed = assets
      .filter(asset => !isEmpty(asset?.url))
      .reduce((acum, asset) => {
        const isScript = asset?.url?.endsWith('.js');
        let assetToAdd = {};
        if (isScript) {
          assetToAdd = {
            type: 'script',
            key: btoa(asset?.url),
            params: { src: asset?.url, type: 'text/javascript', ...omit(asset, ['url']) }
          };
        } else {
          assetToAdd = {
            type: 'link',
            key: btoa(asset?.url),
            params: { href: asset?.url, rel: 'stylesheet', type: 'text/css', ...omit(asset, ['url']) }
          };
        }

        return { ...acum, [btoa(asset?.url)]: assetToAdd };
      }, {});
    if (Object.keys(assetsProcessed).length === 0) {
      return;
    }

    setTemporalCustomStyles(state => ({ ...state, ...assetsProcessed }));
  }, []);

  const unregisterCustomAssets = useCallback((assets = []) => {
    const keys = assets.filter(asset => !isEmpty(asset)).map(asset => btoa(asset));
    setTemporalCustomStyles(state => omit(state, keys));
  }, []);

  // internal

  const getStyle = plugins => {
    return Object.values(plugins).reduce(
      (acum, plugin) => ({
        ...acum,
        ...get(plugin, 'assets', [])
          .filter(asset => asset.type === 'style')
          .reduce((acum2, asset) => {
            const { url } = asset;
            const urlEncoded = btoa(url);

            return {
              ...acum2,
              [urlEncoded]: {
                type: 'link',
                key: urlEncoded,
                params: { href: url, rel: 'stylesheet', type: 'text/css' }
              }
            };
          }, {})
      }),
      {}
    );
  };

  const pluginStyleAssets = useMemo(() => getStyle(plugins), [plugins]);

  const pluginCustomStyleAssets = useMemo(
    () =>
      Object.keys(components)
        .filter(compKey => components[compKey].origin === 'local-custom')
        .reduce(
          (acum, compKey) => ({
            ...acum,
            ...get(components, `${compKey}.assets`, []).reduce(
              (acum, asset, i) => ({
                ...acum,
                [`${compKey}-${i}`]: { type: 'link', id: `${compKey}-${i}`, params: asset }
              }),
              {}
            )
          }),
          {}
        ),
    [plugins]
  );

  const assetsState = useMemo(() => {
    const extraAssets = {};
    if (renderMode === RENDER_MODE_IFRAME || renderMode === RENDER_MODE_SHADOW) {
      extraAssets['static-99'] = {
        type: 'link',
        id: 'static-99',
        params: {
          type: 'text/css',
          href: sdkStylePath,
          rel: 'stylesheet'
        }
      };
    }

    return {
      'static-1': {
        type: 'link',
        id: 'static-1',
        params: {
          type: 'text/css',
          href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css',
          rel: 'stylesheet'
        }
      },
      'static-2': {
        type: 'link',
        id: 'static-2',
        params: {
          type: 'text/css',
          href: 'https://fonts.googleapis.com/css?family=Rubik:400|Bitter:400|Changa One:400|Droid Sans:400|Droid Serif:400|Exo:400|Great Vibes:400|Inconsolata:400|Lato:400|Merriweather:400|Montserrat:400|Open Sans:400|Oswald:400|PT Sans:400|PT Serif:400|Ubuntu:400|Varela:400|Varela Round:400|Vollkorn:400&amp;text=RubikBterChang ODodSsfExGVIclLMwpPTU',
          rel: 'stylesheet'
        }
      },
      ...extraAssets,
      ...pluginCustomStyleAssets,
      ...pluginStyleAssets,
      ...temporalCustomStyles
    };
  }, [pluginCustomStyleAssets, pluginStyleAssets, temporalCustomStyles, renderMode, sdkStylePath]);

  const pluginsContextValue = useMemo(
    () => ({
      assets: assetsState,
      getSettings: getPluginSettings,
      plugins,
      registerCustomAssets,
      unregisterCustomAssets
    }),
    [assetsState, getPluginSettings, plugins, registerCustomAssets, unregisterCustomAssets]
  );

  const helmetAssets = useMemo(
    () =>
      Object.values({ ...pluginStyleAssets, ...temporalCustomStyles }).map((asset, i) => (
        <asset.type key={i} {...asset.params} />
      )),
    [pluginStyleAssets, temporalCustomStyles]
  );

  return (
    <>
      <Helmet>
        {(renderMode === RENDER_MODE_RAW || renderMode === RENDER_MODE_SSR || renderMode === RENDER_MODE_WIDGET) &&
          helmetAssets}
      </Helmet>
      <PluginsContext.Provider value={pluginsContextValue}>{children}</PluginsContext.Provider>
    </>
  );
};

PluginsContextProvider.propTypes = {
  children: PropTypes.node,
  plugins: PropTypes.object,
  renderMode: PropTypes.oneOf([
    RENDER_MODE_IFRAME,
    RENDER_MODE_RAW,
    RENDER_MODE_SHADOW,
    RENDER_MODE_SSR,
    RENDER_MODE_WIDGET
  ]),
  sdkStylePath: PropTypes.string
};

export default PluginsContextProvider;
