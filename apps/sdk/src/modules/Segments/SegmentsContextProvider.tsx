import { get } from '@plitzi/plitzi-ui/helpers';
import { useMemo, use, useRef, useCallback, useState, useEffect } from 'react';

import NetworkInternalContext from '@modules/Network/contexts/NetworkInternalContext';
import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';
import SegmentsContext from '@plitzi/sdk-shared/segments/SegmentsContext';

import type { QueriesMap, NetworkContextValue, Segment } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type SegmentsContextProviderProps = {
  children: ReactNode;
  segments?: Record<string, Segment>;
};

const SegmentsContextProvider = ({ children, segments: segmentsProp }: SegmentsContextProviderProps) => {
  const { query } = use(NetworkContext) as NetworkContextValue<QueriesMap>;
  const internalData = use(NetworkInternalContext);
  const segmentsPropMemo = useMemo(() => {
    if (segmentsProp) {
      return segmentsProp;
    }

    return internalData.segments ?? {};
  }, [segmentsProp, internalData]);

  const [segments, setSegments] = useState(segmentsPropMemo);
  const segmentsRef = useRef(segmentsPropMemo);
  segmentsRef.current = segmentsPropMemo;

  useEffect(() => {
    setSegments(segmentsPropMemo);
  }, [segmentsPropMemo]);

  const segmentGet = useCallback(
    async (identifier: string) => {
      if (segmentsRef.current[identifier] as Segment | undefined) {
        return segmentsRef.current[identifier];
      }

      const response = await query('Segment', { identifier }, 'network-only');
      const segmentRaw = response.result?.Segment;
      let segment: Segment | undefined = undefined;
      if (response.success && segmentRaw) {
        segment = {
          ...segmentRaw,
          schema: {
            ...get(segmentRaw, 'schema'),
            flat: get(segmentRaw, 'schema.flat', []).reduce((obj, item) => ({ ...obj, [item.id]: item }), {})
          }
        };

        setSegments({ ...segmentsRef.current, [segment.id]: segment });
      }

      return segment;
    },
    [query]
  );

  const valueMemo = useMemo(() => ({ segments, segmentGet }), [segments, segmentGet]);

  return <SegmentsContext value={valueMemo}>{children}</SegmentsContext>;
};

export default SegmentsContextProvider;
