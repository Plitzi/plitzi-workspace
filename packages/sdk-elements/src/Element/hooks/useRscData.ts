/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */

import { use } from 'react';

import RscContext from '@plitzi/sdk-shared/server/rsc/RscContext';

import useElement from './useElement';

// Returns the current element's RSC data: its server payload from `RscContext`, keyed by the ambient element id read
// from `ElementContext`. Lives here (not in sdk-shared, where `RscContext` is) because resolving "the current element"
// needs `useElement`, which is an sdk-elements concern. `elementData` is `null` (not `undefined`) when the element is
// registered as a server element but carries no extra payload — the distinction matters for callers that want to know
// whether the key was present at all.
const useRscData = <T>() => {
  const { enabled, serverData, refresh } = use(RscContext);
  const { id } = useElement();
  const elementData: T | null = (serverData?.[id] as T) ?? null;

  return { enabled, serverData, elementData, isServerElement: !!serverData && id in serverData, refresh };
};

export default useRscData;
