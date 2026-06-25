import { use } from 'react';

import { ElementContext } from '../ElementContext';

import type { ElementContextValue } from '../ElementContext';

const useElement = () => {
  const data = use(ElementContext);
  if (data === undefined) {
    throw new Error('Element data not found. Make sure the element is rendered under withElement.');
  }

  return data as ElementContextValue;
};

export default useElement;
