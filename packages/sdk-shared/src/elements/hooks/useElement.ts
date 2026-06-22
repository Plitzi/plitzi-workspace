import { useElementData } from '../ElementStore';

import type { ElementContextValue } from '../ElementStore';

const useElement = <T extends 'skipHOC' | 'full' = 'full'>(id: string): ElementContextValue<T> => {
  const data = useElementData<T>(id);
  if (data === undefined) {
    throw new Error(`Element data for "${id}" not found. Make sure the element is rendered under withElement.`);
  }

  return data;
};

export default useElement;
