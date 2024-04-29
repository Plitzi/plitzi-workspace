// Packages
import React, { useMemo, use, useRef, useCallback, useState } from 'react';
import get from 'lodash/get';

// Alias
import NetworkInternalContext from '@modules/Network/contexts/NetworkInternalContext';
import NetworkContext from '@modules/Network/NetworkContext';

// Relatives
import SegmentsContext from './SegmentsContext';

/**
 * @param {{
 *   children: React.ReactNode;
 *   segments: object;
 * }} props
 * @returns {React.ReactElement}
 */
const SegmentsContextProvider = props => {
  const { children, segments: segmentsProp } = props;
  const { query } = use(NetworkContext);
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

  const segmentGet = useCallback(
    async identifier => {
      if (segmentsRef.current[identifier]) {
        return segmentsRef.current[identifier];
      }

      let segment = await query('Segment', { identifier }, 'network-only');
      if (!(segment instanceof Error) && segment) {
        segment = {
          ...segment,
          schema: {
            ...get(segment, 'schema'),
            flat: get(segment, 'schema.flat', []).reduce((obj, item) => ({ ...obj, [item.id]: item }), {})
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
