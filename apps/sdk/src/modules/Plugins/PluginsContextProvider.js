// Packages
import React, { useCallback, use, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import get from 'lodash/get';
import isEmpty from 'lodash/isEmpty';
import omit from 'lodash/omit';

// Monorepo
import { getStyle } from '@plitzi/sdk-plugins/PluginHelper';
import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';

// Alias
import NetworkInternalContext from '@modules/Network/contexts/NetworkInternalContext';

/**
 * @param {{
 *   children: React.ReactNode;
 *   renderMode?: 'raw' | 'iframe' | 'shadow' | 'ssr' | 'widget';
 *   plugins?: object;
 *   sdkStylePath?: string;
 * }} props
 * @returns {React.ReactElement}
 */
const PluginsContextProvider = props => {
  const { children, renderMode = 'iframe', plugins: pluginsProp, sdkStylePath = './plitzi-sdk.css' } = props;
  const [temporalCustomStyles, setTemporalCustomStyles] = useState({});
  const internalData = use(NetworkInternalContext);
  const plugins = useMemo(() => {
    if (pluginsProp) {
      return pluginsProp;
    }

    return internalData.plugins ?? {};
  }, [pluginsProp, internalData]);
  const { components } = use(ComponentContext);

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
    const assetsProcessed = assets.reduce((acum, asset) => {
      let url = '';
      if (asset.type === 'script') {
        url = asset.params.src;
      } else {
        url = asset.params.href;
      }

      if (!url) {
        return acum;
      }

      url = btoa(url);

      return { ...acum, [url]: { ...asset, key: url } };
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
    if (renderMode === 'iframe' || renderMode === 'shadow') {
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
        {(renderMode === 'raw' || renderMode === 'ssr' || renderMode === 'widget') &&
          helmetAssets}
      </Helmet>
      <PluginsContext value={pluginsContextValue}>{children}</PluginsContext>
    </>
  );
};

export default PluginsContextProvider;
