import { useToast } from '@plitzi/plitzi-ui/Toast';
import debounce from 'lodash-es/debounce';
import get from 'lodash-es/get';
import { useCallback, use, useEffect, useRef, useState } from 'react';

import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';

import PluginDetails from './PluginDetails';
import PluginList from './PluginList';
import PluginsFilter from './PluginsFilter';
import { parsePlugin } from '../../helpers/PluginHelper';

import type { PageInfo } from '@plitzi/sdk-shared';
import type { MarketPlacePlugin, MarketPlacePluginRaw } from '@pmodules/Marketplace/types';

const MarketPlugins = () => {
  const [filter, setFilter] = useState({ name: { contains: '' }, owner: { contains: '' } });
  const [loading, setLoading] = useState(true);
  const [pluginSelected, setPluginSelected] = useState<MarketPlacePlugin | undefined>(undefined);
  const { addToast } = useToast();
  const [data, setData] = useState<{
    cursor: string;
    hasNextPage: boolean;
    plugins: Record<string, MarketPlacePluginRaw>;
  }>({ cursor: '', hasNextPage: false, plugins: {} });
  const pluginsContext = use(PluginsContext);
  const { plugins: pluginsInstalled } = pluginsContext;

  useEffect(() => {
    if (!pluginSelected) {
      void fetch({ name: { contains: '' }, owner: { contains: '' } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pluginSelected]);

  const handleClickItem = useCallback(
    (pluginType: string) => {
      if (!pluginType) {
        setPluginSelected(undefined);

        return;
      }

      setPluginSelected(parsePlugin(data.plugins[pluginType]));
    },
    [setPluginSelected, data]
  );

  const fetch = async (search: object, more = false) => {
    setLoading(true);
    const result = await pluginsContext.fetch?.(search, data.cursor, 20);
    if (result) {
      const { pageInfo, edges } = result as { pageInfo: PageInfo; edges: MarketPlacePluginRaw[] };
      if (!edges.length) {
        setLoading(false);

        return;
      }

      const plugins = edges.reduce<Record<string, MarketPlacePluginRaw>>(
        (acum, plugin) => ({
          ...acum,
          [plugin.type]: {
            ...plugin,
            version: get(pluginsInstalled, `${plugin.type}.version`, '')
          } as MarketPlacePluginRaw
        }),
        {}
      );
      setData({
        cursor: pageInfo.nextCursor,
        hasNextPage: pageInfo.hasNextPage,
        plugins: (more ? { ...data.plugins, plugins } : plugins) as Record<string, MarketPlacePluginRaw>
      });
      setLoading(false);
    }
  };

  const fetchDebounce = useRef(debounce(fetch, 350));

  const handleChangeFilter = useCallback(
    (value: string, type = 'name') => {
      setFilter(state => {
        const newFilter = { ...state, [type]: { contains: value } };
        void fetchDebounce.current(newFilter);

        return newFilter;
      });
      setData({ cursor: '', hasNextPage: false, plugins: {} });
    },
    [setFilter, setData, fetchDebounce]
  );

  const onAdd = useCallback(
    async (version: string) => {
      if (!pluginSelected) {
        return false;
      }

      const { name, type, revisions } = pluginSelected;
      const assets = revisions.find(revision => revision.version === version);
      if (!assets) {
        addToast(
          <div>
            Plugin <b>{`${name} ${version}`}</b> Cant be added, Assets missing
          </div>,
          { appeareance: 'error', autoDismiss: true, placement: 'top-right' }
        );

        return false;
      }

      if (await pluginsContext.add?.(type, version)) {
        addToast(
          <div>
            Plugin <b>{`${name} ${version}`}</b> Added
          </div>,
          {
            appeareance: 'success',
            autoDismiss: true,
            placement: 'top-right'
          }
        );

        setPluginSelected(state => ({ ...state, version }) as MarketPlacePlugin);

        return true;
      }

      return false;
    },
    [addToast, pluginSelected, pluginsContext]
  );

  const onUpdate = useCallback(async (version: string) => {
    console.log('Update to', version);

    return await Promise.resolve(false);
    // if (!pluginSelected) {
    //   return false;
    // }

    // const { name, type, revisions } = pluginSelected;
    // const assets = revisions.find(revision => revision.version === version);
    // if (!assets) {
    //   return false;
    // }

    // const pluginInstalled = pluginsInstalled[type];
    // if (version === pluginInstalled.versionInstalled) {
    //   return false;
    // }

    // if (await pluginsContext.update?.(type, version)) {
    //   addToast(
    //     <div>
    //       Plugin <b>{`${name} ${version}`}</b> Updated
    //     </div>,
    //     {
    //       appeareance: 'success',
    //       autoDismiss: true,
    //       placement: 'top-right'
    //     }
    //   );

    //   setPluginSelected(state => ({ ...state, version }) as MarketPlacePlugin);

    //   return true;
    // }

    // return false;
  }, []);

  const onRemove = useCallback(async () => {
    if (!pluginSelected) {
      return false;
    }

    const { type, name, version } = pluginSelected;
    if (await pluginsContext.remove?.(type)) {
      addToast(
        <div>
          Plugin <b>{`${name} ${version}`}</b> Removed
        </div>,
        {
          appeareance: 'success',
          autoDismiss: true,
          placement: 'top-right'
        }
      );

      setPluginSelected(state => ({ ...state, version: '' }) as MarketPlacePlugin);

      return true;
    }

    return false;
  }, [addToast, pluginSelected, pluginsContext]);

  return (
    <div className="flex grow basis-0 flex-col">
      {!pluginSelected && <PluginsFilter filter={filter} onChange={handleChangeFilter} />}
      {!loading && (
        <>
          {!pluginSelected && <PluginList onClick={handleClickItem} plugins={Object.values(data.plugins)} />}
          {pluginSelected && (
            <PluginDetails
              {...pluginSelected}
              setPluginSelected={setPluginSelected}
              onAdd={onAdd}
              onUpdate={onUpdate}
              onRemove={onRemove}
            />
          )}
        </>
      )}
    </div>
  );
};

export default MarketPlugins;
