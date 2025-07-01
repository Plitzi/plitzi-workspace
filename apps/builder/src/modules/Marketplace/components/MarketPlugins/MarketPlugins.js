// Packages
import React, { useCallback, use, useEffect, useRef, useState } from 'react';
import get from 'lodash/get';
import debounce from 'lodash/debounce';
import { useToast } from '@plitzi/plitzi-ui/Toast';

// Monorepo
import PluginsContext from '@plitzi/sdk-plugins/PluginsContext';

// Relatives
import PluginsFilter from './PluginsFilter';
import PluginList from './PluginList';
import PluginDetails from './PluginDetails';
import { parsePlugin } from '../../helpers/PluginHelper';

/** @returns {React.ReactElement} */
const MarketPlugins = () => {
  const [filter, setFilter] = useState({ name: { contains: '' }, owner: { contains: '' } });
  const [loading, setLoading] = useState(true);
  const [pluginSelected, setPluginSelected] = useState();
  const { addToast } = useToast();
  const [data, setData] = useState({ cursor: undefined, hasNextPage: false, plugins: {} });
  const pluginsContext = use(PluginsContext);
  const { plugins: pluginsInstalled } = pluginsContext;

  useEffect(() => {
    if (!pluginSelected) {
      fetch({ name: { contains: '' }, owner: { contains: '' } });
    }
  }, [pluginSelected]);

  const handleClickItem = useCallback(
    pluginType => {
      if (!pluginType) {
        setPluginSelected(undefined);

        return;
      }

      setPluginSelected(parsePlugin(data.plugins[pluginType]));
    },
    [setPluginSelected, data]
  );

  const fetch = async (search, more = false) => {
    setLoading(true);
    const result = await pluginsContext.fetch(search, data.cursor, 20);
    if (result) {
      const { pageInfo, edges } = result;
      if (!edges) {
        setLoading(false);

        return;
      }

      const plugins = edges.reduce(
        (acum, plugin) => ({
          ...acum,
          [plugin.type]: { ...plugin, version: get(pluginsInstalled, `${plugin.type}.version`) }
        }),
        {}
      );
      setData({
        cursor: pageInfo.nextCursor,
        hasNextPage: pageInfo.hasNextPage,
        plugins: more ? { ...data.plugins, plugins } : plugins
      });
      setLoading(false);
    }
  };

  const fetchDebounce = useRef(debounce(fetch, 350));

  const handleChangeFilter = useCallback(
    (value, type = 'name') => {
      setFilter(state => {
        const newFilter = { ...state, [type]: { contains: value } };
        fetchDebounce.current(newFilter);

        return newFilter;
      });
      setData({ cursor: undefined, hasNextPage: false, plugins: {} });
    },
    [setFilter, setData, fetchDebounce]
  );

  const onAdd = useCallback(
    async version => {
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
          {
            appeareance: 'danger',
            autoDismiss: true,
            placement: 'top-right'
          }
        );

        return false;
      }

      if (await pluginsContext.add(type, version)) {
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

        setPluginSelected(state => ({ ...state, version }));

        return true;
      }

      return false;
    },
    [pluginSelected]
  );

  const onUpdate = useCallback(
    async version => {
      if (!pluginSelected) {
        return false;
      }

      const { name, type, revisions } = pluginSelected;
      const assets = revisions.find(revision => revision.version === version);
      if (!assets) {
        return false;
      }

      const pluginInstalled = pluginsInstalled[type];
      if (version === pluginInstalled.versionInstalled) {
        return false;
      }

      if (await pluginsContext.update(type, version)) {
        addToast(
          <div>
            Plugin <b>{`${name} ${version}`}</b> Updated
          </div>,
          {
            appeareance: 'success',
            autoDismiss: true,
            placement: 'top-right'
          }
        );

        setPluginSelected(state => ({ ...state, version }));

        return true;
      }

      return false;
    },
    [pluginSelected]
  );

  const onRemove = useCallback(async () => {
    if (!pluginSelected) {
      return false;
    }

    const { type, name, version } = pluginSelected;
    if (await pluginsContext.remove(type)) {
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

      setPluginSelected(state => ({ ...state, version: undefined }));

      return true;
    }

    return false;
  }, [pluginSelected]);

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
