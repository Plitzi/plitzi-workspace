import { useState, useEffect, useCallback, useMemo } from 'react';

import { createStoreHook } from '@plitzi/sdk-shared/store';

import RscContext from './RscContext';

import type { RscContextValue } from './RscContext';
import type { CommonState } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type RscProviderProps = {
  children: ReactNode;
  /** Override the RSC endpoint path. Falls back to schema.rsc.path then '/_rsc'. */
  rscPath?: string;
  /** Change this value on SPA navigation to trigger an RSC re-fetch (e.g. pass currentPageId). */
  navigationKey?: string;
};

const RscProvider = ({ children, rscPath: rscPathProp, navigationKey }: RscProviderProps) => {
  const { useStore } = createStoreHook<CommonState>();
  const [schemaRsc] = useStore('schema.rsc', { mode: 'mount' });

  const enabled = schemaRsc?.enabled ?? false;
  const endpointPath = rscPathProp ?? schemaRsc?.path ?? '/_rsc';

  const [rscState, setRscState] = useState<Pick<RscContextValue, 'serverData' | 'elements'>>({});

  const fetch_ = useCallback(async () => {
    if (!enabled || typeof window === 'undefined') {
      return;
    }

    try {
      const res = await fetch(endpointPath, { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        return;
      }

      const data = (await res.json()) as { serverData?: unknown; elements?: Record<string, unknown> };
      setRscState({ serverData: data.serverData, elements: data.elements });
    } catch {
      // Network errors are silently ignored — RSC data is supplemental.
    }
  }, [enabled, endpointPath]);

  // Fetch on mount and on every SPA navigation (navigationKey change).
  useEffect(() => {
    if (enabled) {
      void fetch_();
    }
  }, [enabled, fetch_, navigationKey]);

  const getElementData = useCallback(
    (id: string) => rscState.elements?.[id],
    [rscState.elements]
  );

  const value = useMemo<RscContextValue>(
    () => ({ enabled, serverData: rscState.serverData, elements: rscState.elements, getElementData, refresh: fetch_ }),
    [enabled, rscState.serverData, rscState.elements, getElementData, fetch_]
  );

  return <RscContext value={value}>{children}</RscContext>;
};

export default RscProvider;
