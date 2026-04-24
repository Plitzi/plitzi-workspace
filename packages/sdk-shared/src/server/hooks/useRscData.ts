/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */

import { use } from 'react';

import { useElement } from '../../elements';
import RscContext from '../rsc/RscContext';

/**
 * Returns RSC data for the given element.
 * Returns null (not undefined) when the element is registered as a server
 * element but carries no extra payload — the distinction matters for callers
 * that want to know whether the key was present at all.
 */
const useRscData = <T>() => {
  const { id } = useElement();
  const { enabled, serverData, refresh } = use(RscContext);
  const elementData: T | null | undefined = id ? ((serverData?.[id] as T) ?? null) : undefined;

  return { enabled, serverData, elementData, isServerElement: serverData && id in serverData, refresh };
};

export default useRscData;
