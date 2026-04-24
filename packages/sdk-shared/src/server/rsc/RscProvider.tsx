import { useState, useEffect, useCallback, useMemo } from 'react';

import { createStoreHook } from '@plitzi/sdk-shared/store';

import RscContext from './RscContext';

import type { RscContextValue } from './RscContext';
import type { CommonState, SSRRscData } from '@plitzi/sdk-shared';
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
  const { useStore } = createStoreHook<CommonState>();
  const [schemaRsc] = useStore('schema.rsc', { mode: 'mount' });
  const [rscState, setRscState] = useState<SSRRscData>(rscData ?? {});

  const enabled = schemaRsc?.enabled ?? false;
  const endpointPath = rscPathProp ?? schemaRsc?.path ?? '/_rsc';

  const fetchRsc = useCallback(async () => {
    if (!enabled || typeof window === 'undefined') {
      return;
    }

    try {
      const res = await fetch(endpointPath, { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        return;
      }

      const data = (await res.json()) as SSRRscData;
      setRscState({ serverData: data.serverData });
    } catch {
      // Network errors are silently ignored — RSC data is supplemental.
    }
  }, [enabled, endpointPath]);

  // Fetch on mount and on every SPA navigation (navigationKey change).
  useEffect(() => {
    if (enabled) {
      void fetchRsc();
    }
  }, [enabled, fetchRsc, navigationKey]);

  const getElementData = useCallback((id: string) => rscState.serverData?.[id], [rscState.serverData]);

  const value = useMemo<RscContextValue>(
    () => ({
      enabled,
      serverData: rscState.serverData,
      getElementData,
      refresh: fetchRsc
    }),
    [enabled, rscState.serverData, getElementData, fetchRsc]
  );

  return <RscContext value={value}>{children}</RscContext>;
};

export default RscProvider;
