import { use } from 'react';

import RscContext from '../RscContext';

/**
 * Returns RSC data for the given element.
 * Returns null (not undefined) when the element is registered as a server
 * element but carries no extra payload — the distinction matters for callers
 * that want to know whether the key was present at all.
 */
const useRscData = (elementId?: string) => {
  const { enabled, serverData, elements, refresh } = use(RscContext);
  const elementData = elementId !== undefined ? (elements?.[elementId] ?? null) : undefined;
  const isServerElement = elementId !== undefined && elements !== undefined && elementId in (elements ?? {});

  return { enabled, serverData, elementData, isServerElement, refresh };
};

export default useRscData;
