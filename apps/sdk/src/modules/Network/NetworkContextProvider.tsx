import { useCallback, useEffect, useMemo, useRef, useState, use } from 'react';

import { pluginParseDefinition } from '@plitzi/sdk-plugins';
import { ComponentContext } from '@plitzi/sdk-shared/elements';
import { NetworkContext, NetworkInternalContext } from '@plitzi/sdk-shared/network/react';
import { missingParts, withParts } from '@plitzi/sdk-shared/schema';
import { useRenderSettings, useSdkStoreSetter } from '@plitzi/sdk-shared/store';

import { askSpace } from './askSpace';
import { fetchPart, SpacePartsContext } from './spaceParts';

import type { PartsNeed, SpaceParts } from './spaceParts';
import type { OfflineDataRaw, Server, ComponentPluginWithHOC } from '@plitzi/sdk-shared';
import type { NetworkInternalContextValue, NetworkContextValue } from '@plitzi/sdk-shared/network/react';
import type { ReactNode, RefObject } from 'react';

export type NetworkContextProviderProps = {
  children: ReactNode;
  server: Server;
  revision?: number;
  webKey?: string;
  webId: number;
  userKey?: string;
  instanceId?: string;
  offlineMode?: boolean;
  offlineData?: OfflineDataRaw;
  offlineDataType?: 'json' | 'yaml';
};

/** The plugins `data` names that no component on the page registered, read from their definitions. */
const parseOfflinePlugins = async (
  data: OfflineDataRaw,
  registered: RefObject<Record<string, ComponentPluginWithHOC>>
): Promise<NetworkInternalContextValue['plugins']> =>
  data.plugins && data.plugins.length > 0
    ? // @todo: this one is not compact anymore, so we need to take the props that the sdk only requires assets, settings, subPlugins
      pluginParseDefinition(
        data.plugins.filter(plugin => !(registered.current[plugin.type] as undefined | ComponentPluginWithHOC))
      )
    : {};

const NetworkContextProvider = ({
  children,
  server,
  revision,
  webKey = '',
  webId,
  userKey = '',
  instanceId,
  offlineMode = false,
  offlineData,
  offlineDataType = 'json'
}: NetworkContextProviderProps) => {
  const { environment, debugMode, enclosed, renderMode } = useRenderSettings();
  const setSdkStore = useSdkStoreSetter();
  const offlineDataAvailable = offlineMode && !!offlineData && !!offlineData.schema;
  const [loading, setLoading] = useState(!(offlineMode && !!offlineData));
  const [error, setError] = useState<ReactNode | undefined>(undefined);
  const { components } = use(ComponentContext);
  const [internalData, setInternalData] = useState<NetworkInternalContextValue>(() => {
    if (offlineDataAvailable && offlineDataType === 'json') {
      return { ...offlineData, plugins: {} };
    }

    return { plugins: {} } as NetworkInternalContextValue;
  });

  /**
   * The space as it is now, from the page server (`askSpace`): the document a page drawn there is handed, and the
   * decision about this visit beside it — which a page drawn there is handed in its bootstrap, and a page that renders
   * here hears from nowhere else. Written from the answer every time, so a space paid up since the last load stops
   * saying it is over.
   */
  const initFromServer = async () => {
    const answer = await askSpace({
      ssrServer: server.ssrServer,
      webKey,
      environment,
      revision,
      // A space drawn into a document of its own, or scoped inside another page, cannot use the page's stylesheet.
      carryStyle: enclosed || renderMode !== 'raw'
    });
    if (!answer.ok) {
      setError(answer.message);
      setLoading(false);

      return;
    }

    const { space, visit } = answer;
    setSdkStore('render.overQuota', visit.overQuota ?? false);
    setSdkStore('render.quotaNear', visit.quotaNear ?? false);
    setSdkStore('render.badge', visit.badge ?? false);
    setInternalData({ ...space, plugins: await parseOfflinePlugins(space, components) });
    setLoading(false);
  };

  const initOfflineData = async (data: OfflineDataRaw) => {
    const plugins = await parseOfflinePlugins(data, components);
    // No plugin to add is no new registry: an empty one replacing the empty one drew every container of the page again,
    // right after it hydrated, for nothing.
    setInternalData(state =>
      Object.keys(plugins).length === 0 && Object.keys(state.plugins).length === 0 ? state : { ...state, plugins }
    );
    setLoading(false);
  };

  /**
   * New documents for the page already drawn (`replaceSpace` of what `render` returns): the space swapped where it
   * stands. The stores read schema and style from here, so the page follows, and its state, scroll and focus stay. The
   * latest wins: documents still reading their plugins when newer ones arrive are dropped.
   */
  const shown = useRef(offlineData);
  const replacing = useRef(0);
  useEffect(() => {
    if (!offlineDataAvailable || offlineDataType !== 'json' || shown.current === offlineData) {
      return;
    }

    shown.current = offlineData;
    replacing.current += 1;
    const turn = replacing.current;
    parseOfflinePlugins(offlineData, components).then(
      plugins => {
        if (turn === replacing.current) {
          setInternalData({ ...offlineData, plugins });
        }
      },
      (error: unknown) => {
        console.error(
          '[plitzi] The new space could not be drawn — its plugins did not load: the page stays as it was',
          error
        );
      }
    );
  }, [offlineData, offlineDataAvailable, offlineDataType, components]);

  useEffect(() => {
    if (!offlineMode || !offlineData) {
      setLoading(state => {
        if (!state) {
          return true;
        }

        return state;
      });
      void initFromServer();
    } else if (offlineDataAvailable) {
      void initOfflineData(offlineData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offlineDataAvailable, offlineMode && offlineDataType, webKey, environment, debugMode]);

  /**
   * The space sent in parts (`spaceParts`): what a page needs, fetched and put into the space before it is drawn. A
   * navigation goes once the stores hold it — this effect runs after the schema's own provider, inside, has synced it
   * — so the page it opens never draws a moment without its elements.
   */
  const latest = useRef(internalData);
  latest.current = internalData;
  const waiting = useRef<{ roots: string[]; resolve: () => void }[]>([]);
  useEffect(() => {
    const parts = internalData.schema.parts ?? {};
    waiting.current = waiting.current.filter(each => {
      if (each.roots.some(root => Object.hasOwn(parts, root))) {
        return true;
      }

      each.resolve();

      return false;
    });
  }, [internalData.schema]);
  const need = useCallback((pageId: string): PartsNeed => {
    const { schema } = latest.current;
    const roots = missingParts(schema, pageId);
    if (roots.length === 0) {
      return 'held';
    }

    return roots.some(root => !schema.parts?.[root]) ? 'server' : 'fetch';
  }, []);
  const ensure = useCallback(async (pageId: string): Promise<boolean> => {
    const { schema } = latest.current;
    const roots = missingParts(schema, pageId);
    if (roots.length === 0) {
      return true;
    }

    const names = roots.map(root => schema.parts?.[root] ?? '');
    if (names.includes('')) {
      return false;
    }

    const parts = await Promise.all(names.map(fetchPart));
    const held = new Promise<void>(resolve => {
      waiting.current.push({ roots, resolve });
    });
    setInternalData(state => ({ ...state, schema: withParts(state.schema, parts) }));
    await held;

    return true;
  }, []);
  const partsValue = useMemo<SpaceParts>(() => ({ need, ensure }), [need, ensure]);

  const networkValue = useMemo<NetworkContextValue>(
    () => ({ webKey, webId, server, environment, instanceId, userKey }),
    [webKey, webId, server, environment, instanceId, userKey]
  );

  if (error) {
    return <div>{error}</div>;
  }

  if (loading) {
    return null;
  }

  return (
    <NetworkContext value={networkValue}>
      <NetworkInternalContext value={internalData}>
        <SpacePartsContext value={partsValue}>{children}</SpacePartsContext>
      </NetworkInternalContext>
    </NetworkContext>
  );
};

export default NetworkContextProvider;
