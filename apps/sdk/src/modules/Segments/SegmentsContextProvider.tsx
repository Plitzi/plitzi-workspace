import { get } from '@plitzi/plitzi-ui/helpers';
import { useMemo, use, useCallback, useState, useEffect } from 'react';

import { createStoreHook } from '@plitzi/nexus/createStore';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import NetworkInternalContext from '@plitzi/sdk-shared/network/NetworkInternalContext';
import SegmentsContext from '@plitzi/sdk-shared/segments/SegmentsContext';

import type { SdkQueriesMap, NetworkContextValue, Segment, SdkState } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type SegmentsContextProviderProps = {
  children: ReactNode;
};

const SegmentsContextProvider = ({ children }: SegmentsContextProviderProps) => {
  const { query } = use(NetworkContext) as NetworkContextValue<SdkQueriesMap>;
  const internalData = use(NetworkInternalContext);
  const segmentsPropMemo = useMemo(() => internalData.segments, [internalData]);

  const [segments, setSegments] = useState(segmentsPropMemo);

  const { useStoreSync, useStoreGetter } = createStoreHook<SdkState>();
  useStoreSync('segments', segments);
  const getSegment = useStoreGetter('segments');

  useEffect(() => {
    setSegments(segmentsPropMemo);
  }, [segmentsPropMemo]);

  const segmentGet = useCallback(
    async (identifier: string) => {
      const segment = getSegment(identifier, undefined);
      if (segment) {
        return segment;
      }

      try {
        const response = await query('Segment', { identifier }, 'network-only');
        const segmentRaw = response.result?.Segment;
        let segmentNew: Segment | undefined = undefined;
        if (response.success && segmentRaw) {
          segmentNew = {
            ...segmentRaw,
            schema: {
              ...get(segmentRaw, 'schema'),
              flat: get(segmentRaw, 'schema.flat', []).reduce((obj, item) => ({ ...obj, [item.id]: item }), {})
            }
          };

          setSegments({ ...getSegment(), [segmentNew.id]: segmentNew });
        }

        return segment;
      } catch {
        return undefined;
      }
    },
    [getSegment, query]
  );

  const valueMemo = useMemo(() => ({ segmentGet }), [segmentGet]);

  return <SegmentsContext value={valueMemo}>{children}</SegmentsContext>;
};

export default SegmentsContextProvider;
