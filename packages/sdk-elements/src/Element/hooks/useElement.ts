import { useElementData } from '../ElementStore';

import type { ElementContextValue } from '../ElementStore';

const useElement = (id: string): ElementContextValue => {
  const data = useElementData(id);
  if (data === undefined) {
    throw new Error(`Element data for "${id}" not found. Make sure the element is rendered under withElement.`);
  }

  return data;
};

export default useElement;
