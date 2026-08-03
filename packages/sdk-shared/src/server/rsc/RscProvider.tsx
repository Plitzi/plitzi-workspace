import { useState, useEffect, useCallback, useMemo } from 'react';

import RscContext from './RscContext';
import { useCommonStore } from '../../store';

import type { RscContextValue } from './RscContext';
import type { SSRRscData } from '../../types';
import type { ReactNode } from 'react';

export type RscProviderProps = {
  children: ReactNode;
  /** Initial RSC Data in SSR mode */
  rscData?: SSRRscData;
  /** Override the RSC endpoint path. Falls back to schema.rsc.path then '/_rsc'. */
  rscPath?: string;
  /** Change this value on SPA navigation to trigger an RSC re-fetch (e.g. pass currentPageId). */
  navigationKey?: string;
};

const RscProvider = ({ children, rscPath: rscPathProp, rscData, navigationKey }: RscProviderProps) => {
  const [schemaRsc] = useCommonStore('schema.rsc', { mode: 'mount' });
  const [rscState, setRscState] = useState<SSRRscData>(rscData ?? {});

  const enabled = schemaRsc?.enabled ?? false;
  const endpointPath = rscPathProp ?? schemaRsc?.path ?? '/_rsc';

  const fetchRsc = useCallback(
    async (ids?: string[], params?: Record<string, string>) => {
      if (!enabled || typeof window === 'undefined') {
        return;
      }

      try {
        // The request goes to `/_rsc`, so the server cannot see which page the visitor is on: route params and the
        // page parameter both come from the location travelling with it.
        const search = new URLSearchParams({ location: `${window.location.pathname}${window.location.search}` });
        if (ids?.length) {
          search.set('ids', ids.join(','));
        }

        Object.entries(params ?? {}).forEach(([key, value]) => search.set(key, value));
        const res = await fetch(`${endpointPath}?${search.toString()}`, { headers: { Accept: 'application/json' } });
        if (!res.ok) {
          return;
        }

        const data = (await res.json()) as SSRRscData;
        if (ids?.length) {
          // Partial refresh: merge only the returned keys into existing serverData.
          setRscState(prev => ({ serverData: { ...prev.serverData, ...data.serverData } }));
        } else {
          // Full refresh: replace serverData entirely.
          setRscState({ serverData: data.serverData });
        }
      } catch {
        // Network errors are silently ignored — RSC data is supplemental.
      }
    },
    [enabled, endpointPath]
  );

  // Fetch on mount and on every SPA navigation (navigationKey change).
  useEffect(() => {
    if (enabled && rscData === undefined) {
      void fetchRsc();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, fetchRsc, navigationKey]);

  const value = useMemo<RscContextValue>(
    () => ({ enabled, serverData: rscState.serverData, refresh: fetchRsc }),
    [enabled, rscState.serverData, fetchRsc]
  );

  return <RscContext value={value}>{children}</RscContext>;
};

export default RscProvider;
