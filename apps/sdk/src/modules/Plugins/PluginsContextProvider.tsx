import { Helmet } from '@dr.pogodin/react-helmet';
import { get, omit, isEmpty } from '@plitzi/plitzi-ui/helpers';
import { useCallback, use, useMemo, useState } from 'react';

import NetworkInternalContext from '@modules/Network/contexts/NetworkInternalContext';
import { getStyle } from '@plitzi/sdk-plugins/PluginHelper';
import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';

import type { Asset, ComponentDefinition, ComponentPlugin, RenderMode } from '@plitzi/sdk-shared';

export type PluginsContextProviderProps = {
  children: React.ReactNode;
  renderMode?: RenderMode;
  plugins?: Record<string, ComponentDefinition>;
  sdkStylePath?: string;
};

const PluginsContextProvider = ({
  children,
  renderMode = 'iframe',
  plugins: pluginsProp,
  sdkStylePath = './plitzi-sdk.css'
}: PluginsContextProviderProps) => {
  const [temporalCustomStyles, setTemporalCustomStyles] = useState<Record<string, Asset>>({});
  const internalData = use(NetworkInternalContext);
  const plugins = useMemo(() => {
    if (pluginsProp) {
      return pluginsProp;
    }

    return internalData.plugins;
  }, [pluginsProp, internalData]);
  const { components } = use(ComponentContext);

  // plugins

  const getPluginSettings = useCallback(
    (pluginType: string, attribute?: string, defaultValue: string | number | boolean = '') => {
      if (!attribute) {
        return get(plugins, `${pluginType}.settings`, {});
      }

      return get(plugins, `${pluginType}.settings.${attribute}`, defaultValue);
    },
    [plugins]
  );

  const registerCustomAssets = useCallback((assets: Asset[] = []) => {
    const assetsProcessed = assets.reduce<Record<string, Asset>>((acum, asset) => {
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

  const unregisterCustomAssets = useCallback((assets: string[] = []) => {
    const keys = assets.filter(asset => !isEmpty(asset)).map(asset => btoa(asset));
    setTemporalCustomStyles(state => omit(state, keys));
  }, []);

  // internal

  const pluginStyleAssets = useMemo(() => getStyle(plugins), [plugins]);

  const pluginCustomStyleAssets = useMemo<Record<string, Asset>>(
    () =>
      Object.keys(components.current)
        .filter(compKey => components.current[compKey].origin === 'local-custom')
        .reduce((acum, compKey) => {
          const assets = get(components, `${compKey}.assets`, []) as ComponentPlugin['assets'];

          return {
            ...acum,
            ...assets.reduce(
              (acum2, asset, i) => ({
                ...acum2,
                [`${compKey}-${i}`]: { type: 'link', id: `${compKey}-${i}`, params: asset }
              }),
              {}
            )
          };
        }, {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [components.current]
  );

  const assetsState = useMemo<Record<string, Asset>>(() => {
    const extraAssets: Record<string, Asset> = {};
    if (renderMode === 'iframe' || renderMode === 'shadow') {
      extraAssets['static-99'] = {
        type: 'link',
        id: 'static-99',
        params: { type: 'text/css', href: sdkStylePath, rel: 'stylesheet' }
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
      <Helmet>{(renderMode === 'raw' || renderMode === 'widget') && helmetAssets}</Helmet>
      <PluginsContext value={pluginsContextValue}>{children}</PluginsContext>
    </>
  );
};

export default PluginsContextProvider;
