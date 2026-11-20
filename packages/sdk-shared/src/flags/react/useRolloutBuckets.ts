import { useEffect, useMemo } from 'react';

import { useCommonStore, useRenderSettings } from '../../store';
import { browserRollout, writeRollout } from '../rollout';

import type { RolloutBuckets } from '../rollout';

const NONE: RolloutBuckets = {};

/**
 * Where this visitor stands in the space's gradual rollouts, for whoever resolves the flags in the browser — the
 * `flags` source and the router alike: the places the server answered the page with, the ones the visitor kept, and one
 * drawn once per page for a flag none of those has, kept in the cookie from then on. In the builder there is no
 * visitor: no place, and a rollout's flag answers its own value (forced from the Feature Flags panel to see the other).
 */
const useRolloutBuckets = (): RolloutBuckets => {
  const { builder } = useRenderSettings();
  const [[declared, server]] = useCommonStore(['schema.flags', 'flags.rollout']);
  const assignment = useMemo(
    () => (builder ? { buckets: NONE, drawn: [] } : browserRollout(declared, server)),
    [builder, declared, server]
  );

  const { buckets, drawn } = assignment;
  useEffect(() => {
    if (drawn.length > 0) {
      writeRollout(buckets);
    }
  }, [buckets, drawn]);

  return buckets;
};

export default useRolloutBuckets;
